import type { Platform } from "@/types/product";

const PLATFORM_PATTERNS: { platform: Platform; patterns: RegExp[] }[] = [
  {
    platform: "amazon",
    patterns: [
      /amazon\.(com\.br|com|co\.uk|de|fr|es|it|ca|com\.mx)/i,
      /amzn\.to/i,
      /a\.co/i,
    ],
  },
  {
    platform: "shopee",
    patterns: [/shopee\.(com\.br|com)/i, /s\.shopee/i],
  },
  {
    platform: "mercadolivre",
    patterns: [/mercadolivre\.com\.br/i, /mercadolibre\.com/i, /mlb\.link/i, /meli\.la/i],
  },
  {
    platform: "aliexpress",
    patterns: [/aliexpress\.com/i, /s\.click\.aliexpress/i],
  },
  {
    platform: "magalu",
    patterns: [/magazineluiza\.com\.br/i, /magalu\.com\.br/i],
  },
];

export function detectPlatform(url: string): Platform {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const { platform, patterns } of PLATFORM_PATTERNS) {
      if (patterns.some((pattern) => pattern.test(hostname) || pattern.test(url))) {
        return platform;
      }
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}

export async function resolveShortUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  return response.url;
}
