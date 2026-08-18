import * as cheerio from "cheerio";
import type { Product } from "@/types/product";

function parseBrlPrice(value: number | string): string {
  let numStr = String(value).trim();
  // Remove "R$" or any other non-numeric character except dots and commas
  numStr = numStr.replace(/[^\d.,]/g, "");
  
  if (numStr.includes(",")) {
    // Brazilian format: "1.065,56" -> remove thousands separator and change comma to dot
    numStr = numStr.replace(/\./g, "").replace(",", ".");
  }
  
  const num = parseFloat(numStr);
  if (isNaN(num)) return "0,00";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export async function scrapeAliExpress(url: string): Promise<Product> {
  const scrapingAntKey = process.env.SCRAPINGANT_API_KEY;
  
  if (!scrapingAntKey) {
    throw new Error("A chave da API ScrapingAnt não está configurada no .env.");
  }

  // O AliExpress usa Client Side Rendering intensivo, precisamos do browser=true
  // para que o ScrapingAnt rode o JavaScript da página antes de devolver o HTML
  const proxyUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${scrapingAntKey}&proxy_country=BR&browser=true`;

  let response;
  try {
    response = await fetch(proxyUrl, { 
      signal: AbortSignal.timeout(60000) 
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error("A conexão com o AliExpress demorou muito e foi interrompida. Tente novamente.");
    }
    throw err;
  }
  
  if (!response.ok) {
    throw new Error(`Falha ao extrair página via Proxy. Status: ${response.status}`);
  }

  const html = await response.text();

  if (html.includes("Slide to verify") || html.includes("Please slide to verify")) {
    throw new Error("O AliExpress bloqueou o acesso com um captcha de segurança. Tente novamente em alguns minutos.");
  }

  const $ = cheerio.load(html);

  // Nome
  let name = $('meta[property="og:title"]').attr("content") || $("title").text().trim();
  if (name.includes(" | ")) name = name.split(" | ")[0].trim();
  if (name.toLowerCase().startsWith("aliexpress")) name = name.replace(/^aliexpress/i, "").trim();

  // Preços
  const priceStr = 
    $("[class*='price-default--current']").first().text().trim() || 
    $('meta[property="product:price:amount"]').attr("content");
    
  const oldPriceStr = 
    $("[class*='price-default--original']").first().text().trim() || 
    $("[class*='price-default--priceExtraFont']").first().text().trim();

  if (!priceStr || !name) {
    throw new Error("Produto encontrado, mas sem informações de preço ou nome. Pode ser uma página de captcha ou promoção que não expirou corretamente.");
  }

  const price = parseBrlPrice(priceStr);
  const oldPrice = oldPriceStr ? parseBrlPrice(oldPriceStr) : undefined;

  // Imagem
  let imageUrl = $('meta[property="og:image"]').attr("content") || $("img").first().attr("src");

  if (!imageUrl) {
    throw new Error("Não consegui encontrar a imagem do produto.");
  }

  // Cupom (se houver na página)
  let coupon = $("[class*='coupon-block--box']").first().text().trim();

  return {
    name,
    price,
    oldPrice,
    imageUrl,
    coupon: coupon || undefined,
    url: url, // a url de afiliado vai ser preservada e inserida pelo frontend
    platform: "aliexpress"
  };
}
