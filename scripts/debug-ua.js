// Debug script to see what happens when we fetch ML now
async function debugML() {
  const url = process.argv[2] || "https://www.mercadolivre.com.br/cadeira-de-escritrio-ajustvel-apoio-brao-tecido-respirvel-preto/p/MLB37498498";
  
  const UAs = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1", // Mobile Safari
    "WhatsApp/2.23.16.76 A" // WhatsApp UA
  ];

  console.log(`Testing URL: ${url}\n`);

  for (const ua of UAs) {
    console.log(`\n=== Testing UA: ${ua} ===`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        redirect: "follow"
      });
      console.log(`Status: ${res.status}`);
      console.log(`Final URL: ${res.url}`);
      
      if (res.url.includes("account-verification")) {
        console.log("-> BLOCKED by ML verification");
        const go = new URL(res.url).searchParams.get("go");
        if (go) console.log(`   'go' param: ${go}`);
      } else {
        console.log("-> SUCCESS! Page loaded.");
        const html = await res.text();
        const hasJsonLd = html.includes('application/ld+json');
        console.log(`   Has JSON-LD? ${hasJsonLd}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

debugML().catch(console.error);
