const express = require('express');
const router = express.Router();
const db = require('../services/dbService');
const proxyService = require('../services/proxyService');
const healthService = require('../services/healthService');
const addonService = require('../services/addonService');
const proxyFetch = require('../services/proxyFetch');
const catalogI18n = require('../config/catalog-i18n');

// The console UI language (vi/en/zh/fr) travels in the x-wenker-lang header set
// by authFetch(); catalog text (provider descriptions / add-on descriptions) is
// localized server-side so non-Vietnamese UIs are not left with Vietnamese data.
function uiLang(req) {
  return catalogI18n.resolveLang(req.headers['x-wenker-lang']);
}

// Stats
router.get('/stats', (req, res) => {
  res.json(db.getStats());
});

// Providers
router.get('/providers', (req, res) => {
  const lang = uiLang(req);
  const providers = db.getPublicProviders().map((p) => catalogI18n.localizeProvider(p, lang));
  res.json({
    total: providers.length,
    providers
  });
});

// A masked value coming back means "unchanged" - never let it overwrite the real secret.
function stripMaskedSecrets(body) {
  const out = { ...body };
  for (const field of ['userApiKey', 'userCookie']) {
    if (typeof out[field] === 'string' && out[field].includes('•')) delete out[field];
  }
  return out;
}

const publicProvider = (p) => (p ? {
  ...p,
  hasApiKey: Boolean(p.userApiKey),
  hasCookie: Boolean(p.userCookie),
  userApiKey: db.constructor.maskSecret(p.userApiKey),
  userCookie: p.userCookie ? '••••(cookie da luu)' : ''
} : p);

router.post('/providers/:id', (req, res) => {
  const updated = db.updateProvider(req.params.id, stripMaskedSecrets(req.body));
  res.json({ success: true, provider: publicProvider(updated) });
});

router.post('/providers/custom/add', (req, res) => {
  const newProvider = db.addCustomProvider(req.body);
  res.json({ success: true, provider: publicProvider(newProvider) });
});

router.delete('/providers/custom/:id', (req, res) => {
  db.deleteCustomProvider(req.params.id);
  res.json({ success: true });
});

// Latency Ping Test
router.post('/providers/:id/ping', async (req, res) => {
  const result = await proxyService.testLatency(req.params.id);
  res.json(result);
});

// ---- Health probe: does the provider actually answer a real chat request? ----
router.get('/health', (req, res) => {
  const { PROBEABLE } = require('../services/healthService');
  res.json({ health: healthService.summary(), probeable: PROBEABLE });
});

router.post('/health/probe', async (req, res) => {
  const results = await healthService.probeAll();
  res.json({ success: true, results });
});

router.post('/health/probe/:id', async (req, res) => {
  const result = await healthService.probeProvider(req.params.id);
  res.json({ success: true, result });
});

// ---- Prompt response cache ----
router.get('/cache', (req, res) => {
  res.json(db.cacheStats());
});

router.delete('/cache', (req, res) => {
  db.clearCache();
  res.json({ success: true });
});

// Users & WENKER Cloud quota (login pins 1-9)
router.get('/users', (req, res) => {
  res.json({ pins: db.pins, users: db.pins.map((p) => db.getQuota(p)) });
});

router.post('/users/:pin/limit', (req, res) => {
  const quota = db.setDailyLimit(req.params.pin, req.body.dailyLimit);
  res.json({ success: true, quota });
});

// Downloads registry ("đã tải")
router.get('/downloads', (req, res) => {
  res.json({ downloads: db.getDownloads() });
});

router.post('/downloads', (req, res) => {
  const item = db.addDownload(req.body);
  res.json({ success: true, download: item });
});

router.delete('/downloads/:id', (req, res) => {
  db.removeDownload(req.params.id);
  res.json({ success: true });
});

// Keys
router.get('/keys', (req, res) => {
  res.json(db.getKeys());
});

router.post('/keys', (req, res) => {
  const newKey = db.createKey(req.body);
  res.json({ success: true, key: newKey });
});

router.delete('/keys/:id', (req, res) => {
  db.deleteKey(req.params.id);
  res.json({ success: true });
});

router.post('/keys/:id/toggle', (req, res) => {
  const key = db.toggleKey(req.params.id);
  res.json({ success: true, key });
});

// Routing Rules
router.get('/routing', (req, res) => {
  res.json(db.getRoutingRules());
});

router.post('/routing', (req, res) => {
  const updated = db.saveRoutingRules(req.body);
  res.json({ success: true, routing: updated });
});

// Logs
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(db.getLogs(limit));
});

// Settings
router.get('/settings', (req, res) => {
  res.json(db.getSettings());
});

router.post('/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  // proxyUrl/proxyEnabled co the vua doi -> dong agent cu de request sau dung proxy moi.
  proxyFetch.reset();
  res.json({ success: true, settings: updated });
});

// Thu nhanh HTTP proxy: goi lenh nay tu UI "Ket noi" de biet proxy co ra duoc
// internet that khong (tra ve IP nhin thay phia ben kia). Khong anh huong settings.
router.post('/settings/proxy-test', async (req, res) => {
  const result = await proxyFetch.testProxy(req.body && req.body.proxyUrl);
  res.json(result);
});

// ---- Add-on engine (kho .addon: theme / provider / snippet) ----
router.get('/addons', (req, res) => {
  const lang = uiLang(req);
  res.json({ addons: addonService.list().map((a) => catalogI18n.localizeAddon(a, lang)) });
});

// Install from a pasted/uploaded manifest. Accepts raw JSON body or { manifest } or { source: "<json text>" }.
router.post('/addons/install', (req, res) => {
  let manifest = req.body;
  if (manifest && typeof manifest.source === 'string') {
    try { manifest = JSON.parse(manifest.source); }
    catch (e) { return res.status(400).json({ success: false, error: 'Khong parse duoc JSON: ' + e.message }); }
  }
  if (manifest && manifest.manifest) manifest = manifest.manifest;
  const result = addonService.install(manifest);
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });

  // A "provider" add-on also creates a live custom provider immediately.
  if (result.addon.type === 'provider' && result.addon.provider) {
    try { db.addCustomProvider(result.addon.provider); } catch (e) { /* ignore dup */ }
  }
  res.json({ success: true, addon: result.addon });
});

router.delete('/addons/:id', (req, res) => {
  const addon = addonService.get(req.params.id);
  const r = addonService.remove(req.params.id);
  if (r.builtinProtected) {
    return res.status(400).json({ success: false, error: 'Add-on dung san khong the xoa.' });
  }
  // A provider add-on created a live custom provider - drop it too.
  if (addon && addon.type === 'provider' && addon.provider && addon.provider.id) {
    try { db.deleteCustomProvider(addon.provider.id); } catch (e) { /* ignore */ }
  }
  res.json({ success: true });
});

module.exports = router;
