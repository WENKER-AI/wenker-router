const http = require('http');
function req(method, path, body, headers) {
  return new Promise((resolve) => {
    const d = body ? JSON.stringify(body) : null;
    const h = Object.assign({}, headers || {});
    if (d) {
      h['content-type'] = 'application/json';
      h['content-length'] = Buffer.byteLength(d);
    }
    const r = http.request({ host: '127.0.0.1', port: 3600, method, path, headers: h }, (res) => {
      let s = '';
      res.on('data', (c) => s += c);
      res.on('end', () => {
        let j = null;
        try {
          j = JSON.parse(s);
        } catch (e) { /* ignore JSON parse error */ }
        resolve({ st: res.statusCode, s, j });
      });
    });
    r.on('error', (e) => resolve({ st: 0, s: e.code, j: null }));
    if (d) r.write(d);
    r.end();
  });
}
(async () => {
  // Lay admin key that that
  const keys = await req('GET', '/api/keys');
  const arr = Array.isArray(keys.j) ? keys.j : keys.j && (keys.j.keys || keys.j.data) || [];
  const admin = arr.find && arr.find((k) => k.role === 'admin' && k.isActive !== false);
  if (!admin) {
    console.log(
      'KHONG tim thay admin key; /api/keys HTTP ' + keys.st + ' body=' + keys.s.slice(0, 200),
    );
    return;
  }
  const H = { 'x-wenker-admin-key': admin.key };
  console.log('admin key lay duoc tu /api/keys (role=admin)');

  // Tat Smart Fallback
  const before = await req('GET', '/api/settings', null, H);
  const s0 = before.j && (before.j.settings || before.j);
  console.log('enableSmartFallback TRUOC:', s0 && s0.enableSmartFallback);
  await req('POST', '/api/settings', { enableSmartFallback: false }, H);

  const list = [
    'openrouter/deepseek/deepseek-chat-v3-0324:free',
    'together/meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'groq-free/llama-3.1-8b-instant',
    'wenker-deepseek-v3-free',
  ];
  for (const m of list) {
    const r = await req('POST', '/v1/chat/completions', {
      model: m,
      messages: [{ role: 'user', content: 'Noi 1 tu thoi.' }],
      stream: false,
      max_tokens: 20,
    });
    const c = r.j && r.j.choices && r.j.choices[0] && r.j.choices[0].message.content || '';
    const err = r.j && r.j.error && (r.j.error.message || r.j.error.code);
    console.log('\n' + m);
    console.log(
      '  HTTP ' +
        r.st +
        '  served=' +
        (r.j && r.j.model) +
        '  ' +
        (c ? 'content="' + c.slice(0, 60) + '"' : '') +
        (err ? '  ERR=' + String(err).slice(0, 160) : ''),
    );
  }

  // Bat lai Smart Fallback nhu cu
  await req(
    'POST',
    '/api/settings',
    { enableSmartFallback: s0 && s0.enableSmartFallback !== false },
    H,
  );
  const after = await req('GET', '/api/settings', null, H);
  const s1 = after.j && (after.j.settings || after.j);
  console.log('\nDa bat lai enableSmartFallback =', s1 && s1.enableSmartFallback);
})();
