// Ap dung de xuat cua user: VIP -> izzi (key), basic -> xkiro (10 model song, key), community -> khoa.
// Key lay tu bien truong (KHONG hardcode trong file). Idempotent: chay nhieu lan khong tao trung.
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
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => {
        let j;
        try {
          j = JSON.parse(b);
        } catch {
          j = b;
        }
        resolve({ status: res.statusCode, json: j, body: b });
      });
    });
    r.on('error', (e) => resolve({ status: 0, json: null, body: String(e.message) }));
    r.setTimeout(15000, () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}
const IZZI = process.env.WK_IZZI_KEY;
const XKIRO = process.env.WK_XKIRO_KEY;
if (!IZZI || !XKIRO) {
  console.error('THIEU bien WK_IZZI_KEY / WK_XKIRO_KEY');
  process.exit(2);
}

// 10 model da duoc chung minh SONG qua xkiro (HTTP 200 co content) khi quet toan bo 83 model.
const XKIRO_MODELS = [
  'mistralai/codestral-2508',
  'mistralai/mistral-large-2512',
  'mistralai/mistral-medium-3.5',
  'mistralai/mistral-small-2603',
  'mistralai/devstral-medium',
  'mistralai/ministral-14b',
  'mistralai/ministral-8b',
  'mistralai/ministral-3b',
  'sensenova/sensenova-6.8-flash-lite',
  'sensenova/sensenova-6.7-flash-lite',
].map((id) => ({ id, name: 'Xkiro ' + id.split('/').pop(), contextWindow: 32000, isFree: true }));

// VIP = izzi. Model id la alias (khong dau '/'), targetModel la slug THAT cua izzi
// (duoc phan giai qua resolveProviderAndModel buoc 2 moi).
const IZZI_MODELS = [
  {
    id: 'wenker-vip-deepseek',
    name: 'WENKER VIP DeepSeek V4 Flash',
    contextWindow: 64000,
    isFree: false,
    targetModel: 'deepseek-v4-flash',
  },
  {
    id: 'wenker-vip-gpt4o-mini',
    name: 'WENKER VIP GPT-4o mini',
    contextWindow: 128000,
    isFree: false,
    targetModel: 'gpt-4o-mini',
  },
  {
    id: 'wenker-vip-gemini-flash',
    name: 'WENKER VIP Gemini 2.5 Flash',
    contextWindow: 1000000,
    isFree: false,
    targetModel: 'gemini-2.5-flash',
  },
];

(async () => {
  const keys = await call('GET', '/api/keys', {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : keys.json?.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  const A = { 'x-wenker-admin-key': admin.key };

  // --- XKIRO (basic) : custom provider, chi them 1 lan ---
  const provs = await call('GET', '/api/providers', A, null);
  const list = provs.json?.providers || [];
  const hasXkiro = list.some((p) => p.id === 'xkiro-basic');
  if (!hasXkiro) {
    const r = await call('POST', '/api/providers/custom/add', A, {
      id: 'xkiro-basic',
      name: 'WENKER Basic (xkiro)',
      baseUrl: 'https://api.xkiro.com/v1',
      authType: 'bearer',
      userApiKey: XKIRO,
      isFree: true,
      requiresAuth: true,
      website: 'https://xkiro.com',
      description: 'Nha cung cap basic nhieu model, thay the Pollinations cho WENKER Cloud.',
      models: XKIRO_MODELS,
    });
    console.log('tao xkiro-basic ->', r.status, r.json?.success ? 'OK' : r.body);
  } else {
    const u = await call('POST', '/api/providers/xkiro-basic', A, {
      userApiKey: XKIRO,
      models: XKIRO_MODELS,
      enabled: true,
    });
    console.log('cap nhat xkiro-basic ->', u.status);
  }

  // --- VIP -> izzi : override provider wenker-vip ---
  const v = await call('POST', '/api/providers/wenker-vip', A, {
    baseUrl: 'https://api.izziapi.com/v1',
    authType: 'bearer',
    userApiKey: IZZI,
    requiresAuth: true,
    enabled: true,
    models: IZZI_MODELS,
    description: 'WENKER VIP High Speed - nguon izzi (can nap du so de dung).',
  });
  console.log('wenker-vip -> izzi ->', v.status, v.json?.success ? 'OK' : v.body);

  // --- community : KHÓA ---
  const c = await call('POST', '/api/providers/wenker-community', A, { enabled: false });
  console.log('wenker-community disabled ->', c.status);

  // --- routing: default van la openrouter (ANG CHAY THAT); fallbackOrder cap nhat ---
  const s = await call('POST', '/api/settings', A, {
    enableSmartFallback: true,
    fallbackOrder: [
      'openrouter',
      'xkiro-basic',
      'wenker-vip',
      'wenker-cloud',
      'groq',
      'google-gemini',
      'nim-nvidia',
      'duckduckgo',
      'pollinations',
    ],
  });
  console.log('settings/fallbackOrder ->', s.status);

  // --- doc lai de xac nhan ---
  const after = await call('GET', '/api/providers', A, null);
  const al = after.json?.providers || [];
  for (const id of ['xkiro-basic', 'wenker-vip', 'wenker-community']) {
    const p = al.find((x) => x.id === id);
    console.log(
      `  [${id}] enabled=${p?.enabled} baseUrl=${p?.baseUrl} hasKey=${p?.hasApiKey} models=${(p?.models || []).length}`,
    );
  }
})();
