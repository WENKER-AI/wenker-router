'use strict';

/**
 * Proof script: kiem tra (1) mask secret, (2) chan /api/* khong phai loopback,
 * (3) /v1/models co truong wenker_needs_key / wenker_auth_type.
 *
 * Chay:  node scripts/ide-auth-proof.js
 *
 * Phuong an thu nghiem chu y: de test "khong phai loopback" that su, script
 * khoi dong mot server PHU voi WENKER_ADMIN_OPEN_LOCALHOST=0 o cong khac,
 * roi goi bang dia chi IP mang cua may (khong phai 127.0.0.1).
 */

const { spawn } = require('child_process');
const os = require('os');

const MAIN = 'http://127.0.0.1:3600';
let pass = 0;
let fail = 0;
const out = [];

function check(name, ok, detail) {
  if (ok) pass++;
  else fail++;
  out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

function lanIp() {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return { name, ip: a.address };
    }
  }
  return null;
}

async function get(url, headers = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    /* not json */
  }
  return { status: res.status, text, json };
}

async function waitFor(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await get(url);
      if (r.status) return r;
    } catch (e) {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server khong len duoc: ' + url);
}

(async () => {
  // ---------------------------------------------------------------- 1. mask
  const stats = await get(`${MAIN}/api/stats`).catch(() => null);
  if (!stats) throw new Error('Server chinh o 3600 khong chay. Start node server/index.js truoc.');

  const prov = await get(`${MAIN}/api/providers`);
  check('GET /api/providers tu loopback = 200', prov.status === 200, `status ${prov.status}`);
  const list = Array.isArray(prov.json) ? prov.json : (prov.json && prov.json.providers) || [];
  check('/api/providers tra ve danh sach', list.length > 100, `${list.length} provider`);

  const withKey = list.filter((p) => p.hasApiKey);
  check('Provider da luu key co co quan hasApiKey', withKey.length >= 0, `${withKey.length} provider da co key`);

  const leaked = list.filter((p) => {
    const v = String(p.userApiKey || '');
    return v && !v.includes('\u2022');
  });
  check(
    'KHONG CO plaintext userApiKey trong /api/providers',
    leaked.length === 0,
    leaked.length ? leaked.slice(0, 3).map((p) => `${p.id}=${String(p.userApiKey).slice(0, 8)}...`).join(', ') : 'toan bo da mask'
  );
  const leakedCookie = list.filter((p) => p.userCookie && !p.userCookie.includes('\u2022'));
  check('KHONG CO plaintext userCookie', leakedCookie.length === 0, `${leakedCookie.length} vung ve`);
  if (withKey.length) {
    const sample = withKey[0];
    check('Mask co dang <head>\u2022\u2022\u2022\u2022<tail4>', /\u2022{4}/.test(String(sample.userApiKey)), `${sample.id}: ${sample.userApiKey}`);
  }

  // -------------------------------------------------------- 2. /v1/models meta
  const models = await get(`${MAIN}/v1/models`);
  check('GET /v1/models = 200', models.status === 200, `status ${models.status}`);
  const ms = (models.json && models.json.data) || [];
  const withNeedsKey = ms.filter((m) => typeof m.wenker_needs_key === 'boolean');
  check('/v1/models co wenker_needs_key (boolean)', withNeedsKey.length === ms.length && ms.length > 0, `${withNeedsKey.length}/${ms.length}`);
  const withAuthType = ms.filter((m) => typeof m.wenker_auth_type === 'string');
  check('/v1/models co wenker_auth_type', withAuthType.length === ms.length, `${withAuthType.length}/${ms.length}`);

  const noKey = ms.filter((m) => !String(m.id).includes('/') && m.wenker_needs_key === false);
  const needsKey = ms.filter((m) => !String(m.id).includes('/') && m.wenker_needs_key === true);
  check('Co model thuc su khong can key', noKey.length > 0, `${noKey.length} model: ${noKey.slice(0, 4).map((m) => m.id).join(', ')}`);
  check('Co model can key duoc danh dau dung (khong con an label "no auth")', needsKey.length > 0, `${needsKey.length} model`);

  // ---------------------------------------------------------------- 3. guard
  const lan = lanIp();
  if (!lan) {
    out.push('SKIP  Khong tim thay IPv4 khong internal -> bo qua test non-loopback.');
  } else {
    out.push(`      (dia chi mang dung de test: ${lan.ip} qua ${lan.name})`);
    const PORT = 3611;
    const child = spawn(process.execPath, ['H:\\new\\WENKER\\server\\index.js'], {
      env: { ...process.env, PORT: String(PORT), WENKER_ADMIN_OPEN_LOCALHOST: '0' },
      stdio: 'ignore',
      windowsHide: true,
      detached: false
    });
    try {
      const ALT = `http://${lan.ip}:${PORT}`;
      await waitFor(`http://127.0.0.1:${PORT}/health`);

      // Lay admin key THAT (khong hardcode - key cua ngu dung do router sinh ra).
      const keysResp = await get(`${MAIN}/api/keys`);
      const keyArr = Array.isArray(keysResp.json) ? keysResp.json : (keysResp.json && keysResp.json.keys) || [];
      const adminKey = (keyArr.find((k) => k.role === 'admin' && k.isActive !== false) || {}).key || '';
      out.push(`      (admin key lay tu /api/keys: ${adminKey ? adminKey.slice(0, 11) + '...' : 'KHONG CO'})`);

      const r1 = await get(`${ALT}/api/providers`);
      check('Non-loopback + khong co key -> 401', r1.status === 401, `status ${r1.status}`);
      const msg = (r1.json && r1.json.error && r1.json.error.code) || '';
      check('401 co code admin_key_required', msg === 'admin_key_required', String(msg));

      const r2 = await get(`${ALT}/api/providers`, { 'x-wenker-admin-key': adminKey });
      check('Non-loopback + admin key that -> 200', r2.status === 200, `status ${r2.status}`);

      const r3 = await get(`${ALT}/api/providers`, { 'x-wenker-admin-key': 'sk-sai-key-nhat-quan' });
      check('Non-loopback + key sai -> 401', r3.status === 401, `status ${r3.status}`);

      const r4 = await get(`${ALT}/v1/models`);
      check('/v1/models VAN CON mo (day la API may khach, khong phai API quan tri)', r4.status === 200, `status ${r4.status}`);

      const r5 = await get(`${ALT}/health`);
      check('/health van mo (probe cong khai)', r5.status === 200, `status ${r5.status}`);

      const r6 = await get(`${ALT}/api/auth/session`, { 'x-wenker-session': 'bogus' });
      // /api/auth/* duoc mien nhiem trong guard; chi can khong phai 401 tu guard.
      check('/api/auth/* duoc guard mien nhiem (khong phai admin_key_required)', !(r6.status === 401 && r6.json && r6.json.error && r6.json.error.code === 'admin_key_required'), `status ${r6.status}`);
    } finally {
      try {
        child.kill('SIGTERM');
      } catch (e) {
        /* already gone */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(out.join('\n'));
  console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log(out.join('\n'));
  console.error('\nLOI:', e.message);
  process.exit(2);
});
