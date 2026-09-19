// Xac nhan /v1/models: wenker-cloud model moi (alias) + pollinations van con.
const http = require('http');
function get(path, headers) {
  return new Promise((resolve) => {
    const r = http.request(
      { host: '127.0.0.1', port: 3600, path, method: 'GET', headers },
      (res) => {
        let b = '';
        res.on('data', (c) => b += c);
        res.on('end', () => {
          let j;
          try {
            j = JSON.parse(b);
          } catch {
            j = null;
          }
          resolve(j);
        });
      },
    );
    r.on('error', () => resolve(null));
    r.end();
  });
}
(async () => {
  const keys = await get('/api/keys', {});
  const arr = Array.isArray(keys) ? keys : keys?.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  const m = await get('/v1/models', { 'x-api-key': admin.key });
  const ids = (m?.data || []).map((x) => x.id);
  console.log('Tong model:', ids.length);
  console.log('\nwenker-cloud/* trong /v1/models:');
  ids.filter((i) => i.startsWith('wenker-cloud/')).forEach((i) => console.log('  ' + i));
  console.log(
    '\ncon \'pollinations\' provider trong danh sach:',
    ids.some((i) => i.startsWith('pollinations/')),
  );
  console.log(
    'con \'openrouter\' provider:',
    ids.some((i) => i.startsWith('openrouter/')),
  );
  console.log(
    'con \'xkiro-basic\' provider:',
    ids.some((i) => i.startsWith('xkiro-basic/')),
  );
  console.log(
    'alias \'gpt-4o\' co mat:',
    ids.includes('gpt-4o') || ids.some((i) => i.endsWith('/gpt-4o')),
  );
})();
