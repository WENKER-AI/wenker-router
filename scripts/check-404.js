// Kiểm tra nhanh trang 404 được server :3600 phục vụ (status, base href, asset path).
const url = process.argv[2] || 'http://localhost:3600/nope-not-real';
fetch(url).then(async (r) => {
  const t = await r.text();
  const head = t.slice(0, t.indexOf('</head>') + 7);
  console.log('status      :', r.status);
  console.log('has base    :', /<base\s+href=["']\/web\/["']>/.test(t));
  console.log('has canvas  :', t.includes('id="gameCanvas"'));
  console.log('css href    :', (head.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/i) || [''])[0]);
  console.log('script srcs :', [...t.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]).join(', '));
}).catch((e) => { console.error('ERR', e.message); process.exit(1); });
