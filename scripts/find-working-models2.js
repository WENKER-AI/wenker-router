/*
 * Do LAN 2: tai sao cung 1 model luc tra loi that, luc tra "reached its budget"?
 * Nghi van: (a) do goi dong lot (CONC=6) gay rate limit, (b) do prompt dai
 * (prompt tren = 309 token vi co he thong nhan cua router), (c) do fallback
 * chain doi sang model khac.
 * Cach do: TUAN TU (CONC=1), khong he thong nhan, prompt NGAN, va phan loai
 * noi dung tra ve = "that" hay "tu choi".
 */
const http = require('http');
const BASE = { host: '127.0.0.1', port: 3600 };

function req(method, path, body, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        ...BASE,
        method,
        path,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
          : {},
        timeout: timeoutMs || 60000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch (e) {}
          resolve({ status: res.statusCode, text: buf, json, ms: Date.now() - t0 });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, text: e.code || e.message, json: null, ms: Date.now() - t0 }));
    r.on('timeout', () => {
      r.destroy();
      resolve({ status: -1, text: 'timeout', json: null, ms: Date.now() - t0 });
    });
    if (data) r.write(data);
    r.end();
  });
}

const REFUSAL = /reached its budget|payment required|rate limit|too many requests|quota|invalid api key|no healthy upstream|is unavailable|not authorized/i;

function contentOf(r) {
  if (r.json && r.json.choices && r.json.choices[0]) {
    const c = r.json.choices[0];
    if (c.message && typeof c.message.content === 'string') return c.message.content;
    if (typeof c.text === 'string') return c.text;
  }
  return '';
}

async function main() {
  const m = await req('GET', '/v1/models');
  const all = m.json.data.filter((x) => x.id && !x.id.includes('/'));
  // Lay dai dien moi nhom provider, uu tien khong can key
  const byProv = new Map();
  for (const x of all) {
    const p = x.wenker_provider || '?';
    if (!byProv.has(p)) byProv.set(p, []);
    byProv.get(p).push(x);
  }
  const picked = [];
  for (const [p, list] of byProv) {
    list.sort((a, b) => (a.wenker_needs_key === false ? 0 : 1) - (b.wenker_needs_key === false ? 0 : 1));
    picked.push(list[0]);
  }
  console.log('Thu ' + picked.length + ' model (moi nhom 1 model), TUAN TU, prompt ngan "hi".\n');

  const real = [];
  const refused = [];
  const dead = [];
  for (const model of picked) {
    const r = await req('POST', '/v1/chat/completions', {
      model: model.id,
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      max_tokens: 40,
    });
    const c = contentOf(r).trim();
    const served = r.json && r.json.model;
    let verdict;
    if (r.status !== 200 || !c) {
      verdict = 'CHET';
      dead.push({ id: model.id, prov: model.wenker_provider, why: 'HTTP ' + r.status + ' ' + r.text.slice(0, 70) });
    } else if (REFUSAL.test(c)) {
      verdict = 'TU CHOI';
      refused.push({ id: model.id, prov: model.wenker_provider, served, txt: c.replace(/\s+/g, ' ').slice(0, 70) });
    } else {
      verdict = 'SONG';
      real.push({ id: model.id, prov: model.wenker_provider, served, txt: c.replace(/\s+/g, ' ').slice(0, 70), ms: r.ms });
    }
    console.log(
      verdict.padEnd(9) + model.id.padEnd(30) +
        '[' + String(model.wenker_provider).padEnd(19) + '] ' +
        String(r.ms).padStart(6) + 'ms  ' +
        (served && served !== model.id ? '(phuc vu: ' + served + ') ' : '') +
        (c ? '"' + c.replace(/\s+/g, ' ').slice(0, 60) + '"' : r.text.slice(0, 60))
    );
  }

  console.log('\n============ TONG KET (prompt ngan, tuan tu) ============');
  console.log('MAI MAI TRA LOI THAT : ' + real.length);
  real.forEach((x) => console.log('   ' + x.id + '   (' + x.prov + ', ' + x.ms + 'ms)  "' + x.txt + '"'));
  console.log('\nBI TU CHOI (upstream from choi) : ' + refused.length);
  refused.forEach((x) => console.log('   ' + x.id + '   (' + x.prov + ')  ' + x.txt));
  console.log('\nCHET HAN : ' + dead.length);
  dead.forEach((x) => console.log('   ' + x.id + '   (' + x.prov + ')  ' + x.why));
}
main().catch((e) => console.log('FATAL', e));
