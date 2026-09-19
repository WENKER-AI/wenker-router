// Probe truc tiep 3 domain de xuat (khong qua router): DNS + GET /models + POST /chat/completions.
const https = require('https');
const dns = require('dns').promises;

function req(method, url, bodyObj, headers) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return resolve({ err: 'bad url ' + e.message });
    }
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({ 'User-Agent': 'WENKER-probe/1.0' }, headers || {});
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const r = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: h,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => b += c);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    r.on('error', (e) => resolve({ err: e.code || e.message }));
    r.setTimeout(20000, () => {
      r.destroy();
      resolve({ err: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}
const trim = (s, n) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

async function probe(name, base) {
  console.log(`\n########## ${name}  ${base}`);
  const host = new URL(base).hostname;
  // 1) DNS
  let ip = 'FAIL';
  try {
    const a = await dns.lookup(host);
    ip = a.address;
  } catch (e) {
    ip = 'NXDOMAIN/' + e.code;
  }
  console.log('  DNS:', host, '->', ip);
  if (ip.startsWith('NXDOMAIN') || ip === 'FAIL') {
    console.log('  ==> domain khong ton tai, bo qua.');
    return;
  }
  // 2) /models
  const m = await req('GET', base.replace(/\/+$/, '') + '/models', null, {});
  if (m.err) console.log('  GET /models -> ERR', m.err);
  else {
    let mj;
    try {
      mj = JSON.parse(m.body);
    } catch {
      mj = null;
    }
    const ids = (mj?.data || mj?.models || []).map((x) => x.id || x.name || x).slice(0, 12);
    console.log(
      `  GET /models -> HTTP ${m.status}  count=${(mj?.data || mj?.models || []).length}  mau: ${ids.join(', ') || trim(m.body, 120)}`,
    );
  }
  // 3) chat voi mot vai ten model nghi ngo
  const guessModels = [
    'deepseek-r1',
    'deepseek-r1-0528',
    'deepseek/deepseek-r1-0528:free',
    'gpt-4o-mini',
    'llama-3.3-70b-instruct',
    'default',
  ];
  const firstFromList = (() => {
    try {
      const mj = JSON.parse(m.body);
      return (mj?.data || mj?.models || [])[0]?.id || (mj?.data || mj?.models || [])[0]?.name;
    } catch {
      return null;
    }
  })();
  const tryList = firstFromList ? [firstFromList, ...guessModels] : guessModels;
  for (const model of tryList) {
    const r = await req(
      'POST',
      base.replace(/\/+$/, '') + '/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: 'Reply with exactly one word.' }],
        max_tokens: 20,
      },
      {},
    );
    if (r.err) {
      console.log(`  chat[${model}] -> ERR ${r.err}`);
      continue;
    }
    let j;
    try {
      j = JSON.parse(r.body);
    } catch {
      j = null;
    }
    const c = j?.choices?.[0]?.message?.content;
    const e = j?.error?.message || j?.message;
    console.log(
      `  chat[${model}] -> HTTP ${r.status}  ${c ? 'OK ' + JSON.stringify(trim(c, 40)) : 'NO-CONTENT ' + trim(e || r.body, 100)}`,
    );
    if (c) break; // co model nao tra loi duoc la du
  }
}
(async () => {
  await probe('lmmarketcap (VIP)', 'https://api.lmmarketcap.com/v1');
  await probe('xkiro (basic)', 'https://api.xkiro.com/v1');
  await probe('izzi (community)', 'https://api.izziapi.com/v1/');
})();
