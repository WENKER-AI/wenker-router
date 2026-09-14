// Deterministic cache proof: spin up a mock OpenAI-compatible upstream, ask the
// router once (cache miss), then KILL the mock and ask again. If the second call
// still returns the exact same content, the response cache is really serving it.
const http = require('http');
const B = 'http://127.0.0.1:3600';
const KEY = 'sk-wenker-local-admin';
const MOCK_PORT = 4599;
let hits = 0;
const MARKER = 'CACHE-MOCK-OK-42';

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    hits++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock', object: 'chat.completion', created: 1,
      model: 'mock-model',
      choices: [{ index: 0, message: { role: 'assistant', content: MARKER }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
    }));
  });
});

async function api(path, opts = {}) {
  const r = await fetch(B + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, ...(opts.headers || {}) }
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, j };
}

async function chat(msg) {
  return api('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'cachemock/mock-model', messages: [{ role: 'user', content: msg }], stream: false })
  });
}

(async () => {
  await new Promise(r => server.listen(MOCK_PORT, '127.0.0.1', r));

  // Register a custom provider pointing at the mock.
  const add = await api('/api/providers/custom/add', {
    method: 'POST',
    body: JSON.stringify({ id: 'cachemock', name: 'Cache Mock', baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`, requiresAuth: false, models: [{ id: 'mock-model', name: 'Mock', contextWindow: 4096, isFree: true }] })
  });
  console.log('add provider:', add.status, add.j?.provider?.id);

  const prompt = 'deterministic cache probe ' + Date.now();

  const first = await chat(prompt);
  console.log('FIRST  status=' + first.status, 'content=' + JSON.stringify(first.j?.choices?.[0]?.message?.content), 'mockHits=' + hits);

  // Kill the mock so a second real upstream call is impossible.
  server.close();
  await new Promise(r => setTimeout(r, 200));

  const second = await chat(prompt);
  console.log('SECOND status=' + second.status, 'content=' + JSON.stringify(second.j?.choices?.[0]?.message?.content), 'cached=' + second.j?.cached, 'mockHits=' + hits);

  const stats = await api('/api/cache');
  console.log('cache stats:', stats.status, JSON.stringify(stats.j));

  // Clean up the mock provider.
  const del = await api('/api/providers/custom/cachemock', { method: 'DELETE' });
  console.log('delete provider:', del.status);

  const pass =
    first.status === 200 && first.j?.choices?.[0]?.message?.content === MARKER &&
    second.status === 200 && second.j?.choices?.[0]?.message?.content === MARKER &&
    hits === 1;
  console.log(pass ? '\n✅ CACHE PROOF PASSED (mock hit once, second served from cache)' : '\n❌ CACHE PROOF FAILED');
  process.exit(pass ? 0 : 1);
})();
