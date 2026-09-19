// Liệt kê hiện trạng các provider liên quan tới vụ "gộp basic".
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
  const A = { 'x-wenker-admin-key': admin.key };
  const p = await get('/api/providers', A);
  const list = p?.providers || [];
  for (const id of [
    'wenker-cloud',
    'wenker-vip',
    'wenker-community',
    'xkiro-basic',
    'pollinations',
  ]) {
    const x = list.find((y) => y.id === id);
    if (!x) {
      console.log(`${id}: KHONG CO`);
      continue;
    }
    console.log(
      `${id}: name="${x.name}" cat=${x.category} enabled=${x.enabled} baseUrl=${x.baseUrl} auth=${x.authType} hasKey=${x.hasApiKey} models=${(x.models || []).length}`,
    );
    console.log(`   ids: ${(x.models || []).map((m) => m.id).join(', ')}`);
  }
  const st = await get('/api/settings', A);
  const s = st?.settings || st || {};
  console.log('\ndefaultProvider =', s.defaultProvider);
  console.log('fallbackOrder =', JSON.stringify(s.fallbackOrder));
})();
