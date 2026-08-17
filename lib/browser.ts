import { chromium, type Browser } from "playwright";

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1366,768",
      ],
    });
  }

  return browserInstance;
}

export async function fetchPageHtml(url: string): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "pt-BR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Sec-CH-UA":
        '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const page = await context.newPage();

  // Hide webdriver flag to avoid bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
    // Override permissions
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["pt-BR", "pt", "en-US", "en"],
    });
  });

  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 40_000,
    });

    // Wait for any product title to appear (Amazon or ML selectors)
    await page
      .waitForSelector(
        "#productTitle, #title, h1#title, h1.ui-pdp-title, h1[class*='title'], .andes-money-amount__fraction",
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    // Extra delay for JS-heavy pages (ML renders via React)
    await page.waitForTimeout(2000);

    return await page.content();
  } finally {
    await context.close();
  }
}
