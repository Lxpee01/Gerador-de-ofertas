const fs = require('fs');

async function debug() {
  const env = fs.readFileSync('.env', 'utf8');
  const appId = env.match(/ML_APP_ID=(.*)/)[1].trim();
  const clientSecret = env.match(/ML_CLIENT_SECRET=(.*)/)[1].trim();

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", appId);
  params.append("client_secret", clientSecret);

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: params.toString(),
  });

  const auth = await response.json();
  if (!auth.access_token) {
    console.error("No access token!", auth);
    return;
  }
  const token = auth.access_token;

  // Let's test the URL resolver too to see what ID it got
  const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const url = "https://meli.la/2HHSdum"; // Use the url the user is likely testing
  console.log("Resolving URL:", url);
  const res = await fetch(url, { headers: { "User-Agent": GOOGLEBOT_UA }});
  let finalUrl = res.url;
  let html = "";
  if (finalUrl.includes("account-verification")) {
    const go = new URL(finalUrl).searchParams.get("go");
    if (go) finalUrl = go;
    console.log("Was blocked. Final URL from go param:", finalUrl);
  } else {
    html = await res.text();
    console.log("Page loaded. Final URL:", finalUrl);
  }

  let mlbId = null;
  const catalogMatch = finalUrl.match(/\/p\/(MLB\d+)/i);
  if (catalogMatch) mlbId = catalogMatch[1].toUpperCase();
  else {
    const itemMatch = finalUrl.match(/(MLB)-?(\d+)/i);
    if (itemMatch) mlbId = `${itemMatch[1].toUpperCase()}${itemMatch[2]}`;
  }

  if (!mlbId && html) {
    const feat = html.match(/\/p\/(MLB\d+)/i) || html.match(/(MLB)-?(\d+)/i);
    if (feat) {
      if (feat[1].toUpperCase() === "MLB" && feat[2]) mlbId = `MLB${feat[2]}`;
      else mlbId = feat[1].toUpperCase();
    }
  }

  console.log("Extracted ID:", mlbId);

  if (!mlbId) return;

  // Now fetch items API
  console.log("Fetching /items API...");
  let itemRes = await fetch(`https://api.mercadolibre.com/items/${mlbId}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  let data = await itemRes.json();
  if (!itemRes.ok) {
    console.log("Items API failed:", data);
    console.log("Fetching /products API...");
    itemRes = await fetch(`https://api.mercadolibre.com/products/${mlbId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    data = await itemRes.json();
  }

  console.log("\n==== FINAL JSON ====");
  console.log(JSON.stringify(data, null, 2));
}

debug().catch(console.error);
