/**
 * test-proxy.js - kiem tra tinh nang di qua VPN/HTTP proxy cuc bo.
 *
 * Dung mot FAKE forward-proxy (HTTP server) phat tren 127.0.0.1:<freePort>.
 * Phan biet 2 loai yeu cau gui toi no:
 *   - absolute-form ("GET http://host/path"): do ProxyAgent gui -> = DI QUA PROXY.
 *   - origin-form   ("GET /path"):            goi truc tiep -> = KHONG qua proxy.
 * Tu do chung minh wrapper trong proxyFetch.js chon dung duong cho tung loai host.
 *
 * Chay:  node scripts/test-proxy.js   (exit 0 = PASS)
 */
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

let fails = 0;
function check(name, cond, extra) {
  const ok = Boolean(cond);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
}

(async () => {
  const root = path.join(__dirname, '..');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wenker-proxy-'));
  process.env.WENKER_HOME = home;

  // Fake proxy: gui den truoc khi require dbService (db doc config tu WENKER_HOME).
  const PORT = await findFreePort();
  const seen = { proxied: [], direct: [] };
  const sockets = new Set();
  const proxy = http.createServer((req, res) => {
    const absolute = /^https?:\/\//i.test(req.url);
    if (absolute) {
      const u = new URL(req.url);
      seen.proxied.push(req.url);
      req.resume();
      req.on('end', () => {
        if (u.host.includes('ifconfig.me')) {
          res.writeHead(200, { 'content-type': 'text/plain', 'x-via-proxy': '1' });
          res.end('203.0.113.9'); // IP mau de testProxy parse
        } else {
          res.writeHead(200, { 'content-type': 'text/plain', 'x-via-proxy': '1' });
          res.end('via-proxy:' + u.pathname);
        }
      });
    } else {
      seen.direct.push(req.url);
      req.resume();
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/plain', 'x-via-proxy': '0' });
        res.end('direct:' + req.url);
      });
    }
  });
  // undici ProxyAgent mao ket noi qua CONNECT tunnel (ca http lan https).
  // Sau khi tra 200, doc request origin-form ben trong tunnel va phan hoi nhu
  // mot proxy that, danh dau x-via-proxy:1 de chung minh duong di QUA proxy.
  proxy.on('connect', (req, socket, head) => {
    seen.proxied.push(req.url); // "host:port"
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    let buf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      socket.removeListener('data', onData);
      const firstLine = buf.slice(0, idx).toString('latin1').split('\r\n')[0];
      const m = firstLine.match(/^\S+\s+(\S+)/);
      const path = m ? m[1] : '/';
      const body = /ifconfig\.me/.test(req.url) ? '203.0.113.9' : 'via-proxy:' + path;
      socket.write(
        'HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\nx-via-proxy: 1\r\n' +
          'content-length: ' +
          Buffer.byteLength(body) +
          '\r\nconnection: close\r\n\r\n' +
          body,
      );
      socket.end();
    };
    socket.on('data', onData);
    socket.on('error', () => {});
  });
  await new Promise((r) => proxy.listen(PORT, '127.0.0.1', r));
  const proxyUrl = `http://127.0.0.1:${PORT}`;

  const db = require(path.join(root, 'server', 'services', 'dbService'));
  const proxyFetch = require(path.join(root, 'server', 'services', 'proxyFetch'));
  proxyFetch.install();

  // ---- 1. Unit: phan loai host ----
  check(
    'hostFromInput(Request)',
    proxyFetch.hostFromInput(new Request('http://api.openai.com/v1')) === 'api.openai.com',
  );
  check('hostFromInput(string)', proxyFetch.hostFromInput('https://groq.com/x') === 'groq.com');
  const np = ['localhost'];
  check('bypass 127.0.0.1', proxyFetch.shouldBypass('127.0.0.1', np) === true);
  check('bypass localhost', proxyFetch.shouldBypass('localhost', np) === true);
  check('bypass ::1', proxyFetch.shouldBypass('::1', np) === true);
  check('bypass 10.x', proxyFetch.shouldBypass('10.1.2.3', np) === true);
  check('bypass 192.168.x', proxyFetch.shouldBypass('192.168.0.5', np) === true);
  check('bypass 172.20.x', proxyFetch.shouldBypass('172.20.0.1', np) === true);
  check('bypass 172.32.x (KHONG private)', proxyFetch.shouldBypass('172.32.0.1', np) === false);
  check('bypass *.local', proxyFetch.shouldBypass('printer.local', np) === true);
  check(
    'bypass noProxy list',
    proxyFetch.shouldBypass('intranet.corp', ['intranet.corp']) === true,
  );
  check('khong bypass api.openai.com', proxyFetch.shouldBypass('api.openai.com', np) === false);

  // ---- 2. Tat proxy -> moi thu noi truc tiep (getAgent null) ----
  db.updateSettings({ proxyEnabled: false, proxyUrl, proxyNoProxy: 'localhost' });
  let directErr = null;
  try {
    await fetch('http://public.example/x');
  } catch (e) {
    directErr = e;
  }
  check(
    'proxy tat: public host khong di qua proxy (loi DNS thang)',
    directErr !== null,
    directErr && directErr.cause && directErr.cause.code,
  );

  // ---- 3. Bat proxy: public host -> QUA PROXY; private host -> THANG ----
  db.updateSettings({ proxyEnabled: true, proxyUrl, proxyNoProxy: 'localhost' });
  const pub = await fetch('http://public.example/proxied', {
    signal: AbortSignal.timeout(5000),
  }).catch((e) => ({ __err: e }));
  if (pub.__err) {
    check('proxy bat: public host di QUA proxy', false, 'TIMEOUT/ERR: ' + pub.__err.message);
  } else {
    const pubBody = await pub.text();
    check(
      'proxy bat: public host di QUA proxy',
      pub.headers.get('x-via-proxy') === '1' && pubBody === 'via-proxy:/proxied',
      pubBody,
    );
  }

  const loop = await fetch(`http://127.0.0.1:${PORT}/direct`, {
    signal: AbortSignal.timeout(5000),
  });
  const loopBody = await loop.text();
  check(
    'proxy bat: loopback van di THANG (x-via-proxy:0)',
    loop.headers.get('x-via-proxy') === '0' && loopBody === 'direct:/direct',
    loopBody,
  );

  check(
    'fake proxy thay request absolute-form',
    seen.proxied.some((u) => /public\.example/.test(u)),
  );
  check('fake proxy thay request origin-form (loopback thang)', seen.direct.includes('/direct'));

  // ---- 4. init dispatcher da co san -> wrapper khong ghi de ----
  const { ProxyAgent } = require('undici');
  const own = new ProxyAgent(proxyUrl);
  const withOwn = await fetch('http://public.example/own', {
    dispatcher: own,
    signal: AbortSignal.timeout(5000),
  }).catch(() => ({ headers: new Map() }));
  check('giu dispatcher cua caller', withOwn.headers.get('x-via-proxy') === '1');
  try {
    own.close();
  } catch (e) { /* ignore close error */ }

  // ---- 5. testProxy() tra IP qua proxy ----
  const t = await proxyFetch.testProxy(proxyUrl);
  check('testProxy OK + parse duoc IP', t.ok === true && t.ip === '203.0.113.9', JSON.stringify(t));
  const tbad = await proxyFetch.testProxy('not-a-url');
  check(
    'testProxy chan URL sai',
    tbad.ok === false && /khong hop le|not|http/i.test(tbad.error),
    tbad.error,
  );

  // ---- 6. reset() khong crash, pick up URL moi ----
  proxyFetch.reset();
  const afterReset = await fetch('http://public.example/after', {
    signal: AbortSignal.timeout(5000),
  }).catch(() => ({ headers: new Map() }));
  check(
    'sau reset() van di qua proxy (agent duoc tao lai)',
    afterReset.headers.get('x-via-proxy') === '1',
  );

  proxyFetch.reset();
  for (const s of sockets) {
    try {
      s.destroy();
    } catch (e) { /* ignore destroy error */ }
  }
  proxy.close();
  try {
    fs.rmSync(home, { recursive: true, force: true });
  } catch (e) { /* ignore cleanup error */ }
  console.log('\n== ' + (fails === 0 ? 'PROXY OK' : fails + ' FAIL') + ' ==');
  process.exitCode = fails === 0 ? 0 : 1;
  // Hoan 1 tick de cac handle uv (ProxyAgent pool) dong xong -> tranh
  // assertion libuv tren Windows khi process.exit() luc handle dang CLOSING.
  setTimeout(() => process.exit(process.exitCode), 150).unref();
})().catch((e) => {
  console.log('FAIL (crash): ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
