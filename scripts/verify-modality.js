// Kiểm chứng hành vi đầu-cuối sau khi thêm modality guard + failover refusal guard.
// Đọc admin key từ GET /api/keys (mảng trần), gọi /v1/chat/completions cho vài model.
const http = require('http');

function req(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const r = http.request({ host: '127.0.0.1', port: 3600, path, method, headers: h }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(30000, () => {
      r.destroy();
      resolve({ status: -1, body: 'timeout' });
    });
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const keys = await req('GET', '/api/keys', {}, null);
  let kj;
  try {
    kj = JSON.parse(keys.body);
  } catch {
    kj = null;
  }
  const arr = Array.isArray(kj) ? kj : kj && kj.keys || [];
  const admin = arr.find((k) => k.role === 'admin' && k.isActive !== false);
  if (!admin) {
    console.log('KHONG co admin key', keys.status, keys.body.slice(0, 200));
    return;
  }
  const A = { 'x-wenker-admin-key': admin.key };
  console.log('admin key name:', admin.name);

  const cases = [
    ['midjourney-proxy/default', 'IMAGE -> phai 400 unsupported_modality'],
    ['sora-openai-preview/default', 'VIDEO -> phai 400 unsupported_modality'],
    ['elevenlabs-voice/default', 'AUDIO -> phai 400 unsupported_modality'],
    ['whisper-local/default', 'STT -> phai 400 unsupported_modality'],
    ['automatic1111-sd/default', 'IMAGE -> phai 400 unsupported_modality'],
    ['wenker-cloud/wenker-deepseek-v3-free', 'CHAT -> KHONG duoc 400 modality; phai 402/502 that'],
  ];
  for (const [model, note] of cases) {
    const r = await req('POST', '/v1/chat/completions', A, {
      model,
      messages: [{ role: 'user', content: 'hi' }],
    });
    let code = '';
    try {
      code = JSON.parse(r.body)?.error?.code || '';
    } catch (e) { /* ignore JSON parse error */ }
    const fake200 = r.status === 200 && /reached its budget|raise the budget/i.test(r.body);
    console.log(`\n[${model}]  ${note}`);
    console.log(`   HTTP ${r.status}  code=${code || '-'}  fake200=${fake200 ? 'BUG' : 'no'}`);
    console.log(`   body: ${r.body.replace(/\s+/g, ' ').slice(0, 180)}`);
  }
})();
