/**
 * WENKER Free Proxy Service
 * Handles zero-config, no-auth free providers (WENKER Cloud, DuckDuckGo, Pollinations)
 */

const db = require('./dbService');

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const POLLINATIONS_MODELS_URL = "https://text.pollinations.ai/models";
const FALLBACK_MODEL = "openai-fast";
const REQUEST_TIMEOUT_MS = 45000;
// A single WENKER request must never hang for minutes behind upstream retries.
const UPSTREAM_DEADLINE_MS = 25000;
// 402 = the anonymous tier is out of budget: retrying is pointless, so we open a circuit.
const POLLINATIONS_DOWN_MS = 3 * 60 * 1000;
const DDG_DOWN_MS = 60 * 1000;

/**
 * Errors thrown at the proxy layer carry an HTTP-ish status so the router can
 * answer the client with an honest code (402/429/503) instead of a generic 500.
 */
class UpstreamError extends Error {
  constructor(message, status = 502, code = "upstream_error") {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
  }
}

// Pollinations' anonymous tier answers with HTTP 200 whose body IS the refusal text
// ("The API key used for this request has reached its budget..."). A 200 normally
// means success, so without this the router reports COMPLETED, caches the refusal
// for 24h, and every client (Cline / Copilot / IDE) shows the budget error as if it
// were the model's answer. Match Pollinations' own unambiguous wording only.
const UPSTREAM_REFUSAL_200 =
  /reached its budget|raise the budget|API key used for this request|topping up the wallet does not raise this limit/i;
function looksLikeRefusal(content) {
  if (typeof content !== "string") return false;
  const t = content.trim();
  if (!t || t.length > 600) return false;
  return UPSTREAM_REFUSAL_200.test(t);
}

class FreeProxyService {
  constructor() {
    // Upstream cache / rate-limit state
    this._modelsCache = null;
    this._modelsCachedAt = 0;
    this._queue = Promise.resolve(); // pollinations allows max 1 concurrent request per IP
    this._ddgDisabledUntil = 0;
    this._pollinationsDisabledUntil = 0;
    this._pollinationsDownReason = null;
  }

  /**
   * Pollinations rejects anonymous streaming (402) and legacy model ids (404).
   * We always call it non-streaming and emit SSE ourselves.
   */
  async resolvePollinationsModel(preferred) {
    const now = Date.now();
    if (!this._modelsCache || now - this._modelsCachedAt > 10 * 60 * 1000) {
      try {
        const res = await fetch(POLLINATIONS_MODELS_URL, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const list = await res.json();
          const names = new Set();
          for (const m of Array.isArray(list) ? list : []) {
            if (m && m.name) {
              names.add(m.name);
              for (const a of m.aliases || []) names.add(a);
            }
          }
          if (names.size) {
            this._modelsCache = names;
            this._modelsCachedAt = now;
          }
        }
      } catch (err) {
        console.warn("[Pollinations] model list unavailable:", err.message);
      }
    }

    const wanted = [preferred, FALLBACK_MODEL].filter(Boolean);
    if (!this._modelsCache) return preferred || FALLBACK_MODEL;
    for (const name of wanted) {
      if (this._modelsCache.has(name)) return name;
    }
    // Preferred model was retired upstream -> use the first model the API actually serves
    const first = Array.from(this._modelsCache).find(n => !n.includes(" ")) || FALLBACK_MODEL;
    console.warn(`[Pollinations] model "${preferred}" not offered upstream, using "${first}"`);
    return first;
  }

  /**
   * Serialize upstream calls and retry on transient 408 / 429 / 5xx.
   * Queued work that can no longer finish before the caller's deadline is
   * dropped immediately instead of being sent upstream.
   */
  _enqueue(task, deadlineAt) {
    const run = this._queue.then(() => {
      if (deadlineAt && Date.now() > deadlineAt) {
        throw new Error("Upstream queue is saturated (request deadline exceeded)");
      }
      return task();
    }, task);
    // keep the chain alive even if the task rejects
    this._queue = run.then(() => undefined, () => undefined);
    return run;
  }

  _isPollinationsDown() {
    // A configured API key means we are no longer on the exhausted anonymous tier,
    // so the anonymous circuit breaker must not block those calls.
    if (this._pollinationsKey()) return false;
    return Date.now() < this._pollinationsDisabledUntil;
  }

