// Find the actual product URL inside the meli.la social page
async function test() {
  const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const shortUrl = "https://meli.la/2HHSdum";
  
  const res = await fetch(shortUrl, {
    method: "GET",
    headers: { "User-Agent": GOOGLEBOT_UA, Accept: "text/html" },
    redirect: "follow",
  });
  
  const html = await res.text();
  
  // Find all ML product links in the page
  const productLinks = html.match(/https?:\/\/[^"'\s]*mercadolivre\.com\.br\/[^"'\s]*\/p\/MLB\d+[^"'\s]*/g);
  const itemLinks = html.match(/https?:\/\/[^"'\s]*mercadolivre\.com\.br\/MLB-[^"'\s]*/g);
  const dpLinks = html.match(/https?:\/\/[^"'\s]*mercadoli[^"'\s]*(?:\/dp\/|\/p\/|MLB-?\d+)[^"'\s]*/g);
  
  console.log("Product /p/ links:", productLinks?.slice(0, 5));
  console.log("Item MLB- links:", itemLinks?.slice(0, 5));
  console.log("All ML product links:", dpLinks?.slice(0, 5));
  
  // Find any link with MLB in it
  const mlbLinks = html.match(/href="([^"]*MLB[^"]*)"/g);
  console.log("\nhref with MLB:", mlbLinks?.slice(0, 10));
  
  // Check for __PRELOADED_STATE__ or similar data
  const preloaded = html.match(/__PRELOADED_STATE__[^=]*=\s*({[\s\S]*?})\s*;?\s*<\/script>/);
  if (preloaded) {
    const snippet = preloaded[1].substring(0, 1000);
    console.log("\n__PRELOADED_STATE__ snippet:", snippet);
  }
  
  // Check for item IDs anywhere
  const itemIds = html.match(/MLB\d{6,}/g);
  console.log("\nMLB IDs found:", [...new Set(itemIds || [])].slice(0, 10));
}

test().catch(console.error);
