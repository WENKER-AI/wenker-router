// 1) Lay danh sach model :free CON SON that tu OpenRouter (API public).
// 2) Goi THU QUA ROUTER WENKER (model "openrouter/<slug>") -> day la id ghep vao Cline/Copilot dung duoc.
const https = require('https');
const http = require('http');

function orPublic() {
  return new Promise((resolve) => {
    const r = https.request(
      { host: 'openrouter.ai', path: '/api/v1/models', method: 'GET', timeout: 40000 },
      (res) => {
        let b = '';
        res.on('data', (c) => b += c);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    r.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    r.on('timeout', () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    r.end();
  });
}
function wenker(path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const r = http.request(
      { host: '127.0.0.1', port: 3600, path, method: data ? 'POST' : 'GET', headers: h },
      (res) => {
        let b = '';
        res.on('data', (c) => b += c);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    r.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(45000, () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const pub = await orPublic();
  let freeSlugs = [];
  try {
    const j = JSON.parse(pub.body);
    const ms = j.data || [];
    // Model mien phi thuc su: ca 2 gia bang 0
    freeSlugs = ms
      .filter((m) => {
        const p = m.pricing || {};
        return Number(p.prompt) === 0 && Number(p.completion) === 0;
      })
      .map((m) => m.id);
    console.log(
      `OpenRouter /models: HTTP ${pub.status}, tong ${ms.length} model, ${freeSlugs.length} model gia 0 (that su mien phi)`,
    );
  } catch (e) {
    console.log('khong doc duoc /models:', pub.status, pub.body.slice(0, 120));
  }
  console.log('mau 12 slug mien phi:', freeSlugs.slice(0, 12).join('  |  '));

  const keys = await wenker('/api/keys', {}, null);
  let kj;
  try {
    kj = JSON.parse(keys.body);
  } catch {
    kj = null;
  }
  const arr = Array.isArray(kj) ? kj : kj && kj.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  const A = { 'x-wenker-admin-key': admin.key };
  await wenker('/api/settings', A, { enableSmartFallback: false });

  // Thu qua ROUTER: vai slug mien phi + vai slug tra phi da biet chay.
  const candidates = [
    ...freeSlugs.slice(0, 5).map((s) => 'openrouter/' + s),
    'openrouter/deepseek/deepseek-chat',
    'openrouter/meta-llama/llama-3.3-70b-instruct',
    'openrouter/openai/gpt-4o-mini',
  ];
  console.log('\n=== GOI QUA ROUTER WENKER :3600 ===');
  for (const m of candidates) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await wenker('/v1/chat/completions', A, {
      model: m,
      messages: [{ role: 'user', content: 'one word only: ' + nonce }],
      max_tokens: 25,
    });
    let j;
    try {
      j = JSON.parse(r.body);
    } catch {
      j = null;
    }
    const c = j?.choices?.[0]?.message?.content;
    const e = j?.error?.message;
    console.log(
      `${r.status === 200 && c ? 'SONG ' : 'CHET '} ${m.padEnd(58)} HTTP ${r.status}  ${
        c
          ? JSON.stringify(String(c).slice(0, 45))
          : String(e || r.body)
            .replace(/\s+/g, ' ')
            .slice(0, 110)
      }`,
    );
  }
  await wenker('/api/settings', A, { enableSmartFallback: true });
  console.log('\n(da bat lai smart fallback)');
})();