  /**
   * The free anonymous Pollinations tier is currently out of budget (HTTP 402).
   * Users can restore WENKER Cloud by pasting a free key from
   * https://enter.pollinations.ai/keys into the provider's API Key field.
   */
  /**
   * A provider is genuinely "the Pollinations free tier" only while its Base URL still
   * points at pollinations.ai. WENKER Cloud / VIP / Community are re-pointable: once a
   * user aims them at another upstream (xkiro / izzi) they must stop feeding their key
   * or URL into the anonymous Pollinations path, which is why this checks baseUrl and
   * not the provider id.
   */
  isPollinationsProvider(provider) {
    return Boolean(provider) && /pollinations\.ai/i.test(String(provider.baseUrl || ""));
  }

  _pollinationsKey() {
    try {
      // Only a Pollinations-based provider may feed an Authorization key to
      // text.pollinations.ai. Any WENKER tier re-pointed elsewhere is skipped so its
      // xkiro / izzi key can never leak to Pollinations.
      for (const id of ["wenker-cloud", "pollinations"]) {
        const p = db.getProviderById(id);
        if (p && p.userApiKey && this.isPollinationsProvider(p)) return String(p.userApiKey).trim();
      }
    } catch (e) { /* db not ready */ }
    return "";
  }

  /**
   * Base URL for the OpenAI-compatible Pollinations chat endpoint. Defaults to the
   * legacy text API (which still honours a real API key via the Authorization
   * header); users may override the provider Base URL to point elsewhere.
   */
  _pollinationsUrl() {
    try {
      for (const id of ["wenker-cloud", "pollinations"]) {
        const p = db.getProviderById(id);
        const base = p && p.baseUrl;
        // Skip a WENKER tier that has been re-pointed away from Pollinations, otherwise
        // the anonymous path would start calling xkiro/izzi with Pollinations payloads.
        if (p && this.isPollinationsProvider(p) && base && /^https?:\/\//i.test(base)) {
          const clean = String(base).replace(/\/+$/, "");
          if (clean.endsWith("/openai") || clean.endsWith("/chat/completions")) return clean;
          return `${clean}/openai`;
        }
      }
    } catch (e) { /* fall through */ }
    return POLLINATIONS_URL;
  }

  _markPollinationsDown(reason) {
    this._pollinationsDisabledUntil = Date.now() + POLLINATIONS_DOWN_MS;
    this._pollinationsDownReason = reason;
    console.warn(`[Pollinations] free tier unavailable (${reason}) - skipping upstream for ${POLLINATIONS_DOWN_MS / 60000} min`);
  }

