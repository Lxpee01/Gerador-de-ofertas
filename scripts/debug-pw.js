const { chromium } = require('playwright');

async function testPlaywright() {
  console.log("Launching playwright...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });
  
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await ctx.newPage();
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const url = "https://www.mercadolivre.com.br/cadeira-de-escritrio-ajustvel-apoio-brao-tecido-respirvel-preto/p/MLB37498498";
  
  console.log(`Going to ${url}...`);
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  console.log(`Status: ${res.status()}`);
  console.log(`Final URL: ${page.url()}`);
  
  const title = await page.title();
  console.log(`Title: ${title}`);
  
  await browser.close();
}

testPlaywright().catch(console.error);
