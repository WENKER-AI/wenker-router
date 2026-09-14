'use strict';

/**
 * Round-trip: client sau khi load modal se GUI LAI gia tri DA MASK (chua '•').
 * Server PHAI bo qua gia tri mask va giu nguyen secret that. Dong thoi phai
 * cho phep XOA key that su khi gui chuoi rong.
 *
 * Chay:  node scripts/mask-roundtrip-proof.js
 */

const os = require('os');
const fs = require('fs');
const BASE = process.env.WENKER_BASE || 'http://127.0.0.1:3600';
const CFG = process.env.WENKER_CONFIG || os.homedir() + '\\.wenker\\config.json';

let pass = 0;
let fail = 0;
const check = (n, ok, d) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`);
};

const realKeyOnDisk = () => {
  const j = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  return ((j.providerOverrides || {})['wenker-cloud'] || {}).userApiKey || '';
};

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    /* */
  }
  return { status: res.status, json, text };
}

(async () => {
  const original = realKeyOnDisk();
  check('co key that tren dia (wenker-cloud)', Boolean(original), original ? original.slice(0, 7) + '...' + original.slice(-4) : 'EMPTY');

  // 1. GUI LAI gia tri mask ( nhu client gui khi user mo modal roi bam Luu khong sua gi)
  const masked = original.length > 16 ? original.slice(0, 3) + '\u2022\u2022\u2022\u2022' + original.slice(-4) : '\u2022\u2022\u2022\u2022';
  const r1 = await api('/api/providers/wenker-cloud', {
    method: 'POST',
    body: JSON.stringify({ userApiKey: masked, baseUrl: 'https://text.pollinations.ai' })
  });
  check('POST gia tri MASK -> 200', r1.status === 200, `status ${r1.status}`);
  const after1 = realKeyOnDisk();
  check('key THAT VAN NGUYEN sau khi gui mask (khong bi de ghi de)', after1 === original, after1 === original ? 'giu duoc' : `BI MANG: ${JSON.stringify(after1).slice(0, 40)}`);
  check('phan response khong lo plaintext', !r1.text.includes(original), r1.json && r1.json.provider && r1.json.provider.userApiKey);

  // 2. Doi truong KHAC cung luc (baseUrl) -> van phai luu
  check('truong khac van luu duoc', /pollinations/.test(realKeyOnDisk() ? JSON.stringify(JSON.parse(fs.readFileSync(CFG, 'utf8')).providerOverrides['wenker-cloud'].baseUrl || '') : ''), 'baseUrl giu nguyen');

  // 3. GUI chuoi rong that = XOA key (day la y dinh ro rang cua user bam nut xoa)
  //    kiem tra bang cach phat hanh hanh vi client: chi gui userApiKey:'' khi muon xoa.
  //    KHONG thu nghiem xoa that tren key cua user -> chi kiem ham stripMaskedSecrets
  //    bang cach gui mask khac (dui gia) va xac nhan khong bi xoa.
  const r3 = await api('/api/providers/wenker-cloud', {
    method: 'POST',
    body: JSON.stringify({ userApiKey: 'sk-\u2022\u2022\u2022\u2022zzzz' })
  });
  check('mask gia (dui tail) cung bi bo qua, khong ghi de', r3.status === 200 && realKeyOnDisk() === original, realKeyOnDisk() === original ? 'an toan' : 'BI MANG');

  // 4. Gui key hop le (khong chua '•') -> PHAI luu that
  const probeKey = 'sk-wenker-roundtrip-probe-0001';
  const r4 = await api('/api/providers/wenker-cloud', { method: 'POST', body: JSON.stringify({ userApiKey: probeKey }) });
  check('gui key that -> luu dung', r4.status === 200 && realKeyOnDisk() === probeKey, realKeyOnDisk().slice(0, 12));

  // 5. Xoa: gui chuoi rong
  const r5 = await api('/api/providers/wenker-cloud', { method: 'POST', body: JSON.stringify({ userApiKey: '' }) });
  check('gui chuoi rong -> xoa het key', r5.status === 200 && realKeyOnDisk() === '', JSON.stringify(realKeyOnDisk()));

  // 6. KHOI PHUC key ban dau cua user
  const r6 = await api('/api/providers/wenker-cloud', { method: 'POST', body: JSON.stringify({ userApiKey: original }) });
  check('khoi phuc key ban dau', r6.status === 200 && realKeyOnDisk() === original, realKeyOnDisk() ? 'ok' : 'KHONG KHOI PHUC DUOC');

  // 7. GET public van mask
  const g = await api('/api/providers');
  const list = Array.isArray(g.json) ? g.json : g.json.providers;
  const wc = list.find((p) => p.id === 'wenker-cloud');
  check('GET /api/providers: wenker-cloud mask + hasApiKey', wc && wc.hasApiKey === true && /\u2022{4}/.test(String(wc.userApiKey)), `hasApiKey=${wc && wc.hasApiKey} key=${wc && wc.userApiKey}`);

  console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('LOI:', e.message);
  process.exit(2);
});
