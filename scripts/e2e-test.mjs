// E2E smoke test for the WENKER router resilience combo.
const B = 'http://127.0.0.1:3600';
const KEY = 'sk-wenker-local-admin';

async function post(path, body, headers = {}) {
  const r = await fetch(B + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000)
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* non-json */ }
  return { status: r.status, json, text: text.slice(0, 400) };
}

async function get(path) {
  const r = await fetch(B + path, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(60000) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { }
  return { status: r.status, json, text: text.slice(0, 300) };
}

const uniq = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

(async () => {
  const results = [];

  // 1. Unknown model -> honest 404 with a list of what exists.
  {
    const r = await post('/v1/chat/completions', { model: 'totally-not-a-model-xyz', messages: [{ role: 'user', content: 'hi' }] });
    results.push(['1 unknown-model 404', `status=${r.status} code=${r.json?.error?.code} hint=${Boolean(r.json?.error?.hint)} models=${r.json?.error?.available_models?.length}`]);
  }

  // 2. Cache: same unique prompt twice. First may be an upstream error; second identical
  //    request must be byte-identical, and if the first succeeded the second is a cache hit.
  {
    const prompt = `Cache probe ${uniq()} - reply with one short word.`;
    const msg = [{ role: 'user', content: prompt }];
    const a = await post('/v1/chat/completions', { model: 'openrouter/deepseek/deepseek-r1:free', messages: msg });
    const b = await post('/v1/chat/completions', { model: 'openrouter/deepseek/deepseek-r1:free', messages: msg });
    const aOk = a.status === 200, bOk = b.status === 200;
    const same = aOk && bOk && a.json?.choices?.[0]?.message?.content === b.json?.choices?.[0]?.message?.content;
    results.push(['2 repeat-request', `first=${a.status} second=${b.status} cachedFlag=${b.json?.cached} identical=${same}`]);
  }

  // 3. Known dead free model -> failover or honest status (never a bare 500500).
  {
    const r = await post('/v1/chat/completions', { model: 'ddg-gpt-4o-mini', messages: [{ role: 'user', content: `Failover probe ${uniq()}: say OK` }] });
    results.push(['3 ddg dead-model', `status=${r.status} code=${r.json?.error?.code ?? 'n/a'} cached=${r.json?.cached} msg=${(r.json?.error?.message || r.json?.choices?.[0]?.message?.content || '').slice(0, 70)}`]);
  }

  // 4. Health probe endpoints.
  {
    const h0 = await get('/api/health');
    results.push(['4a GET /api/health', `status=${h0.status} probeable=${h0.json?.probeable?.length} entries=${Object.keys(h0.json?.health || {}).length}`]);
    const one = await post('/api/health/probe/openrouter', {});
    const r1 = one.json?.result || {};
    results.push(['4b probe/openrouter', `status=${one.status} ok=${r1.ok} needsKey=${r1.needsKey} lat=${r1.latencyMs} err=${String(r1.error || r1.sample || '').slice(0, 60)}`]);
    const two = await post('/api/health/probe/duckduckgo', {});
    const r2 = two.json?.result || {};
    results.push(['4c probe/duckduckgo', `status=${two.status} ok=${r2.ok} err=${String(r2.error || r2.sample || '').slice(0, 60)}`]);
  }

  // 5. Cache stats endpoint.
  {
    const c = await get('/api/cache');
    results.push(['5 GET /api/cache', `status=${c.status} body=${JSON.stringify(c.json).slice(0, 120)}`]);
  }

  // 6. /v1/models carries status metadata.
  {
    const m = await get('/v1/models');
    const sample = (m.json?.data || []).filter(x => x.wenker_status).slice(0, 2).map(x => `${x.id}:${x.wenker_status}`);
    results.push(['6 /v1/models status', `status=${m.status} total=${m.json?.data?.length} sample=${sample.join(' ')}`]);
  }

  console.log('\n===== E2E RESULTS =====');
  for (const [k, v] of results) console.log(k.padEnd(24), '|', v);
})();
