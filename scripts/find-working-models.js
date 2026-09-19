/*
 * Do that nao THAT SU that: go /v1/chat/completions that len tung model
 * va bao cao model nao tra ve loi, model nao chet, model nao can key.
 * Khong dua vao probe hay co ky nao - chi tin vao noi dung tra ve.
 */
const http = require('http');

const BASE = { host: '127.0.0.1', port: 3600 };
const PROMPT = process.argv[2] || 'Noi 1 cau that ngan ve troi.';
const LIMIT = parseInt(process.argv[3] || '24', 10);
const CONC = 6;

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
        timeout: timeoutMs || 45000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => buf += c);
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch (e) {
            /* khong phai json */
          }
          resolve({ status: res.statusCode, text: buf, json, ms: Date.now() - t0 });
        });
      },
    );
    r.on('error', (e) =>
      resolve({ status: 0, text: e.code || e.message, json: null, ms: Date.now() - t0 }),
    );
    r.on('timeout', () => {
      r.destroy();
      resolve({ status: -1, text: 'timeout', json: null, ms: Date.now() - t0 });
    });
    if (data) r.write(data);
    r.end();
  });
}

// Lay noi dung thong nhat tu 1 response (hoac SSE chuoi)
function extractText(status, text, json) {
  if (json && json.choices && json.choices[0]) {
    const c = json.choices[0];
    if (c.message && typeof c.message.content === 'string') return c.message.content;
    if (typeof c.text === 'string') return c.text;
  }
  // SSE: ghep cac delta
  if (text.includes('data:')) {
    let out = '';
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const o = JSON.parse(payload);
        const d = o.choices && o.choices[0];
        if (d) out += d.delta && d.delta.content || d.text || '';
      } catch (e) {
        /* chunk chua du */
      }
    }
    if (out) return out;
  }
  return '';
}

function errHint(status, text, json) {
  const t = (text || '').toLowerCase();
  if (status === 0) return 'khong ket noi duoc (' + (json || text) + ')';
  if (t.includes('budget')) return 'UPSTREAM het budget';
  if (t.includes('payment required') || status === 402) return 'UPSTREAM 402 (het tien/budget)';
  if (status === 401) return 'UPSTREAM 401 (can key)';
  if (status === 403) return 'UPSTREAM 403 (bi chan)';
  if (status === 429) return 'UPSTREAM 429 (rate limit)';
  if (t.includes('no healthy upstream')) return 'khong co upstream lanh';
  if (t.includes('not found') || status === 404) return 'model khong ton tai o router';
  if (status >= 500) return 'router/upstream 5xx';
  return 'HTTP ' + status;
}

async function main() {
  const m = await req('GET', '/v1/models');
  if (!m.json || !m.json.data) {
    console.log('KHONG lay duoc /v1/models:', m.status, m.text.slice(0, 200));
    return;
  }
  const all = m.json.data.filter((x) => x && x.id && !String(x.id).includes('/'));

  // Nhan dien theo nhom: model nao KHONG can key -> thu truoc
  const rank = (x) => x.wenker_needs_key === false ? 0 : x.wenker_free ? 1 : 2;
  const candidates = all
    .slice()
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, LIMIT);

  console.log(
    '/v1/models: ' +
      m.json.data.length +
      ' entry, ' +
      all.length +
      ' model tran. ' +
      'Thu ' +
      candidates.length +
      ' model (uu tien khong can key).\n',
  );

  const results = [];
  let i = 0;
  async function worker() {
    while (i < candidates.length) {
      const idx = i++;
      const model = candidates[idx];
      const r = await req('POST', '/v1/chat/completions', {
        model: model.id,
        messages: [{ role: 'user', content: PROMPT }],
        stream: false,
        max_tokens: 120,
      });
      const content = extractText(r.status, r.text, r.json).trim();
      const ok = r.status === 200 && content.length > 0;
      results[idx] = {
        id: model.id,
        provider: model.wenker_provider || '?',
        needsKey: model.wenker_needs_key,
        free: model.wenker_free,
        ok,
        ms: r.ms,
        len: content.length,
        preview: content.replace(/\s+/g, ' ').slice(0, 90),
        hint: ok ? '' : errHint(r.status, r.text, r.json),
      };
      const line =
        (ok ? 'OK   ' : 'FAIL ') +
        model.id.padEnd(38) +
        ' [' +
        (results[idx].provider + '').padEnd(20) +
        '] ' +
        String(r.ms).padStart(6) +
        'ms  ' +
        (ok ? '"' + results[idx].preview + '"' : results[idx].hint);
      console.log(line);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  const working = results.filter((r) => r.ok);
  console.log('\n================ KET LUAN ================');
  console.log('Model TRA LOI DUOC THAT: ' + working.length + ' / ' + results.length);
  for (const w of working) {
    console.log(
      '  ' + w.id + '   (' + w.ms + 'ms, ' + w.len + ' ky tu, provider=' + w.provider + ')',
    );
  }
  const byReason = {};
  for (const r of results) if (!r.ok) byReason[r.hint] = (byReason[r.hint] || 0) + 1;
  console.log('\nLY DO CHET:');
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + String(v).padStart(3) + ' x  ' + k);
  }
  const provAlive = new Set(working.map((w) => w.provider));
  console.log(
    '\nNHOM PROVIDER CON SONG THAT: ' + (provAlive.size ? [...provAlive].join(', ') : 'KHONG CO'),
  );
  console.log(
    '\n-> Copilot/Cline nen dung: ' +
      (working.length
        ? working.map((w) => w.id).join(' | ')
        : 'CHUA CO - can them API key mien phi (Groq/OpenRouter/Gemini) qua dashboard roi doi bo loc sang "all"'),
  );
}

main().catch((e) => console.log('FATAL', e));
