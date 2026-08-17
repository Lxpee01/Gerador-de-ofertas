import * as cheerio from "cheerio";
import { fetchPageHtml } from "@/lib/browser";
import type { Product } from "@/types/product";

interface JsonLdProduct {
  name?: string;
  image?: string | string[];
  offers?: JsonLdOffer | JsonLdOffer[];
}

interface JsonLdOffer {
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
}

function cleanText(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function extractPrice(text: string | undefined): string | undefined {
  if (!text) return undefined;

  const match = text.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/);
  return match?.[1];
}

function formatPrice(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const raw = String(value).trim();

  if (raw.includes(",")) {
    return extractPrice(raw);
  }

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (Number.isNaN(numeric)) return extractPrice(raw);

  return numeric.toFixed(2).replace(".", ",");
}

export function extractAmazonAsin(url: string): string | null {
  const patterns = [
    /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

export function normalizeAmazonUrl(url: string): string {
  const asin = extractAmazonAsin(url);
  if (asin) {
    return `https://www.amazon.com.br/dp/${asin}`;
  }

  return url;
}

function isBlockedPage(html: string): boolean {
  return /captcha|robot check|type the characters|digite os caracteres|api-services-support@amazon/i.test(
    html,
  );
}

function parseJsonLdProduct(html: string): JsonLdProduct | null {
  const $ = cheerio.load(html);

  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(element).html();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;

        const record = candidate as Record<string, unknown>;

        if (record["@type"] === "Product") {
          return record as JsonLdProduct;
        }

        const graph = record["@graph"];
        if (Array.isArray(graph)) {
          const product = graph.find(
            (item) =>
              item &&
              typeof item === "object" &&
              (item as Record<string, unknown>)["@type"] === "Product",
          ) as JsonLdProduct | undefined;

          if (product) return product;
        }
      }
    } catch {
      // try next script block
    }
  }

  return null;
}

function getOfferPrice(offers: JsonLdProduct["offers"]): string | undefined {
  if (!offers) return undefined;

  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer) return undefined;

  return (
    formatPrice(offer.price) ||
    formatPrice(offer.lowPrice) ||
    formatPrice(offer.highPrice)
  );
}

function getJsonLdImage(image: JsonLdProduct["image"]): string | undefined {
  if (!image) return undefined;
  if (Array.isArray(image)) return cleanText(image[0]);
  return cleanText(image);
}

function parseProductFromHtml(html: string, productUrl: string): Product {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLdProduct(html);

  const name =
    cleanText($("#productTitle").text()) ||
    cleanText($("#title").text()) ||
    cleanText($("h1#title").text()) ||
    cleanText(jsonLd?.name) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($("title").text()?.replace(/Amazon\.com\.br:?\s*/i, ""));

  const priceWhole = cleanText(
    $(".priceToPay .a-price-whole").first().text()?.replace(/\.$/, "") ||
      $(".a-price .a-price-whole").first().text()?.replace(/\.$/, ""),
  );
  const priceFraction = cleanText(
    $(".priceToPay .a-price-fraction").first().text() ||
      $(".a-price .a-price-fraction").first().text(),
  );
  const priceFromMeta = cleanText(
    $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[itemprop="price"]').attr("content"),
  );

  let price: string | undefined;
  if (priceWhole && priceFraction) {
    price = `${priceWhole},${priceFraction}`;
  } else {
    price =
      getOfferPrice(jsonLd?.offers) ||
      extractPrice(priceFromMeta) ||
      extractPrice(cleanText($(".a-price .a-offscreen").first().text())) ||
      extractPrice(cleanText($("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text()));
  }

  const oldPrice =
    extractPrice(
      cleanText($(".basisPrice .a-offscreen, .a-price.a-text-price .a-offscreen").first().text()),
    ) ||
    extractPrice(cleanText($("#listPrice").text())) ||
    extractPrice(cleanText($(".a-text-strike").first().text()));

  const imageUrl =
    cleanText($("#landingImage").attr("src")) ||
    cleanText($("#imgBlkFront").attr("src")) ||
    getJsonLdImage(jsonLd?.image) ||
    cleanText($('meta[property="og:image"]').attr("content"));

  const coupon =
    cleanText($("#promoPriceBlockMessage_feature_div").text()) ||
    cleanText($(".couponBadge").text()) ||
    cleanText($('[data-coupon]').attr("data-coupon"));

  if (!name) {
    throw new Error("Não foi possível extrair o nome do produto na Amazon");
  }

  if (!price) {
    throw new Error("Não foi possível extrair o preço do produto na Amazon");
  }

  return {
    name,
    price,
    oldPrice: oldPrice && oldPrice !== price ? oldPrice : undefined,
    imageUrl,
    coupon: coupon && coupon.length <= 80 ? coupon : undefined,
    url: productUrl,
    platform: "amazon",
  };
}

export async function scrapeAmazon(url: string): Promise<Product> {
  const productUrl = normalizeAmazonUrl(url);
  const html = await fetchPageHtml(productUrl);

  if (isBlockedPage(html)) {
    throw new Error(
      "A Amazon bloqueou a extração automática deste link. Tente novamente em instantes.",
    );
  }

  return parseProductFromHtml(html, productUrl);
}
