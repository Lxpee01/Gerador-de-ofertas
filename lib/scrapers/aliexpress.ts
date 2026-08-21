import * as cheerio from "cheerio";
import type { Product } from "@/types/product";

function parseBrlPrice(value: number | string): string {
  let numStr = String(value).trim();
  numStr = numStr.replace(/[^\d.,]/g, "");
  
  if (numStr.includes(",")) {
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

  // Como solicitado, focando apenas no nome e preço, e usando datacenter para carregar mais rápido
  // Usamos browser=true pois o AliExpress esconde o preço no JavaScript
  // Removemos proxy_country=BR e usamos proxy_type=datacenter que cai de 35s para ~15-20s, o que não dá timeout no Vercel.
  const fullUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${scrapingAntKey}&proxy_type=datacenter&browser=true`;

  let response;
  try {
    response = await fetch(fullUrl, { 
      signal: AbortSignal.timeout(45000) 
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error("A extração do AliExpress demorou demais. Tente novamente.");
    }
    throw err;
  }
  
  if (!response.ok) {
    throw new Error(`Falha ao extrair página do AliExpress. Status: ${response.status}`);
  }

  const html = await response.text();

  const hasCaptcha = html.includes("Slide to verify") || html.includes("Please slide to verify") || html.includes("punish");
  const hasProductData = html.includes("price-default") || html.includes("product:price") || html.includes("og:title");
  
  if (hasCaptcha && !hasProductData) {
    throw new Error("O AliExpress bloqueou o acesso com captcha. Tente novamente.");
  }

  const $ = cheerio.load(html);

  // Nome
  let name = $('meta[property="og:title"]').attr("content") || $("title").text().trim();
  if (!name) {
    $("h1").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.toLowerCase().startsWith("aliexpress") && text.length > 5) {
        name = text;
        return false;
      }
    });
  }
  if (name && name.includes(" | ")) name = name.split(" | ")[0].trim();
  if (name && name.toLowerCase().startsWith("aliexpress")) name = name.replace(/^aliexpress/i, "").trim();

  // Preço
  let priceStr = 
    $("[class*='price-default--current']").first().text().trim() || 
    $("[class*='currentPriceText']").first().text().trim() ||
    $('meta[property="product:price:amount"]').attr("content") ||
    "";

  if (!priceStr) {
    $("span, div, bdi").each((_, el) => {
      const text = $(el).text().trim();
      if (text.match(/^R\$\s?[\d.,]+$/) && text.length < 20) {
        priceStr = text;
        return false;
      }
    });
  }
    
  const oldPriceStr = 
    $("[class*='price-default--original']").first().text().trim() || 
    $("[class*='price-default--priceExtraFont']").first().text().trim();

  if (!priceStr || !name) {
    throw new Error("Produto encontrado, mas sem informações de preço ou nome.");
  }

  const price = parseBrlPrice(priceStr);
  const oldPrice = oldPriceStr ? parseBrlPrice(oldPriceStr) : undefined;

  // Cupom
  const coupon = $("[class*='coupon-block--box']").first().text().trim();

  return {
    name: name || "Produto AliExpress",
    price: price || "0,00",
    oldPrice,
    imageUrl: "https://ae-pic-a1.aliexpress-media.com/kf/S19146daa3e1b431d8bd1442d0839713eo.jpg", // Ignorando imagem real
    coupon: coupon || undefined,
    url,
    platform: "aliexpress"
  };
}
