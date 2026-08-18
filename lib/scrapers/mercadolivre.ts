import * as cheerio from "cheerio";
import type { Product } from "@/types/product";

function parseBrlPrice(value: number | string): string {
  let numStr = String(value).trim();
  if (numStr.includes(",")) {
    // É formato brasileiro: "1.065,56" -> removemos o ponto de milhar e trocamos a vírgula por ponto
    numStr = numStr.replace(/\./g, "").replace(",", ".");
  }
  // Se não tem vírgula, já é formato americano "1065.56" ou não tem decimais "1065"
  const num = parseFloat(numStr);
  if (isNaN(num)) return "0,00";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export async function scrapeMercadoLivre(url: string): Promise<Product> {
  const scrapingAntKey = process.env.SCRAPINGANT_API_KEY;
  
  if (!scrapingAntKey) {
    throw new Error("A chave da API ScrapingAnt não está configurada no .env. Configure SCRAPINGANT_API_KEY para burlar os bloqueios do Mercado Livre.");
  }

  // ScrapingAnt resolve os redirecionamentos (links curtos meli.la, etc) pra gente.
  // Basta passarmos a URL original.
  const proxyUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&x-api-key=${scrapingAntKey}&proxy_country=BR&browser=false`;

  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Falha ao extrair página via Proxy. Status: ${response.status}`);
  }

  const html = await response.text();

  if (html.includes("account-verification") || html.includes("suspicious-traffic")) {
    throw new Error("O proxy não conseguiu burlar o bloqueio do Mercado Livre. Tente novamente em alguns minutos.");
  }

  const $ = cheerio.load(html);

  // Mercado Livre usa JSON-LD
  const jsonLdContent = $('script[type="application/ld+json"]').html();
  let jsonLd: any = {};
  if (jsonLdContent) {
    try {
      jsonLd = JSON.parse(jsonLdContent);
      if (Array.isArray(jsonLd)) {
        jsonLd = jsonLd.find((item: any) => item["@type"] === "Product" || item["@type"] === "IndividualProduct") || {};
      }
    } catch (e) {}
  }

  // Nome
  const name =
    jsonLd.name ||
    $('meta[property="og:title"]').attr("content") ||
    $("h1.ui-pdp-title").text().trim() ||
    $("title").text().split("|")[0].trim();

  // Preço atual
  let priceStr = "";
  if (jsonLd.offers && jsonLd.offers.price) {
    priceStr = String(jsonLd.offers.price);
  } else {
    priceStr = $('meta[property="product:price:amount"]').attr("content") || "";
  }

  if (!priceStr) {
    // Evita pegar o preço antigo (que fica dentro de uma tag <s>)
    const priceElement =
      $(".ui-pdp-price__second-line .andes-money-amount__fraction").first().text().trim() ||
      $(".ui-pdp-price .andes-money-amount__fraction").not("s .andes-money-amount__fraction").first().text().trim() ||
      $(".andes-money-amount__fraction").not("s .andes-money-amount__fraction").first().text().trim();
      
    if (priceElement) {
      priceStr = priceElement.replace(/\./g, ""); // Remove os pontos de milhar "1.065" -> "1065"
      const centsElement = 
        $(".ui-pdp-price__second-line .andes-money-amount__cents").first().text().trim() ||
        $(".ui-pdp-price .andes-money-amount__cents").not("s .andes-money-amount__cents").first().text().trim() ||
        $(".andes-money-amount__cents").not("s .andes-money-amount__cents").first().text().trim();
        
      if (centsElement) {
        priceStr += `.${centsElement}`;
      }
    }
  }

  if (!name || !priceStr) {
    throw new Error("Produto encontrado, mas sem informações de preço ou nome.");
  }

  const price = parseBrlPrice(priceStr);

  // Preço antigo (riscado)
  let oldPriceStr = "";
  const originalPriceElement = $("s.andes-money-amount .andes-money-amount__fraction").first().text().trim();
  if (originalPriceElement) {
    oldPriceStr = originalPriceElement.replace(/\./g, "");
    const originalCents = $("s.andes-money-amount .andes-money-amount__cents").first().text().trim();
    if (originalCents) {
      oldPriceStr += `.${originalCents}`;
    }
  }
  const oldPrice = oldPriceStr ? parseBrlPrice(oldPriceStr) : undefined;

  // Imagem
  let imageUrl =
    jsonLd.image ||
    $('meta[property="og:image"]').attr("content") ||
    $("figure.ui-pdp-gallery__figure img.ui-pdp-image").attr("src") ||
    $("img.ui-pdp-image").attr("src");

  if (Array.isArray(imageUrl)) imageUrl = imageUrl[0];

  if (!imageUrl) {
    throw new Error("Não consegui encontrar a imagem do produto.");
  }

  return {
    name,
    price,
    oldPrice,
    imageUrl: imageUrl,
    url: url,
    platform: "mercadolivre"
  };
}
