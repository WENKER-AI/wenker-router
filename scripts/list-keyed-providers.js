const http = require('http');
http.get('http://127.0.0.1:3600/api/providers', (r) => {
  let s = '';
  r.on('data', (c) => (s += c));
  r.on('end', () => {
    const j = JSON.parse(s);
    const p = j.providers || j.data || j;
    const withKey = p.filter((x) => x.hasApiKey);
    console.log('Provider DA CO key san: ' + withKey.length);
    withKey.forEach((x) =>
      console.log('  ' + String(x.id).padEnd(22) + ' cat=' + String(x.category).padEnd(12) + ' enabled=' + x.enabled + ' auth=' + x.authType)
    );
    const cats = {};
    p.forEach((x) => (cats[x.category] = (cats[x.category] || 0) + 1));
    console.log('categories: ' + JSON.stringify(cats));
    const freeNoKey = p.filter((x) => x.category === 'free' || x.category === 'wenker');
    console.log('free/wenker providers: ' + freeNoKey.map((x) => x.id).join(', '));
  });
});
