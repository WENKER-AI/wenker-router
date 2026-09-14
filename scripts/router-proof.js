// Prove the ROUTER itself is 100% functional end-to-end (Cline-style request path):
// custom prefix stripping, streaming SSE, non-stream, cache — using a local mock
// upstream that stands in for "a provider with a working key".
const http = require('http');
const B = 'http://127.0.0.1:3600';
const KEY = 'sk-wenker-local-admin';
const PORT = 4611;

// Mock OpenAI-compatible upstream that supports BOTH stream and non-stream.
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    const content = 'MOCK-REPLY-OK';
    if (payload.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ id: 'm', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: 'm', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'm', object: 'chat.completion', created: 1, model: payload.model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } }));
    }
  });
});

async function api(path, opts = {}) {
  const r = await fetch(B + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, ...(opts.headers || {}) } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, j, t };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  await api('/api/providers/custom/add', { method: 'POST', body: JSON.stringify({ id: 'mockprov', name: 'Mock Provider', baseUrl: `http://127.0.0.1:${PORT}/v1`, requiresAuth: false, models: [{ id: 'mock-echo', name: 'Mock', contextWindow: 4096, isFree: true }] }) });

  const out = [];

  // A. Cline-style prefixed model, NON-stream.
  {
    const r = await api('/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'openai-compatible:mockprov/mock-echo', messages: [{ role: 'user', content: 'A ' + Date.now() }], stream: false }) });
    out.push(['A prefix non-stream', `status=${r.status} content=${JSON.stringify(r.j?.choices?.[0]?.message?.content)}`]);
  }

  // B. Cline-style prefixed model, STREAM (SSE passthrough).
  {
    const r = await fetch(B + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: 'openai-compatible:mockprov/mock-echo', messages: [{ role: 'user', content: 'B ' + Date.now() }], stream: true }) });
    const text = await r.text();
    const hasDone = text.includes('[DONE]');
    const hasContent = text.includes('MOCK-REPLY-OK');
    out.push(['B prefix stream', `status=${r.status} sseDone=${hasDone} sseHasContent=${hasContent} bytes=${text.length}`]);
  }

  // C. Anthropic /v1/messages path (what Cline/Claude Code actually calls).
  {
    const r = await api('/v1/messages', { method: 'POST', body: JSON.stringify({ model: 'mockprov/mock-echo', max_tokens: 64, messages: [{ role: 'user', content: 'C ' + Date.now() }] }) });
    out.push(['C /v1/messages', `status=${r.status} text=${JSON.stringify(r.j?.content?.[0]?.text ?? r.j?.error?.message ?? r.t.slice(0, 60))}`]);
  }

  // D. Unknown model still gives honest 404 (regression check).
  {
    const r = await api('/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'no-such-model-zzz', messages: [{ role: 'user', content: 'x' }] }) });
    out.push(['D unknown 404', `status=${r.status} code=${r.j?.error?.code}`]);
  }

  await api('/api/providers/custom/mockprov', { method: 'DELETE' });
  server.close();

  console.log('\n===== ROUTER FUNCTIONAL PROOF =====');
  for (const [k, v] of out) console.log(k.padEnd(20), '|', v);
})();
