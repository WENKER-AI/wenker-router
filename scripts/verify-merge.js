// Sau gop: goi 1 alias + 1 slug tho qua wenker-cloud, fallback TAT, prompt nonce, doc log providerId.
const http = require('http');
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const r = http.request({ host: '127.0.0.1', port: 3600, path, method, headers: h }, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => {
        let j;
        try {
          j = JSON.parse(b);
        } catch {
          j = null;
        }
        resolve({ status: res.statusCode, json: j, body: b });
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(30000, () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}
const txt = (j) => (j?.choices?.[0]?.message?.content || '').slice(0, 50).replace(/\s+/g, ' ');
(async () => {
  const keys = await call('GET', '/api/keys', {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : keys.json?.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  const A = { 'x-wenker-admin-key': admin.key };
  const K = { 'x-api-key': admin.key };
  const st = await call('GET', '/api/settings', A, null);
  const s = st.json?.settings || st.json || {};
  await call('POST', '/api/settings', A, Object.assign({}, s, { enableSmartFallback: false }));
  await call('DELETE', '/api/cache', A, null);
  const latest = async () => {
    const lg = await call('GET', '/api/logs', A, null);
    const l = Array.isArray(lg.json) ? lg.json : lg.json?.logs || [];
    const e = l.find((x) => x.endpoint === '/v1/chat/completions');
    return e ? `provider=${e.providerId} model=${e.resolvedModel} status=${e.status}` : '?';
  };
  for (const m of [
    'wenker-cloud/wenker-deepseek-v3-free',
    'wenker-cloud/mistralai/devstral-medium',
    'wenker-cloud/mistralai/ministral-3b',
  ]) {
    const n = Math.random().toString(36).slice(2, 9);
    const r = await call('POST', '/v1/chat/completions', K, {
      model: m,
      messages: [{ role: 'user', content: `ma ${n}: 5+5?` }],
      stream: false,
    });
    console.log(`HTTP ${r.status}  ${m.padEnd(42)} ${await latest()}\n        -> ${txt(r.json)}`);
  }
  const mm = await call('GET', '/v1/models', K, null);
  console.log(
    '\nwenker-cloud/* trong /v1/models =',
    (mm.json?.data || []).filter((x) => x.id.startsWith('wenker-cloud/')).length,
  );
  console.log(
    'xkiro-basic/* con trong /v1/models =',
    (mm.json?.data || []).some((x) => x.id.startsWith('xkiro-basic/')),
  );
  await call('POST', '/api/settings', A, Object.assign({}, s, { enableSmartFallback: true }));
})();
