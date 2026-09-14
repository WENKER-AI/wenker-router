const express = require('express');
const router = express.Router();
const db = require('../services/dbService');
const proxyService = require('../services/proxyService');

// Middleware to check WENKER API Key
function authenticateWenkerKey(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-api-key'] || "";
  
  // Allow free/local requests if no key is supplied OR validate against db keys
  if (!authHeader) {
    req.wenkerKey = "sk-wenker-free-playground";
    return next();
  }

  const validKey = db.validateKey(authHeader);
  if (validKey) {
    req.wenkerKey = validKey.key;
    return next();
  }

  // If key is supplied from client but not in local db, still allow in local dev mode
  req.wenkerKey = authHeader;
  next();
}

/**
 * GET /v1/models
 * Returns all models across all enabled providers
 */
router.get('/models', (req, res) => {
  const providers = db.getAllProviders().filter(p => p.enabled);
  const health = db.getHealth();
  const modelsList = [];
  const nowEpoch = Math.floor(Date.now() / 1000);

  for (const p of providers) {
    const h = health[p.id];
    const providerStatus = !h ? 'unknown' : (h.ok ? 'alive' : (h.needsKey ? 'needs_key' : 'down'));
    // requiresAuth = the upstream demands a key at all (auth model).
    // needsKey    = it demands one AND none is configured yet (the actionable signal).
    // A provider can be isFree (costs nothing) yet still requiresAuth (needs a free key).
    const requiresAuth = Boolean(p.requiresAuth);
    const needsKey = requiresAuth && !p.userApiKey;
    // Tool-calling is only honest on a real OpenAI-compatible upstream. The free
    // no-auth paths (Pollinations anonymous / DuckDuckGo) cannot answer with
    // tool_calls, so clients use this flag to hide the agent/tool toggle.
    const supportsTools = !/pollinations\.ai/i.test(String(p.baseUrl || "")) && p.id !== "duckduckgo";
    const meta = (m) => ({
      owned_by: p.name,
      root: m.id,
      parent: null,
      wenker_provider: p.id,
      wenker_provider_name: p.name,
      wenker_category: p.category || 'other',
      wenker_free: Boolean(p.isFree || m.isFree),
      wenker_requires_key: requiresAuth,
      wenker_needs_key: needsKey,
      wenker_supports_tools: supportsTools,
      wenker_auth_type: p.authType || 'none',
      wenker_context: m.contextWindow || p.contextWindow || null,
      wenker_display_name: m.name || m.id,
      // Which upstream model REALLY answers this alias id (may differ from m.id).
      wenker_served_by: m.servedModel || m.targetModel || m.id,
      wenker_description: p.description || '',
      wenker_website: p.website || '',
      wenker_key_help: p.keyHelp || '',
      wenker_status: providerStatus
    });
    if (p.models && Array.isArray(p.models)) {
      for (const m of p.models) {
        modelsList.push({ id: m.id, object: 'model', created: nowEpoch, ...meta(m) });

        // Also add provider-prefixed model ID (e.g. "wenker-cloud/wenker-deepseek-r1-free")
        modelsList.push({ id: `${p.id}/${m.id}`, object: 'model', created: nowEpoch, ...meta(m) });
      }
    }
  }

  res.json({
    object: "list",
    data: modelsList
  });
});

/**
 * POST /v1/chat/completions
 */
router.post('/chat/completions', authenticateWenkerKey, async (req, res) => {
  try {
    await proxyService.handleChatCompletion({
      req,
      res,
      body: req.body,
      wenkerKey: req.wenkerKey
    });
  } catch (err) {
    console.error("OpenAI Route Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: err.message || "Internal Server Error",
          type: "internal_error"
        }
      });
    }
  }
});

/**
 * POST /v1/embeddings
 * WENKER Router chỉ forward tới provider có hỗ trợ embeddings thật.
 * Không sinh vector giả.
 */
router.post('/embeddings', authenticateWenkerKey, async (req, res) => {
  const startTime = Date.now();
  const { model, input } = req.body;
  if (!input) {
    return res.status(400).json({
      error: { message: 'Thiếu tham số "input" cho /v1/embeddings.', type: 'invalid_request_error', param: 'input' }
    });
  }
  const { provider, targetModel } = proxyService.resolveProviderAndModel(model);
  const apiKey = provider?.userApiKey || '';
  if (!provider || !apiKey) {
    return res.status(501).json({
      error: {
        message: 'WENKER Router chưa có upstream embeddings miễn phí hoạt động. Hãy nhập API Key cho một provider hỗ trợ embeddings (OpenAI, Jina, Mistral...) trong tab "Nhà Cung Cấp".',
        type: 'not_supported_error',
        code: 'embeddings_not_available'
      }
    });
  }
  try {
    const base = String(provider.baseUrl || '').replace(/\/+$/, '');
    const url = base.endsWith('/embeddings') ? base : `${base}/embeddings`;
    const headers = { 'Content-Type': 'application/json' };
    if (provider.authType === 'api-key') headers[provider.headerName || 'x-api-key'] = apiKey;
    else headers['Authorization'] = `Bearer ${apiKey}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: targetModel || model, input }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: { message: `Lỗi từ ${provider.name}: ${data?.error?.message || upstream.statusText}`, type: 'upstream_error' }
      });
    }
    db.addLog({
      endpoint: '/v1/embeddings',
      model: model || null,
      resolvedModel: targetModel,
      providerId: provider.id,
      status: 200,
      latencyMs: Date.now() - startTime,
      promptTokens: data?.usage?.prompt_tokens || 0,
      completionTokens: 0,
      stream: false,
      clientIp: req.ip || '127.0.0.1'
    });
    return res.json(data);
  } catch (err) {
    return res.status(502).json({
      error: { message: `Không gọi được upstream embeddings: ${err.message}`, type: 'upstream_error' }
    });
  }
});

module.exports = router;
