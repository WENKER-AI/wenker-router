// Verify the honest-routing fixes end to end.
const BASE = 'http://localhost:3600';

async function main() {
  // 1. /v1/models must expose wenker_served_by (the REAL upstream model per alias)
  const models = await (await fetch(`${BASE}/v1/models`)).json();
  const alias = models.data.find(m => m.id === 'wenker-cloud/wenker-deepseek-r1-free');
  console.log('[1] /v1/models alias:', JSON.stringify({
    id: alias?.id, display: alias?.wenker_display_name, served_by: alias?.wenker_served_by
  }));

  // 2. Keyless provider must now answer 401 (was: silent 200 from wenker-cloud)
  const r2 = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-wenker-free-playground' },
    body: JSON.stringify({ model: 'github-models/DeepSeek-R1', messages: [{ role: 'user', content: 'hi' }] })
  });
  const j2 = await r2.json();
  console.log('[2] github-models (no key):', r2.status, j2.error?.code, '|', (j2.error?.message || '').slice(0, 90));

  const r3 = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-wenker-free-playground' },
    body: JSON.stringify({ model: 'bytedance-doubao/doubao-pro-32k', messages: [{ role: 'user', content: 'hi' }] })
  });
  const j3 = await r3.json();
  console.log('[3] bytedance-doubao (no key):', r3.status, j3.error?.code);

  // 4. A wenker-cloud alias still works and reports the real serving model
  const r4 = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-wenker-free-playground' },
    body: JSON.stringify({ model: 'wenker-cloud/wenker-deepseek-r1-free', messages: [{ role: 'user', content: 'say OK' }], max_tokens: 8 })
  });
  const j4 = await r4.json();
  console.log('[4] wenker-cloud alias:', r4.status, '| served_by:', j4.wenker_served_by, '| content:', JSON.stringify((j4.choices?.[0]?.message?.content || '').slice(0, 40)));

  // 5. Logs must record the truth: 401 rows for keyless, real model for alias
  const logs = await (await fetch(`${BASE}/api/logs?limit=6`)).json();
  for (const l of (Array.isArray(logs) ? logs : logs.logs || []).slice(0, 6)) {
    console.log('[5]', new Date(l.timestamp).toLocaleTimeString(), l.model, '->', 'prov=' + l.providerId, 'served=' + l.resolvedModel, 'status=' + l.status, l.fallbackFrom ? `FB from ${l.fallbackFrom}` : '');
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
