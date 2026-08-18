const cheerio = require('cheerio'); 
const html = require('fs').readFileSync('mlb_test.html', 'utf8'); 
const $ = cheerio.load(html); 

const jsonLdContent = $('script[type="application/ld+json"]').html(); 
let jsonLd = {}; 
if (jsonLdContent) { 
  try { 
    jsonLd = JSON.parse(jsonLdContent); 
    if (Array.isArray(jsonLd)) jsonLd = jsonLd.find(i => i['@type'] === 'Product' || i['@type'] === 'IndividualProduct') || {}; 
  } catch(e){} 
} 

console.log('JSON-LD Price:', jsonLd.offers?.price); 
console.log('Meta Price:', $('meta[property="product:price:amount"]').attr('content')); 
console.log('DOM fallback:', $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim());
console.log('DOM fallback without second-line:', $('.andes-money-amount__fraction').first().text().trim());
