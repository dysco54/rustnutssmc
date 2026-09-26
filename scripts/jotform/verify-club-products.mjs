const apiKey = process.env.JOTFORM_API_KEY;
const res = await fetch(`https://api.jotform.com/form/262682106860054/properties?apiKey=${apiKey}`);
const json = await res.json();
const products = json.content.products || [];
console.log('FINAL VERIFIED COUNT:', products.length);
for (const p of products) {
  const opts = JSON.parse(p.options);
  const size = opts.find(o => o.name === 'Size');
  const colour = opts.find(o => o.name === 'Colour');
  console.log(p.name.padEnd(28), '$' + p.price, '| Size:', size.properties.replace(/\n/g, ','), '| Colour:', colour.properties.replace(/\n/g, ','));
}
