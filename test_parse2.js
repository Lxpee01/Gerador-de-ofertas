const cheerio = require('cheerio'); 
const html = require('fs').readFileSync('mlb_test.html', 'utf8'); 
const $ = cheerio.load(html); 

const fractions = $('.andes-money-amount__fraction').map((i, el) => $(el).text()).get();
console.log('Fractions:', fractions.join(', '));

const priceElement1 = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim();
const priceElement2 = $('.andes-money-amount__fraction').first().text().trim();
console.log('Price elements:', priceElement1, priceElement2);

console.log('JSON LD string:', $('script[type="application/ld+json"]').html());
