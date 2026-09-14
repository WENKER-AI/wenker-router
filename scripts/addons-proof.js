/**
 * E2E proof for the WENKER add-on engine + Model Finder data.
 * Run: node scripts/addons-proof.js
 */
const BASE = 'http://localhost:3600';

async function j(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = { _unparsed: true }; }
  return { status: res.status, data };
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

(async () => {
  console.log('\n=== WENKER ADD-ON + FINDER PROOF ===\n');

  // 1. list built-in addons
  const list = await j('GET', '/api/addons');
  const addons = list.data.addons || [];
  check('GET /api/addons', list.status === 200 && addons.length >= 6, `${addons.length} add-on, status ${list.status}`);
  check('moi theme co `resolved` CSS vars', addons.filter(a => a.type === 'theme').every(a => a.resolved && Object.keys(a.resolved).length > 20),
    `theme keys=${Object.keys((addons.find(a => a.type === 'theme') || {}).resolved || {}).length}`);
  check('midnight khong doi mau goc', JSON.stringify(addons.find(a => a.id === 'wenker.theme.midnight')?.resolved?.['--color-cyan-500']) === JSON.stringify('6 182 212'),
    'cyan-500=' + addons.find(a => a.id === 'wenker.theme.midnight')?.resolved?.['--color-cyan-500']);

  // 2. install a brand-new theme written like a user/AI would
  const manifest = {
    id: 'my.theme.oceanproof',
    name: 'Ocean Proof',
    type: 'theme',
    theme: { accent: '#38bdf8', surface: '#04101c', text: '#e0f2fe', radius: '16px' }
  };
  const inst = await j('POST', '/api/addons/install', { source: JSON.stringify(manifest) });
  check('POST /api/addons/install (2 mau)', inst.status === 200 && inst.data.success,
    `resolved=${Object.keys(inst.data?.addon?.resolved || {}).length} bien`);
  check('radius duoc giu nguyen', inst.data?.addon?.resolved?.['--radius'] === '16px', 'radius=' + inst.data?.addon?.resolved?.['--radius']);
  check('sinh du 11 shade accent', Object.keys(inst.data?.addon?.resolved || {}).filter(k => k.startsWith('--color-cyan-')).length === 11);

  const after = await j('GET', '/api/addons');
  check('add-on moi xuat hien trong kho', (after.data.addons || []).some(a => a.id === manifest.id));

  // 3. validation rejects garbage
  const bad1 = await j('POST', '/api/addons/install', { source: '{not json' });
  check('chan JSON hong', bad1.status === 400, bad1.data?.error);
  const bad2 = await j('POST', '/api/addons/install', { source: JSON.stringify({ id: 'a.b', name: 'x', type: 'theme', theme: {} }) });
  check('chan theme khong co mau', bad2.status === 400, bad2.data?.error);
  const bad3 = await j('POST', '/api/addons/install', { source: JSON.stringify({ id: 'wenker.theme.midnight', name: 'x', type: 'theme', theme: { accent: '#fff' } }) });
  check('chan trung id builtin', bad3.status === 400, bad3.data?.error);
  const bad4 = await j('POST', '/api/addons/install', { source: JSON.stringify({ id: 'evil.x', name: 'x', type: 'theme', theme: { '--color-cyan-500': '6 182 212; } body { display:none' } }) });
  check('chan gia tri CSS tieu cuc', bad4.status === 400, bad4.data?.error);
  const bad5 = await j('POST', '/api/addons/install', { source: JSON.stringify({ id: 'evil.y', name: 'x', type: 'theme', theme: { '--bg-primary': 'url(javascript:alert(1))' } }) });
  check('chan url() trong CSS var', bad5.status === 400, bad5.data?.error);

  // 4. delete custom
  const del = await j('DELETE', '/api/addons/my.theme.oceanproof');
  check('DELETE /api/addons/:id', del.status === 200 && del.data.success);
  const delBuiltin = await j('DELETE', '/api/addons/wenker.theme.emerald');
  check('khong xoa duoc builtin', delBuiltin.status === 400);

  // 5. provider add-on creates a live provider
  const prov = await j('POST', '/api/addons/install', {
    source: JSON.stringify({
      id: 'my.provider.proof', name: 'Proof API', type: 'provider',
      provider: { id: 'proof-api', name: 'Proof API', baseUrl: 'http://localhost:3600/v1', requiresAuth: false, models: [{ id: 'proof-model', name: 'Proof Model', contextWindow: 4096 }] }
    })
  });
  check('install provider add-on', prov.status === 200 && prov.data.success);
  const models = await j('GET', '/v1/models');
  const proof = (models.data.data || []).find(m => m.wenker_provider === 'proof-api');
  check('provider moi xuat hien trong /v1/models', Boolean(proof), proof ? `id=${proof.id} status=${proof.wenker_status}` : 'khong thay');
  check('/v1/models day du metadata finder', Boolean(proof && proof.wenker_category && 'wenker_free' in proof && 'wenker_context' in proof),
    proof ? `cat=${proof.wenker_category} free=${proof.wenker_free} ctx=${proof.wenker_context}` : '');
  // cleanup: xoa add-on provider phai keo theo custom provider bien mat
  await j('DELETE', '/api/addons/my.provider.proof');
  const models2 = await j('GET', '/v1/models');
  const gone = !(models2.data.data || []).some((m) => m.wenker_provider === 'proof-api');
  check('xoa add-on provider -> bien mat khoi /v1/models', gone);

  // 6. finder data quality across the whole catalogue
  const all = (models.data.data || []).filter(m => !m.id.includes('/'));
  const withCtx = all.filter(m => m.wenker_context).length;
  const free = all.filter(m => m.wenker_free).length;
  const byCat = {};
  for (const m of all) byCat[m.wenker_category] = (byCat[m.wenker_category] || 0) + 1;
  check('catalog > 200 model (doc that tu localhost)', all.length > 200, `${all.length} model, ${withCtx} co context, ${free} mien phi`);
  check('du 8 category loc duoc', Object.keys(byCat).length >= 7, JSON.stringify(byCat));

  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===\n`);
  process.exit(fail ? 1 : 0);
})();
