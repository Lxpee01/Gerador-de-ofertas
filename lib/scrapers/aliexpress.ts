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

/**
 * Tenta extrair dados do produto a partir do HTML sem renderização JS.
 * O AliExpress embute dados parciais em scripts inline (DCData, runParams).
 */
function tryExtractFromRawHtml(html: string): Partial<Product> | null {
  const $ = cheerio.load(html);
  
  // Nome via og:title (presente no HTML cru)
  let name = $('meta[property="og:title"]').attr("content") || $("title").text().trim();
  if (!name) return null;
  if (name.includes(" | ")) name = name.split(" | ")[0].trim();
  if (name.toLowerCase().startsWith("aliexpress")) name = name.replace(/^aliexpress/i, "").trim();
  if (!name) return null;

  // Imagem via DCData ou og:image
  let imageUrl = $('meta[property="og:image"]').attr("content");
  
  // Tenta pegar imagens do DCData embutido no HTML
  if (!imageUrl) {
    const dcMatch = html.match(/window\._d_c_\.DCData\s*=\s*(\{[\s\S]*?\});/);
    if (dcMatch) {
      try {
        const dcData = JSON.parse(dcMatch[1]);
        if (dcData.imagePathList && dcData.imagePathList.length > 0) {
          imageUrl = dcData.imagePathList[0];
        }
      } catch {}
    }
  }

  // Tenta preço de meta tags ou scripts embutidos
  let priceStr = $('meta[property="product:price:amount"]').attr("content") || "";
  
  // Tenta extrair preço de scripts inline (alguns produtos têm)
  if (!priceStr) {
    const priceMatch = html.match(/"formatedActivityPrice"\s*:\s*"([^"]+)"/) ||
                       html.match(/"formatedPrice"\s*:\s*"([^"]+)"/) ||
                       html.match(/"minActivityAmount"\s*:\s*{[^}]*"value"\s*:\s*([\d.]+)/) ||
                       html.match(/"minAmount"\s*:\s*{[^}]*"value"\s*:\s*([\d.]+)/);
    if (priceMatch) {
      priceStr = priceMatch[1];
    }
  }

  if (!priceStr) return null;

  return {
    name,
    price: parseBrlPrice(priceStr),
    imageUrl: imageUrl || undefined,
  };
}

export async function scrapeAliExpress(url: string): Promise<Product> {
  const scrapingAntKey = process.env.SCRAPINGANT_API_KEY;
  
  if (!scrapingAntKey) {
    throw new Error("A chave da API ScrapingAnt não está configurada no .env.");
  }

  // === TENTATIVA 1: browser=false (rápido, ~2-3s) ===
  // Muitas páginas do AliExpress embutem dados no HTML cru
  const fastUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${scrapingAntKey}&proxy_country=BR&browser=false`;

  let response;
  try {
    response = await fetch(fastUrl, { signal: AbortSignal.timeout(15000) });
  } catch {
    response = null;
  }

  if (response && response.ok) {
    const html = await response.text();
    const fastResult = tryExtractFromRawHtml(html);
    
    if (fastResult && fastResult.name && fastResult.price && fastResult.imageUrl) {
      return {
        name: fastResult.name,
        price: fastResult.price,
        oldPrice: fastResult.oldPrice,
        imageUrl: fastResult.imageUrl,
        url,
        platform: "aliexpress",
      };
    }
  }

  // === TENTATIVA 2: browser=true (lento, ~10-20s, mas pega tudo) ===
  const fullUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${scrapingAntKey}&proxy_country=BR&browser=true`;

  try {
    response = await fetch(fullUrl, { 
      signal: AbortSignal.timeout(55000) 
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

  // Preços - selectors do DOM renderizado
  const priceStr = 
    $("[class*='price-default--current']").first().text().trim() || 
    $('meta[property="product:price:amount"]').attr("content");
    
  const oldPriceStr = 
    $("[class*='price-default--original']").first().text().trim() || 
    $("[class*='price-default--priceExtraFont']").first().text().trim();

  if (!priceStr || !name) {
    throw new Error("Produto encontrado, mas sem informações de preço ou nome.");
  }

  const price = parseBrlPrice(priceStr);
  const oldPrice = oldPriceStr ? parseBrlPrice(oldPriceStr) : undefined;

  // Imagem
  let imageUrl = $('meta[property="og:image"]').attr("content") || $("img").first().attr("src");

  if (!imageUrl) {
    throw new Error("Não consegui encontrar a imagem do produto.");
  }

  // Cupom (se houver na página)
  const coupon = $("[class*='coupon-block--box']").first().text().trim();

  return {
    name,
    price,
    oldPrice,
    imageUrl,
    coupon: coupon || undefined,
    url,
    platform: "aliexpress"
  };
}