  async _postWithRetry(payload, deadlineAt) {
    const attempts = 3;
    let lastErr;

    for (let i = 0; i < attempts; i++) {
      const remaining = (deadlineAt || Infinity) - Date.now();
      if (remaining <= 1500) {
        throw lastErr || new Error("Upstream time budget exhausted");
      }
      let response;
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "WENKER-Router/2.0"
      };
      const key = this._pollinationsKey();
      if (key) headers["Authorization"] = `Bearer ${key}`;
      try {
        response = await fetch(this._pollinationsUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining))
        });
      } catch (err) {
        // network / timeout failure -> transient, worth another attempt
        lastErr = err;
        if (i < attempts - 1) {
          const wait = Math.min(1200 * (i + 1), Math.max(0, ((deadlineAt || Infinity) - Date.now()) - 1500));
          console.warn(`[Pollinations] ${err.message} (attempt ${i + 1}/${attempts}), retrying in ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
        }
        continue;
      }

      if (response.ok) {
        const parsed = await this._parseUpstream(response);
        // A 200 carrying the upstream's own refusal is NOT an answer: surface it as a
        // real 402 so the failover chain runs and the client gets an honest error
        // instead of a "COMPLETED" budget message (and so it never reaches the cache).
        if (looksLikeRefusal(parsed.content)) {
          this._markPollinationsDown("budget refusal in HTTP 200");
          throw new UpstreamError(
            "Pollinations tu choi (HTTP 200 + 'reached its budget'): tier an danh het ngan sach.",
            402
          );
        }
        return parsed;
      }

      const errText = await response.text().catch(() => "");
      lastErr = new UpstreamError(
        `Pollinations API returned status ${response.status}: ${errText.slice(0, 200)}`,
        response.status
      );

      // 402 = anonymous quota/key budget exhausted: retrying only wastes time.
      if (response.status === 402 || response.status === 401 || response.status === 403) {
        this._markPollinationsDown(`HTTP ${response.status}`);
        throw lastErr;
      }

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable) throw lastErr;

      const wait = Math.min(1200 * (i + 1), Math.max(0, remaining - 1500));
      console.warn(`[Pollinations] HTTP ${response.status} (attempt ${i + 1}/${attempts}), retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }

    throw lastErr || new Error("Pollinations request failed");
  }

  /**
   * Upstream serves OpenAI-shaped JSON, but may fall back to plain text.
   */
  async _parseUpstream(response) {
    const raw = await response.text();
    try {
      const json = JSON.parse(raw);
      const choice = Array.isArray(json.choices) ? json.choices[0] : null;
      const content = choice?.message?.content ?? choice?.text ?? json.content;
      if (typeof content === "string") {
        return { content, usage: json.usage || null };
      }
    } catch (e) { /* not JSON -> treat as plain text */ }
    return { content: raw, usage: null };
  }

  /**
   * Rough token estimate (~4 chars/token) from real payload text,
   * used only when the upstream does not report usage itself.
   */
  _estimateTokens(text) {
    return Math.max(0, Math.ceil(String(text || "").length / 4));
  }

  _estimatePromptTokens(messages) {
    const chars = (Array.isArray(messages) ? messages : []).reduce(
      (n, m) => n + String(m?.content || "").length, 0
    );
    return this._estimateTokens("x".repeat(chars));
  }

  /**
   * Handle Pollinations AI call (Used by WENKER Cloud & Pollinations)
   */
  async handlePollinations({ model, messages, stream, res, targetModel }) {
    const safeMessages = this.normalizeMessages(messages);
    const selectedModel = await this.resolvePollinationsModel(targetModel || this.mapPollinationsModel(model));

    // Fast fail while the free tier is known to be down (avoids minutes of queueing).
    if (this._isPollinationsDown()) {
      console.warn(`Pollinations circuit open (${this._pollinationsDownReason}).`);
      throw new UpstreamError(
        `Nguồn miễn phí đang gián đoạn (${this._pollinationsDownReason || "upstream down"}) - thu lại sau ít phút, hoặc nhập API Key miễn phí (enter.pollinations.ai/keys) cho WENKER Cloud.`,
        503,
        "upstream_unavailable"
      );
    }

    const deadlineAt = Date.now() + UPSTREAM_DEADLINE_MS;

    try {
      const { content, usage } = await this._enqueue(() => this._postWithRetry({
        model: selectedModel,
        messages: safeMessages,
        referrer: "wenker-router"
      }, deadlineAt), deadlineAt);

      const promptTokens = usage?.prompt_tokens || this._estimatePromptTokens(safeMessages);
      const completionTokens = usage?.completion_tokens || this._estimateTokens(content);

      if (stream) {
        await this._writeSse(res, model, content);
        return { streamed: true, promptTokens, completionTokens, servedModel: selectedModel };
      }

      return {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || selectedModel,
        // Honesty field: which upstream model ACTUALLY answered (aliases like
        // wenker-deepseek-r1-free may be served by a completely different model).
        wenker_served_by: selectedModel,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        }
      };
    } catch (err) {
      console.warn("Pollinations request failed:", err.message);
      const status = err.status || 502;
      const hint = status === 402
        ? " Tier mien phi da het budget: vao tab Nha Cung Cap > WENKER Cloud > nhap API Key mien phi tu enter.pollinations.ai/keys."
        : "";
      const e = new UpstreamError(`Nguon mien phi Pollinations khong phan hoi: ${err.message}${hint}`, status);
      throw e;
    }
  }

  /**
   * Emit a completed answer as OpenAI SSE chunks (upstream streaming is not
   * available on the free tier, so we stream locally to keep clients happy).
   */
  _writeSse(res, model, content) {
    return new Promise((resolve) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const parts = String(content).match(/[\s\S]{1,24}/g) || [];
      let i = 0;
      const tick = () => {
        if (i < parts.length) {
          const sseChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{ index: 0, delta: { content: parts[i] }, finish_reason: null }]
          };
          i++;
          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
          setImmediate(tick);
        } else {
          res.write(`data: ${JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
          })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          resolve();
        }
      };
      tick();
    });
  }

  /**
   * Coerce arbitrary client payloads into a valid OpenAI messages array.
   */
  normalizeMessages(messages) {
    if (typeof messages === "string") {
      return [{ role: "user", content: messages }];
    }
    if (!Array.isArray(messages)) return [];
    return messages
      .filter(m => m && typeof m === "object")
      .map(m => {
        const role = ["system", "user", "assistant", "tool"].includes(m.role) ? m.role : "user";
        const content = typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map(c => (typeof c === "string" ? c : c?.text || "")).join("")
            : m.content == null ? "" : JSON.stringify(m.content);
        const out = { role, content };
        // Tool-calling round-trip: an assistant turn may carry tool_calls (often with
        // content === null) and a tool turn is identified ONLY by tool_call_id.
        // Stripping these fields used to break every agent loop: the upstream model
        // never saw its own calls nor their results, so it could not continue.
        if (role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
          out.tool_calls = m.tool_calls;
        }
        if (role === "tool" && (m.tool_call_id || m.toolCallId)) {
          out.tool_call_id = String(m.tool_call_id || m.toolCallId);
          if (m.name) out.name = String(m.name);
        }
        return out;
      })
      .filter(m => m.content !== "" || m.tool_calls || m.tool_call_id);
  }

  /**
   * Handle DuckDuckGo AI Free Chat
   */
  async handleDuckDuckGo({ model, messages, stream, res }) {
    const safeMessages = this.normalizeMessages(messages);

    try {
      if (Date.now() < this._ddgDisabledUntil) {
        throw new Error("DuckDuckGo temporarily disabled (handshake failures)");
      }

      // 1. Get VQD Token
      const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
        headers: {
          "x-vqd-accept": "1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(10000)
      });

      const vqd = statusRes.headers.get("x-vqd-4");
      if (!vqd) {
        // Back off so we don't burn 10s on every request while DDG is blocking us
        this._ddgDisabledUntil = Date.now() + DDG_DOWN_MS;
        throw new Error("Unable to obtain DuckDuckGo VQD handshake token");
      }

      const ddgModel = this.mapDuckDuckGoModel(model);

      // 2. Chat with DuckDuckGo
      const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vqd-4": vqd,
          "x-vqd-accept": "1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        },
        body: JSON.stringify({ model: ddgModel, messages: safeMessages }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!chatRes.ok) {
        throw new Error(`DuckDuckGo Chat API returned status ${chatRes.status}`);
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let completionChars = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop(); // Keep partial line

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.message) {
                completionChars += parsed.message.length;
                const chunk = {
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: model,
                  choices: [
                    { index: 0, delta: { content: parsed.message }, finish_reason: null }
                  ]
                };
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
              }
            } catch (e) {
              // Ignore non-json lines
            }
          }
        }

        res.write("data: [DONE]\n\n");
        res.end();
        return {
          streamed: true,
          promptTokens: this._estimatePromptTokens(safeMessages),
          completionTokens: this._estimateTokens("x".repeat(completionChars))
        };
      } else {
        // Collect entire stream
        const text = await chatRes.text();
        let fullContent = "";
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.message) fullContent += parsed.message;
            } catch (e) {}
          }
        }

        if (!fullContent) throw new Error("DuckDuckGo returned an empty response");

        return {
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            { index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }
          ],
          usage: {
            prompt_tokens: this._estimatePromptTokens(safeMessages),
            completion_tokens: this._estimateTokens(fullContent),
            total_tokens: this._estimatePromptTokens(safeMessages) + this._estimateTokens(fullContent)
          }
        };
      }
    } catch (err) {
      // Do NOT silently fall back to Pollinations here: that masked the real
      // DuckDuckGo error and made a ddg-* request report a Pollinations failure.
      // proxyService owns the failover chain, so surface an honest error instead.
      console.warn("DuckDuckGo request failed:", err.message);
      throw new UpstreamError(
        `DuckDuckGo không phản hồi (${err.message}). Nguồn này thỉnh thoảng chặn handshake VQD theo IP — thử lại sau ít phút.`,
        503,
        "duckduckgo_unavailable"
      );
    }
  }

  mapPollinationsModel(modelId = "") {
    const lower = String(modelId || "").toLowerCase();
    if (lower.includes("r1")) return "deepseek-r1";
    if (lower.includes("coder") || lower.includes("qwen")) return "qwen-coder";
    if (lower.includes("deepseek")) return "deepseek";
    if (lower.includes("llama")) return "llama";
    if (lower.includes("mistral")) return "mistral";
    if (lower.includes("search") || lower.includes("gemini")) return "searchgpt";
    return "openai-fast";
  }

  mapDuckDuckGoModel(modelId = "") {
    const lower = modelId.toLowerCase();
    if (lower.includes("claude")) return "claude-3-haiku-20240307";
    if (lower.includes("llama")) return "meta-llama/Llama-3.3-70B-Instruct-Turbo";
    if (lower.includes("mixtral") || lower.includes("mistral")) return "mistralai/Mixtral-8x7B-Instruct-v0.1";
    return "gpt-4o-mini";
  }
}

module.exports = new FreeProxyService();
module.exports.UpstreamError = UpstreamError;
module.exports.looksLikeRefusal = looksLikeRefusal;
