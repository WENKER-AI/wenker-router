const http = require('http');
function post(body, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const d = JSON.stringify(body);
    const r = http.request(
      {
        host: '127.0.0.1',
        port: 3600,
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) },
        timeout: timeoutMs || 60000,
      },
      (res) => {
        let s = '';
        res.on('data', (c) => s += c);
        res.on('end', () => {
          let j = null;
          try {
            j = JSON.parse(s);
          } catch (e) { /* ignore JSON parse error */ }
          resolve({ st: res.statusCode, s, j, ms: Date.now() - t0 });
        });
      },
    );
    r.on('error', (e) => resolve({ st: 0, s: e.code, j: null, ms: Date.now() - t0 }));
    r.on('timeout', () => {
      r.destroy();
      resolve({ st: -1, s: 'timeout', j: null, ms: Date.now() - t0 });
    });
    r.write(d);
    r.end();
  });
}
const REFUSE =
  /reached its budget|payment required|rate limit|too many requests|quota|invalid api key|no healthy upstream/i;
async function one(m) {
  const r = await post({
    model: m,
    messages: [{ role: 'user', content: 'Chi tra loi dung 1 tu: Trai dat hinh gi?' }],
    stream: false,
    max_tokens: 20,
  });
  const c = r.j && r.j.choices && r.j.choices[0] && r.j.choices[0].message.content || '';
  const kind =
    r.st !== 200 ? 'HTTP' + r.st : !c.trim() ? 'EMPTY' : REFUSE.test(c) ? 'TU-CHOI' : 'TRALOI';
  console.log(
    kind.padEnd(9) +
      m.padEnd(42) +
      String(r.ms).padStart(6) +
      'ms  served=' +
      (r.j && r.j.model) +
      '  "' +
      c.replace(/\s+/g, ' ').slice(0, 50) +
      '"' +
      (r.st !== 200 ? '  ' + r.s.slice(0, 80) : ''),
  );
}
(async () => {
  const list = [
    'openrouter/deepseek/deepseek-chat-v3-0324:free',
    'openrouter/meta-llama/llama-3.3-70b-instruct:free',
    'together/meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'groq-free/llama-3.1-8b-instant',
    'llama3.1-8b-instant',
  ];
  for (const m of list) {
    await one(m);
    await new Promise((r) => setTimeout(r, 800));
  }
})();
