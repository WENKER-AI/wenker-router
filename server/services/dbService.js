const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const { PROVIDERS } = require('../config/providers-data');

// All persistent state lives in the user home folder (~/.wenker), NOT inside the repo.
const DATA_DIR = process.env.WENKER_HOME
  ? path.resolve(process.env.WENKER_HOME)
  : path.join(os.homedir(), '.wenker');
// Previous location, migrated once on first boot.
const LEGACY_DIR = path.join(__dirname, '..', '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILES = [
  'config.json',
  'api-keys.json',
  'custom-providers.json',
  'routing-rules.json',
  'logs.json'
];

function migrateLegacyData() {
  try {
    if (!fs.existsSync(LEGACY_DIR)) return;
    for (const name of DATA_FILES) {
      const src = path.join(LEGACY_DIR, name);
      const dst = path.join(DATA_DIR, name);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
        console.log(`[.wenker] migrated ${name} -> ${dst}`);
      }
    }
  } catch (err) {
    console.error('[.wenker] legacy migration skipped:', err.message);
  }
}
migrateLegacyData();

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const KEYS_FILE = path.join(DATA_DIR, 'api-keys.json');
const CUSTOM_PROVIDERS_FILE = path.join(DATA_DIR, 'custom-providers.json');
const ROUTING_FILE = path.join(DATA_DIR, 'routing-rules.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'registry.json');
const CACHE_FILE = path.join(DATA_DIR, 'response-cache.json');
const HEALTH_FILE = path.join(DATA_DIR, 'provider-health.json');

// Prompt-response cache: repeated questions answer instantly even when the free
// upstream is rate-limited (402). Bounded LRU by insertion time.
const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// A refusal or upstream error is NOT an answer. Caching text like Pollinations'
// "reached its budget" would replay the refusal for the whole TTL even after the
// upstream recovers, and would make every client (Copilot/Cline/IDE) look broken.
// Anything matching this is never written, and existing entries are dropped on load.
const CACHEABLE_REFUSAL =
  /reached its budget|payment required|insufficient (?:credit|balance|quota)|rate ?limit(?:ed)?|too many requests|quota exceeded|invalid api key|api key (?:is )?invalid|no healthy upstream|not authorized|unauthorized|service unavailable|bad gateway|fetch failed|internal server error|overloaded/i;
function isCacheableContent(content) {
  if (typeof content !== 'string') return false;
  const t = content.trim();
  if (!t) return false;
  // Real answers are usually longer than a one-line error; keep the guard cheap and
  // only screen short-ish payloads where an upstream error string actually appears.
  if (t.length <= 600 && CACHEABLE_REFUSAL.test(t)) return false;
  return true;
}

// Daily quota window is calendar-day based in the server's local timezone.
function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

const USER_PINS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// WENKER Cloud free-tier guardrails. Each user gets a number of "requests" per
// day; a long request consumes more, so we also track an internal token budget
// (QUOTA_TOKENS_PER_REQUEST tokens of throughput == one charged request).
const QUOTA_TOKENS_PER_REQUEST = 6000;
const DEFAULT_DAILY_LIMIT = 50;
const AD_CREDIT_AMOUNT = 10;
const AD_CREDIT_MAX_PER_DAY = 30;

function defaultUsers() {
  const today = localDay();
  const map = {};
  for (const pin of USER_PINS) {
    map[pin] = {
      pin,
      day: today,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      used: 0,
      tokens: 0,
      bonusUsed: 0,
      adCreditAmount: AD_CREDIT_AMOUNT,
      adCreditsMax: AD_CREDIT_MAX_PER_DAY
    };
  }
  return map;
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

// Initial configs
const defaultSettings = {
  port: 3600,
  host: '0.0.0.0',
  serverName: 'WENKER Router Local Gateway',
  version: '2.0.0',
  defaultProvider: 'wenker-cloud',
  defaultModel: 'wenker-deepseek-r1-free',
  corsEnabled: true,
  logLevel: 'info',
  enableSmartFallback: true,
  // Honest errors: unknown model names answer 404 with the real model list instead
  // of silently routing to the dead default upstream.
  strictModelResolution: true,
  fallbackOrder: ['wenker-cloud', 'openrouter', 'groq', 'google-gemini', 'nim-nvidia', 'duckduckgo', 'pollinations'],
  // Free WENKER Cloud allowance per login user per day (see ~/.wenker/users.json).
  wenkerCloudDailyLimit: DEFAULT_DAILY_LIMIT,
  providerOverrides: {}
};

const defaultKeys = [
  {
    id: "key-admin-1",
    key: "sk-wenker-local-admin",
    name: "Master Admin Key",
    role: "admin",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    rateLimit: 1000,
    isActive: true
  },
  {
    id: "key-free-1",
    key: "sk-wenker-free-playground",
    name: "Free Playground Key",
    role: "user",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    rateLimit: 500,
    isActive: true
  }
];

const defaultRouting = {
  aliases: {
    "gpt-4o": "wenker-cloud/wenker-deepseek-v3-free",
    "gpt-4o-mini": "wenker-cloud/wenker-gpt-4o-mini-free",
    "claude-3-5-sonnet": "wenker-cloud/wenker-deepseek-r1-free",
    "claude-3-7-sonnet": "wenker-cloud/wenker-deepseek-r1-free",
    "claude-code": "wenker-cloud/wenker-qwen-2.5-coder-free"
  },
  fallbacks: [
    { from: "openai", to: ["wenker-cloud", "groq", "duckduckgo"] },
    { from: "anthropic", to: ["wenker-cloud", "duckduckgo"] }
  ]
};

// Database Service Singleton
class DbService {
  constructor() {
    this.init();
  }

  init() {
    this.settings = readJsonFile(CONFIG_FILE, defaultSettings);
    // Merge forward-compatible defaults, then migrate the old fallback chain which
    // pointed only at upstreams that are no longer reachable without a key.
    this.settings = { ...defaultSettings, ...this.settings };
    const order = Array.isArray(this.settings.fallbackOrder) ? this.settings.fallbackOrder : [];
    if (!order.includes('openrouter')) {
      this.settings.fallbackOrder = defaultSettings.fallbackOrder;
      writeJsonFile(CONFIG_FILE, this.settings);
    }
    this.keys = readJsonFile(KEYS_FILE, defaultKeys);
    this.customProviders = readJsonFile(CUSTOM_PROVIDERS_FILE, []);
    this.routing = readJsonFile(ROUTING_FILE, defaultRouting);
    this.logs = readJsonFile(LOGS_FILE, []);
    this.users = readJsonFile(USERS_FILE, defaultUsers());
    this.sessions = readJsonFile(SESSIONS_FILE, []);
    this.registry = readJsonFile(REGISTRY_FILE, { downloads: [] });
    if (!this.registry.downloads) this.registry.downloads = [];
    this.cache = readJsonFile(CACHE_FILE, { entries: {} });
    if (!this.cache.entries) this.cache.entries = {};
    this._purgePoisonedCache();
    this.health = readJsonFile(HEALTH_FILE, {});
  }

  // Drop any cached entry that stored an upstream refusal/error string instead of a
  // real answer. Such entries were written before cacheSet started screening content,
  // and would otherwise replay a stale "reached its budget" for the rest of the TTL.
  _purgePoisonedCache() {
    const entries = this.cache.entries || {};
    let removed = 0;
    for (const k of Object.keys(entries)) {
      if (!isCacheableContent(entries[k] && entries[k].content)) {
        delete entries[k];
        removed++;
      }
    }
    if (removed) {
      writeJsonFile(CACHE_FILE, this.cache);
      console.log(`[Cache] Purged ${removed} poisoned refusal/error entries on load.`);
    }
  }

  // ---- Prompt response cache (free-upstream resilience) ----
  cacheKey(model, messages) {
    const digest = crypto.createHash('sha256')
      .update(JSON.stringify({ model, messages }))
      .digest('hex');
    return digest.slice(0, 32);
  }

  cacheGet(key) {
    const hit = this.cache.entries[key];
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      delete this.cache.entries[key];
      writeJsonFile(CACHE_FILE, this.cache);
      return null;
    }
    return hit;
  }

  cacheSet(key, content, usage) {
    // Refusals and upstream error strings are never answers: do not cache them, and
    // evict any stale poisoned entry for this key so the next call hits the network.
    if (!isCacheableContent(content)) {
      if (this.cache.entries[key]) {
        delete this.cache.entries[key];
        writeJsonFile(CACHE_FILE, this.cache);
      }
      return false;
    }
    const entries = this.cache.entries;
    entries[key] = { content, usage: usage || null, at: Date.now() };
    const keys = Object.keys(entries);
    if (keys.length > CACHE_MAX_ENTRIES) {
      // drop oldest first
      keys.sort((a, b) => entries[a].at - entries[b].at)
        .slice(0, keys.length - CACHE_MAX_ENTRIES)
        .forEach(k => delete entries[k]);
    }
    writeJsonFile(CACHE_FILE, this.cache);
    return true;
  }

  cacheStats() {
    return { size: Object.keys(this.cache.entries).length, max: CACHE_MAX_ENTRIES, ttlMs: CACHE_TTL_MS };
  }

  clearCache() {
    this.cache.entries = {};
    writeJsonFile(CACHE_FILE, this.cache);
    return true;
  }

  // ---- Provider health (last probe result per provider id) ----
  getHealth() {
    return this.health;
  }

  setHealth(providerId, result) {
    this.health[providerId] = { ...result, checkedAt: new Date().toISOString() };
    writeJsonFile(HEALTH_FILE, this.health);
    return this.health[providerId];
  }

  // ---- Login users (passcode 1-9) ----
  get pins() {
    return USER_PINS;
  }

  // A quota subject is any tracked consumer of WENKER Cloud: a login user ("1".."9"),
  // an API key ("key:sk-wenker-...") or an anonymous IP ("anon:127.0.0.1").
  getQuotaAccount(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    if (!this.users[key]) {
      this.users[key] = { ...defaultUsers()['1'], pin: key };
    }
    // Backfill any field missing from an older users.json.
    this.users[key] = { ...defaultUsers()['1'], ...this.users[key], pin: key };
    return this._ensureQuotaDay(this.users[key]);
  }

  getUserByPin(pin) {
    const key = String(pin);
    if (!USER_PINS.includes(key)) return null;
    return this.getQuotaAccount(key);
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    writeJsonFile(CONFIG_FILE, this.settings);
    return this.settings;
  }

  // Providers handling
  getAllProviders() {
    const overrides = this.settings.providerOverrides || {};
    
    // Builtin providers with overrides applied
    const builtins = PROVIDERS.map(p => {
      const override = overrides[p.id] || {};
      return {
        ...p,
        ...override,
        // Ensure models list is preserved or augmented
        models: override.models || p.models,
        enabled: override.enabled !== undefined ? override.enabled : true,
        userApiKey: override.userApiKey || "",
        userCookie: override.userCookie || "",
        userHeaders: override.userHeaders || {},
        isCustom: false
      };
    });

    // Custom user-defined providers
    const customs = this.customProviders.map(cp => ({
      ...cp,
      isCustom: true,
      enabled: cp.enabled !== undefined ? cp.enabled : true
    }));

    return [...builtins, ...customs];
  }

  getProviderById(id) {
    const all = this.getAllProviders();
    return all.find(p => p.id === id);
  }

  /**
   * What the browser is allowed to see. getAllProviders() carries the REAL
   * upstream secrets, and /api/* is reachable by anything that can open a TCP
   * socket to this box (it binds 0.0.0.0), so the plaintext key/cookie must never
   * be serialized into an HTTP response. Clients get a mask plus a boolean; the
   * unmasked values stay server-side and are only read by proxyService/healthService.
   */
  static maskSecret(value) {
    const s = String(value || '');
    if (!s) return '';
    // Keep enough shape to recognise WHICH credential is stored without revealing it.
    const tail = s.slice(-4);
    const head = s.length > 16 ? s.slice(0, 3) : '';
    return `${head}••••${tail}`;
  }

  getPublicProviders() {
    return this.getAllProviders().map((p) => ({
      ...p,
      hasApiKey: Boolean(p.userApiKey),
      hasCookie: Boolean(p.userCookie),
      userApiKey: DbService.maskSecret(p.userApiKey),
      userCookie: p.userCookie ? '••••(cookie da luu)' : ''
    }));
  }

  updateProvider(id, updateData) {
    // Check if it's a custom provider
    const customIdx = this.customProviders.findIndex(p => p.id === id);
    if (customIdx >= 0) {
      this.customProviders[customIdx] = { ...this.customProviders[customIdx], ...updateData };
      writeJsonFile(CUSTOM_PROVIDERS_FILE, this.customProviders);
      return this.customProviders[customIdx];
    }

    // Otherwise it's a builtin override
    if (!this.settings.providerOverrides) {
      this.settings.providerOverrides = {};
    }
    this.settings.providerOverrides[id] = {
      ...(this.settings.providerOverrides[id] || {}),
      ...updateData
    };
    writeJsonFile(CONFIG_FILE, this.settings);
    return this.getProviderById(id);
  }

  addCustomProvider(providerData) {
    const id = providerData.id || `custom-${Date.now()}`;
    const newProvider = {
      id,
      name: providerData.name || "Custom Provider",
      category: "custom",
      baseUrl: providerData.baseUrl || "http://localhost:8000/v1",
      authType: providerData.authType || "bearer",
      headerName: providerData.headerName || "Authorization",
      userApiKey: providerData.userApiKey || "",
      isFree: providerData.isFree || false,
      requiresAuth: providerData.requiresAuth !== false,
      website: providerData.website || "",
      description: providerData.description || "Nhà cung cấp tùy chỉnh người dùng.",
      icon: "Cpu",
      enabled: true,
      models: providerData.models || [{ id: `${id}-model`, name: "Default Model", contextWindow: 32000, isFree: true }]
    };

    this.customProviders.push(newProvider);
    writeJsonFile(CUSTOM_PROVIDERS_FILE, this.customProviders);
    return newProvider;
  }

  deleteCustomProvider(id) {
    this.customProviders = this.customProviders.filter(p => p.id !== id);
    writeJsonFile(CUSTOM_PROVIDERS_FILE, this.customProviders);
    return true;
  }

  // API Key management
  getKeys() {
    return this.keys;
  }

  createKey({ name, role, rateLimit }) {
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newKey = {
      id: `key-${Date.now()}`,
      key: `sk-wenker-${randomHex}`,
      name: name || `Key ${this.keys.length + 1}`,
      role: role || "user",
      createdAt: new Date().toISOString(),
      usageCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      rateLimit: rateLimit || 1000,
      isActive: true
    };
    this.keys.push(newKey);
    writeJsonFile(KEYS_FILE, this.keys);
    return newKey;
  }

  deleteKey(id) {
    this.keys = this.keys.filter(k => k.id !== id);
    writeJsonFile(KEYS_FILE, this.keys);
    return true;
  }

  toggleKey(id) {
    const key = this.keys.find(k => k.id === id);
    if (key) {
      key.isActive = !key.isActive;
      writeJsonFile(KEYS_FILE, this.keys);
      return key;
    }
    return null;
  }

  validateKey(keyStr) {
    if (!keyStr) return null;
    // Strip "Bearer " prefix if provided
    const cleanKey = keyStr.replace(/^Bearer\s+/i, '').trim();
    return this.keys.find(k => k.key === cleanKey && k.isActive);
  }

  incrementKeyUsage(keyStr, promptTokens = 0, completionTokens = 0) {
    if (!keyStr) return;
    const cleanKey = keyStr.replace(/^Bearer\s+/i, '').trim();
    const key = this.keys.find(k => k.key === cleanKey);
    if (key) {
      key.usageCount = (key.usageCount || 0) + 1;
      key.promptTokens = (key.promptTokens || 0) + promptTokens;
      key.completionTokens = (key.completionTokens || 0) + completionTokens;
      writeJsonFile(KEYS_FILE, this.keys);
    }
  }

  // Routing Rules
  getRoutingRules() {
    return this.routing;
  }

  saveRoutingRules(rules) {
    this.routing = rules;
    writeJsonFile(ROUTING_FILE, this.routing);
    return this.routing;
  }

  // Logs and Stats
  getLogs(limit = 100) {
    return this.logs.slice(-limit).reverse();
  }

  addLog(entry) {
    const logItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.push(logItem);
    // Keep max 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
    writeJsonFile(LOGS_FILE, this.logs);
    return logItem;
  }

  getStats() {
    const totalRequests = this.logs.length;
    const successfulRequests = this.logs.filter(l => l.status >= 200 && l.status < 300).length;
    const failedRequests = totalRequests - successfulRequests;
    
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalLatency = 0;

    this.logs.forEach(l => {
      totalPromptTokens += (l.promptTokens || 0);
      totalCompletionTokens += (l.completionTokens || 0);
      totalLatency += (l.latencyMs || 0);
    });

    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;

    const allProviders = this.getAllProviders();
    const enabledProviders = allProviders.filter(p => p.enabled).length;
    const freeProviders = allProviders.filter(p => p.isFree).length;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      avgLatencyMs,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      totalProviders: allProviders.length,
      enabledProviders,
      freeProviders,
      totalKeys: this.keys.length
    };
  }
  // ---- Sessions (login gate) ----
  getSessions() {
    return this.sessions;
  }

  createSession(pin) {
    // One live session per user pin: logging in again replaces the old token.
    this.sessions = this.sessions.filter(s => s.pin !== pin);
    const token = crypto.randomBytes(24).toString('hex');
    const session = {
      token,
      pin,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    this.sessions.push(session);
    // Keep the store from growing forever.
    if (this.sessions.length > 200) {
      this.sessions = this.sessions.slice(-200);
    }
    writeJsonFile(SESSIONS_FILE, this.sessions);
    return session;
  }

  validateSession(token) {
    if (!token) return null;
    const clean = String(token).replace(/^Bearer\s+/i, '').trim();
    const session = this.sessions.find(s => s.token === clean);
    if (!session) return null;
    session.lastSeenAt = new Date().toISOString();
    writeJsonFile(SESSIONS_FILE, this.sessions);
    return session;
  }

  clearSession(token) {
    this.sessions = this.sessions.filter(s => s.token !== token);
    writeJsonFile(SESSIONS_FILE, this.sessions);
    return true;
  }

  // ---- WENKER Cloud daily quota ----
  // `used` counts charged requests; `tokens` accumulates estimated throughput so
  // the cap also limits very long requests. Both reset on a new local calendar day.
  _ensureQuotaDay(user) {
    const today = localDay();
    if (user.day !== today) {
      // New calendar day: base allowance comes from settings, ad bonuses reset.
      const base = Number(this.settings && this.settings.wenkerCloudDailyLimit);
      user.day = today;
      user.dailyLimit = Number.isFinite(base) && base >= 0 ? base : DEFAULT_DAILY_LIMIT;
      user.used = 0;
      user.tokens = 0;
      user.bonusUsed = 0;
    }
    return user;
  }

  getQuota(subject) {
    const user = this._ensureQuotaDay(this.getQuotaAccount(subject));
    writeJsonFile(USERS_FILE, this.users);
    const limit = user.dailyLimit;
    const tokensUsed = user.tokens;
    const unlimited = !(limit > 0);
    const tokenCap = limit * QUOTA_TOKENS_PER_REQUEST;
    const used = Math.max(user.used, tokenCap > 0 ? Math.ceil(tokensUsed / QUOTA_TOKENS_PER_REQUEST) : 0);
    const remaining = unlimited ? null : Math.max(0, limit - used);
    return {
      pin: user.pin,
      day: user.day,
      dailyLimit: limit,
      unlimited,
      used,
      remaining,
      bonusUsed: user.bonusUsed,
      adCreditAmount: user.adCreditAmount,
      adCreditsLeft: Math.max(0, user.adCreditsMax - user.bonusUsed),
      exhausted: !unlimited && remaining <= 0
    };
  }

  // Does this request fit inside today's allowance? (no mutation)
  // Both gates must pass: the request COUNT (user.used) and the token THROUGHPUT
  // (user.tokens vs dailyLimit * QUOTA_TOKENS_PER_REQUEST).
  quotaAllows(subject, estimatedTokens = 0) {
    const user = this._ensureQuotaDay(this.getQuotaAccount(subject));
    if (user.dailyLimit <= 0) return true; // unlimited
    if (user.used + 1 > user.dailyLimit) return false;
    const tokenCap = user.dailyLimit * QUOTA_TOKENS_PER_REQUEST;
    return user.tokens + Math.max(1, estimatedTokens) <= tokenCap;
  }

  chargeQuota(subject, tokens = 0) {
    const user = this._ensureQuotaDay(this.getQuotaAccount(subject));
    user.used += 1;
    user.tokens += Math.max(1, Number(tokens) || 1);
    writeJsonFile(USERS_FILE, this.users);
    return this.getQuota(subject);
  }

  // Watch a sponsored ad -> grant bonus requests (capped per day).
  grantAdCredit(subject) {
    const user = this._ensureQuotaDay(this.getQuotaAccount(subject));
    const bonus = user.adCreditAmount;
    if (user.bonusUsed >= user.adCreditsMax) {
      return { granted: false, quota: this.getQuota(subject), reason: 'Het luot xem quang cao trong hom nay.' };
    }
    user.dailyLimit += bonus;
    user.bonusUsed += bonus;
    writeJsonFile(USERS_FILE, this.users);
    return { granted: true, bonus, quota: this.getQuota(subject) };
  }

  setDailyLimit(subject, value) {
    const user = this._ensureQuotaDay(this.getQuotaAccount(subject));
    user.dailyLimit = Math.max(0, Math.min(100000, Number(value) || 0));
    writeJsonFile(USERS_FILE, this.users);
    return this.getQuota(subject);
  }

  // ---- Downloads registry ("da tai") ----
  getDownloads() {
    return this.registry.downloads;
  }

  addDownload(entry) {
    const item = {
      id: `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.registry.downloads.push(item);
    if (this.registry.downloads.length > 300) {
      this.registry.downloads = this.registry.downloads.slice(-300);
    }
    writeJsonFile(REGISTRY_FILE, this.registry);
    return item;
  }

  removeDownload(id) {
    this.registry.downloads = this.registry.downloads.filter(d => d.id !== id);
    writeJsonFile(REGISTRY_FILE, this.registry);
    return true;
  }
}

module.exports = new DbService();
