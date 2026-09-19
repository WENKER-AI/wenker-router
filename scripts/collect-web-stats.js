// Lay SO LIEU THAT de ghi len trang web (khong bịa số). In ra JSON tong hop.
const http = require('http');
const fs = require('fs');
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
          resolve({ status: res.statusCode, json: j });
        });
      },
    );
    r.on('error', (e) => resolve({ status: 0, json: null, err: String(e.message) }));
    r.end();
  });
}
(async () => {
  const keys = await get('/api/keys', {});
  const arr = Array.isArray(keys.json) ? keys.json : keys.json?.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  const A = { 'x-wenker-admin-key': admin.key };

  const pv = await get('/api/providers', A);
  const list = pv.json?.providers || [];
  const models = await get('/v1/models', { 'x-api-key': admin.key });
  const data = models.json?.data || [];

  const cats = {};
  for (const p of list) cats[p.category] = (cats[p.category] || 0) + 1;
  const noKey = list.filter((p) => p.authType === 'none' && !p.requiresAuth).length;
  const free = list.filter((p) => p.isFree).length;
  const enabled = list.filter((p) => p.enabled).length;

  // Đếm số model theo provider wenker-*
  const byProv = {};
  for (const m of data) {
    const pid = m.id.split('/')[0];
    byProv[pid] = (byProv[pid] || 0) + 1;
  }

  const health = await get('/api/health', A);
  const out = {
    generatedAt: new Date().toISOString(),
    providersTotal: list.length,
    providersEnabled: enabled,
    providersFree: free,
    providersNoKey: noKey,
    categories: cats,
    modelsTotal: data.length,
    uniqueBareModels: new Set(data.map((m) => m.id.split('/').pop())).size,
    wenkerTierModels: Object.fromEntries(
      Object.entries(byProv).filter(([k]) => k.startsWith('wenker') || k === 'openrouter'),
    ),
    aliveProviders: Object.entries(health.json || {})
      .filter(([, v]) => v && v.ok === true)
      .map(([k]) => k),
    downProviders: Object.entries(health.json || {})
      .filter(([, v]) => v && v.ok === false)
      .map(([k]) => k),
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(process.env.TEMP + '\\wenker-stats.json', JSON.stringify(out, null, 2));
})();
