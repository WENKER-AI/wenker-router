// Do THAT 4 nguon MAY khong can key, DOC LAP voi Pollinations.
// Tat enableSmartFallback de KHONG bi du don ve wenker-cloud (deo dung ket qua).
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
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(70000, () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const keys = await call('GET', '/api/keys', {}, null);
  let kj;
  try {
    kj = JSON.parse(keys.body);
  } catch {
    kj = null;
  }
  const arr = Array.isArray(kj) ? kj : kj && kj.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  if (!admin) {
    console.log('KHONG co admin key');
    return;
  }
  const A = { 'x-wenker-admin-key': admin.key };

  // Tat smart fallback de ket qua la THAT cua tung nguon.
  await call('POST', '/api/settings', A, { enableSmartFallback: false });

  const models = await call('GET', '/v1/models', A, null);
  let mj;
  try {
    mj = JSON.parse(models.body);
  } catch {
    mj = { data: [] };
  }
  const list = mj.data || [];

  const targets = ['duckduckgo', 'huggingchat-free', 'puter-ai', 'blackbox-free', 'phind-search'];
  console.log('=== 4-5 NGUON MAY KHONG CAN KEY (doc lap Pollinations) ===\n');

  for (const pid of targets) {
    const modelsOf = list.filter((m) => m.wenker_provider === pid).map((m) => m.id);
    const probe = modelsOf[0] || `${pid}/default`;
    const nonce = 'x' + Math.random().toString(36).slice(2, 8);
    const r = await call('POST', '/v1/chat/completions', A, {
      model: probe,
      messages: [{ role: 'user', content: 'noi dung khac ' + nonce }],
      max_tokens: 40,
    });
    let j;
    try {
      j = JSON.parse(r.body);
    } catch {
      j = null;
    }
    const content = j?.choices?.[0]?.message?.content;
    const err = j?.error?.message;
    let verdict;
    if (r.status === 200 && content && !/reached its budget|raise the budget/i.test(content)) {
      verdict = 'SONG THAT';
    } else if (r.status === 200) {
      verdict = 'FAKE-200 (van la tu choi)';
    } else {
      verdict = `CHET (${r.status})`;
    }
    console.log(`[${pid}]  ${verdict}`);
    console.log(`   probe model: ${probe}   (so model lo ra: ${modelsOf.length})`);
    console.log(
      `   -> ${
        content
          ? JSON.stringify(String(content).slice(0, 90))
          : String(err || r.body)
            .replace(/\s+/g, ' ')
            .slice(0, 150)
      }`,
    );
    console.log();
  }

  // Bat lai smart fallback nhu mac dinh.
  await call('POST', '/api/settings', A, { enableSmartFallback: true });
  console.log('(da bat lai enableSmartFallback = true)');
})();
