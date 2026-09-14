/**
 * Outbound proxy support (VPN / HTTP proxy local).
 *
 * Nhieu nguoi chay WENKER sau mot VPN cong cuc bo (Clash, v2rayN, mihomo...) phat
 * HTTP proxy tren 127.0.0.1:7890 / :10809. Mac dinh Node `fetch` (undici) KHONG
 * doc bien HTTP_PROXY va cung khong tu di qua proxy do, nen moi request upstream
 * (OpenAI, Anthropic, Groq, OpenRouter...) bi chan. Module nay boc `globalThis.fetch`
 * MOT LAN de tat ca 8+ diem goi upstream trong router tu dong di qua proxy khi bat,
 * ma khong phai sua tung noi.
 *
 * An toan:
 *  - LUON bypass host vong ngoai/rieng tu (localhost, 127.x, 10.x, 192.168.x,
 *    172.16-31.x, ::1, *.local) -> Ollama / LM Studio / vLLM cuc bo khong bi day
 *    ra ngoai proxy (neu day ra la mat ket noi).
 *  - proxyUrl khong hop le / ProxyAgent loi -> tu dong quay ve ket noi truc tiep,
 *    khong lam chet request.
 *  - Chi ho tro HTTP/HTTPS proxy (pho bien nhat cua VPN local). SOCKS can rieng.
 *
 * Cach dung: server/index.js goi `require('./services/proxyFetch').install()` ngay
 * luc khoi dong; admin.js goi `reset()` sau khi luu settings de pick up doi thay.
 */
const { ProxyAgent } = require('undici');
const db = require('./dbService');

const nativeFetch = globalThis.fetch;

// Agent duoc cache theo proxyUrl (khi reset() thi clear).
let agentCache = new Map();
let installed = false;

const PRIVATE_RE = new RegExp(
  [
    '^localhost$',
    '^127(\\.\\d+){3}$',
    '^10(\\.\\d+){3}$',
    '^192\\.168(\\.\\d+){2}$',
    '^172\\.(1[6-9]|2\\d|3[01])(\\.\\d+){2}$',
    '^169\\.254(\\.\\d+){2}$',
    '^0\\.0\\.0\\.0$',
    '^::1$',
    '^f[cd][0-9a-f]{2}:', // IPv6 ULA fc00::/7
    '\\.local$'
  ].join('|'),
  'i'
);

function hostFromInput(input) {
  try {
    let raw;
    if (typeof input === 'string') raw = input;
    else if (input instanceof URL) raw = input.href;
    else if (input && typeof input.url === 'string') raw = input.url; // Request
    else return '';
    // Cho phep duong dan tuong doi ("", "/v1") -> khong co host -> bypass.
    const u = new URL(raw, 'http://127.0.0.1');
    return u.hostname;
  } catch (e) {
    return '';
  }
}

function parseNoProxy(list) {
  return String(list || '')
    .split(',')
    .map((s) => s.trim().replace(/^\*?\./, '').toLowerCase())
    .filter(Boolean);
}

function shouldBypass(host, noProxy) {
  if (!host) return true; // duong dan tuong doi / khong co host -> khong can proxy
  if (PRIVATE_RE.test(host)) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const lower = host.toLowerCase();
  for (const entry of noProxy) {
    if (lower === entry || lower.endsWith('.' + entry)) return true;
  }
  return false;
}

function getAgent(settings, host) {
  if (!settings || settings.proxyEnabled === false) return null;
  const proxyUrl = String(settings.proxyUrl || '').trim();
  if (!proxyUrl) return null;
  if (!/^https?:\/\//i.test(proxyUrl)) return null; // chi HTTP/HTTPS proxy
  const noProxy = parseNoProxy(settings.proxyNoProxy);
  if (shouldBypass(host, noProxy)) return null;
  if (!agentCache.has(proxyUrl)) {
    try {
      agentCache.set(proxyUrl, new ProxyAgent(proxyUrl));
    } catch (e) {
      console.warn(`[proxy] ProxyAgent("${proxyUrl}") khong khoi tao duoc (${e.message}); dung ket noi truc tiep.`);
      return null;
    }
  }
  return agentCache.get(proxyUrl);
}

/** Goi khi settings doi: dong agent cu de pick up proxyUrl moi / tat proxy. */
function reset() {
  for (const agent of agentCache.values()) {
    try { agent.close(); } catch (e) { /* best-effort */ }
  }
  agentCache = new Map();
}

function install() {
  if (installed || typeof nativeFetch !== 'function') return;
  installed = true;
  globalThis.fetch = function proxiedFetch(input, init) {
    try {
      const host = hostFromInput(input);
      const agent = getAgent(db.getSettings(), host);
      if (agent && (!init || init.dispatcher === undefined)) {
        init = Object.assign({}, init, { dispatcher: agent });
      }
    } catch (e) {
      // Khong bao gio de tinh nang proxy lam hong request: loi thi noi truc tiep.
    }
    return nativeFetch(input, init);
  };
}

/**
 * Thu proxy (du chua bat trong settings) bang cach goi mot endpoint phuc vu.
 * Tra ve { ok, ip, status, latencyMs, error }.
 */
async function testProxy(proxyUrl) {
  const url = String(proxyUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Proxy URL khong hop le (can bat dau bang http:// hoac https://).' };
  }
  let agent;
  try {
    agent = new ProxyAgent(url);
  } catch (e) {
    return { ok: false, error: `Khong tao duoc ProxyAgent: ${e.message}` };
  }
  const start = Date.now();
  try {
    const res = await nativeFetch('http://ifconfig.me/ip', {
      dispatcher: agent,
      signal: AbortSignal.timeout(10000)
    });
    const text = (await res.text()).trim();
    return { ok: res.ok, status: res.status, ip: text.slice(0, 64), latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: `${e.name || 'Error'}: ${e.message}` };
  } finally {
    try { agent.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = { install, reset, testProxy, shouldBypass, hostFromInput };
