/*
 * PHEP DO QUYET DINH: cung 1 model, prompt NGAN vs prompt DAI, TUAN TU, co nonce
 * de khong bi response-cache lan. Muc dich: tra loi "reached its budget" la do
 * (a) tai khoan het tien that, (b) do prompt dai, hay (c) do goi dong lot.
 */
const http = require('http');
function post(body, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const d = JSON.stringify(body);
    const r = http.request(
      { host: '127.0.0.1', port: 3600, method: 'POST', path: '/v1/chat/completions',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) },
        timeout: timeoutMs || 60000 },
      (res) => { let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) {} resolve({ st: res.statusCode, s, j, ms: Date.now() - t0 }); }); }
    );
    r.on('error', (e) => resolve({ st: 0, s: e.code, j: null, ms: Date.now() - t0 }));
    r.on('timeout', () => { r.destroy(); resolve({ st: -1, s: 'timeout', j: null, ms: Date.now() - t0 }); });
    r.write(d); r.end();
  });
}
const REFUSE = /reached its budget|payment required|rate limit|too many requests|quota/i;
const n = () => Math.random().toString(36).slice(2, 8);

async function one(model, prompt) {
  const r = await post({ model, messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 60 });
  const c = (r.j && r.j.choices && r.j.choices[0] && r.j.choices[0].message.content) || '';
  const served = r.j && r.j.model;
  const pt = r.j && r.j.usage && r.j.usage.prompt_tokens;
  const kind = r.st !== 200 ? 'HTTP' + r.st : !c.trim() ? 'EMPTY' : REFUSE.test(c) ? 'TU-CHOI' : 'TRALOI';
  return { model, kind, served, pt, ms: r.ms, txt: c.replace(/\s+/g, ' ').slice(0, 62) };
}

async function main() {
  const models = ['wenker-deepseek-v3-free', 'pollinations-openai', 'puter-gpt-4o', 'hf-deepseek-r1', 'ddg-gpt-4o-mini'];
  const LONG = 'Giải thích bằng tiếng Việt thật ngắn gọn thế nào để một router AI local ' +
    'chuyển yêu cầu OpenAI-compatible sang nhiều upstream miễn phí, có circuit breaker, ' +
    'rate limit và cache câu trả lời. ' + n() + ' Hãy viết khoảng 200 từ.';
  for (const m of models) {
    const short = await one(m, 'hi ' + n());
    console.log('NGAN  ' + m.padEnd(26) + short.kind.padEnd(8) + ' pt=' + String(short.pt).padStart(4) +
      ' ' + String(short.ms).padStart(6) + 'ms  served=' + short.served + '  "' + short.txt + '"');
    await new Promise((r) => setTimeout(r, 1500));
    const lng = await one(m, LONG);
    console.log('DAI   ' + m.padEnd(26) + lng.kind.padEnd(8) + ' pt=' + String(lng.pt).padStart(4) +
      ' ' + String(lng.ms).padStart(6) + 'ms  served=' + lng.served + '  "' + lng.txt + '"');
    await new Promise((r) => setTimeout(r, 1500));
  }
}
main().catch((e) => console.log('FATAL', e));
