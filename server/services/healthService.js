/**
 * WENKER Health Probe Service
 *
 * Ping chỉ kiểm tra Base URL còn sống, không chứng minh model trả lời được.
 * Service này gửi một câu chat thật (rất ngắn) tới từng provider và ghi lại
 * kết quả vào ~/.wenker/provider-health.json để UI biết nguồn nào đang "sống".
 */

const db = require('./dbService');
const freeProxyService = require('./freeProxyService');

const PROBE_MESSAGES = [{ role: 'user', content: 'Reply with exactly: OK' }];
const PROBE_TIMEOUT_MS = 20000;
const HEALTH_STALE_MS = 15 * 60 * 1000;

// Providers that are realistically free to probe (no paid key burned per request).
const PROBEABLE = [
  'wenker-cloud', 'wenker-vip', 'wenker-community', 'pollinations', 'duckduckgo',
  'openrouter', 'github-models', 'groq', 'groq-free', 'google-gemini', 'cerebras',
  'sambanova', 'nim-nvidia', 'mistral', 'together', 'deepinfra', 'cloudflare-workers-ai'
];

class HealthService {
  constructor() {
    this._running = null;
  }

  async probeProvider(providerId) {
    const provider = db.getProviderById(providerId);
    if (!provider) return { ok: false, error: 'Provider không tồn tại' };

    const start = Date.now();
    let result;
    try {
      // Probe the anonymous Pollinations path only while the provider still points at
      // pollinations.ai. A re-pointed WENKER tier falls through to the generic keyed
      // probe below (baseUrl + models[0].targetModel + Bearer key).
      if (freeProxyService.isPollinationsProvider(provider)) {
        const data = await freeProxyService.handlePollinations({
          model: provider.id === 'wenker-cloud' ? 'wenker-deepseek-v3-free' : provider.id,
          messages: PROBE_MESSAGES,
          stream: false,
          res: null,
          targetModel: provider.models?.find(m => m.id === 'wenker-deepseek-v3-free')?.targetModel || 'openai-fast'
        });
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('upstream trả về rỗng');
        result = { ok: true, sample: String(text).slice(0, 60) };
      } else if (provider.id === 'duckduckgo') {
        const data = await freeProxyService.handleDuckDuckGo({
          model: 'ddg-gpt-4o-mini', messages: PROBE_MESSAGES, stream: false, res: null
        });
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('upstream trả về rỗng');
        result = { ok: true, sample: String(text).slice(0, 60) };
      } else {
        if (provider.requiresAuth && !provider.userApiKey) {
          throw Object.assign(new Error('Chưa cấu hình API Key'), { status: 401, code: 'missing_api_key' });
        }
        const model = provider.models?.[0];
        const base = String(provider.baseUrl || '').replace(/\/+$/, '');
        if (!base || !/^https?:\/\//i.test(base)) throw new Error('Base URL không hợp lệ');
        const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'WENKER-Router/2.0' };
        const key = provider.userApiKey || '';
        if (key) {
          if (provider.authType === 'api-key') headers[provider.headerName || 'x-api-key'] = key;
          else if (provider.authType === 'cookie') headers['Cookie'] = provider.userCookie || key;
          else headers['Authorization'] = provider.authType === 'bearer' ? `Bearer ${key}` : key;
        }
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: model?.targetModel || model?.id, messages: PROBE_MESSAGES, stream: false, max_tokens: 8 }),
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw Object.assign(new Error(`HTTP ${res.status}: ${t.slice(0, 140)}`), { status: res.status });
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('upstream trả về rỗng');
        result = { ok: true, sample: String(text).slice(0, 60) };
      }
    } catch (err) {
      // "needsKey" must mean "this provider cannot work without a key" (requiresAuth),
      // not merely "the upstream answered 401". The anonymous Pollinations/WENKER Cloud
      // tier answers 401/402/403 when its free budget runs out, and labelling that
      // "Cần API key" is exactly what made WENKER Cloud look key-gated.
      const authRequired = Boolean(provider.requiresAuth);
      const rejectedForAuth = err.code === 'missing_api_key' || err.status === 401 || err.status === 402 || err.status === 403;
      result = {
        ok: false,
        status: err.status || 0,
        error: String(err.message || err).slice(0, 220),
        needsKey: authRequired && rejectedForAuth,
        // Free tier that is alive but rate/budget-limited: a key would help, it is not mandatory.
        keyWouldHelp: !authRequired && rejectedForAuth
      };
    }

    const health = db.setHealth(providerId, { ...result, latencyMs: Date.now() - start });
    return health;
  }

  /**
   * Probe the free/realistic providers in parallel batches. Concurrent calls
   * share one run so the dashboard cannot spam upstreams.
   */
  probeAll(ids = PROBEABLE) {
    if (this._running) return this._running;
    const list = ids.map(id => db.getProviderById(id)).filter(Boolean);
    this._running = (async () => {
      const out = {};
      const queue = [...list];
      const workers = Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const p = queue.shift();
          out[p.id] = await this.probeProvider(p.id);
        }
      });
      await Promise.all(workers);
      this._running = null;
      return out;
    })();
    return this._running;
  }

  /**
   * Cached health for the UI. Entries older than HEALTH_STALE_MS are reported as
   * "unknown" (stale) so the dashboard never shows a green light from yesterday.
   */
  summary() {
    const stored = db.getHealth();
    const now = Date.now();
    const out = {};
    for (const [id, h] of Object.entries(stored)) {
      const age = now - new Date(h.checkedAt || 0).getTime();
      out[id] = { ...h, stale: age > HEALTH_STALE_MS, ageMs: age };
    }
    return out;
  }
}

module.exports = new HealthService();
module.exports.PROBEABLE = PROBEABLE;
