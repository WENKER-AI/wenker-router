const db = require('./dbService');
const freeProxyService = require('./freeProxyService');
const quota = require('./quotaService');
const { UpstreamError } = freeProxyService;

class ProxyService {
  /**
   * Clients such as Cline prefix the model with their own profile label
   * ("openai-compatible:ddg-gpt-4o-mini", "claude-code/gpt-4o"...). Strip those
   * labels so the real model id can still be resolved.
   */
  _stripClientPrefixes(name) {
    let out = String(name || '').trim();
    const known = ['openai-compatible', 'anthropic-compatible', 'wenker', 'proxy', 'local'];
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of known) {
        if (new RegExp(`^${p}:`, 'i').test(out)) {
          out = out.replace(new RegExp(`^${p}:`, 'i'), '');
          changed = true;
        }
      }
    }
    return out || String(name || '').trim();
  }

  /**
   * Resolve provider and target model based on request model.
   * Returns { provider, targetModel, requested, known } where `known` is false
   * when nothing matched and we fell back to the default provider.
   */
  resolveProviderAndModel(requestedModel) {
    const routing = db.getRoutingRules();
    let model = requestedModel || "wenker-deepseek-r1-free";

    // 1. Check aliases first
    if (routing.aliases && routing.aliases[model]) {
      model = routing.aliases[model];
    }

    const enabled = () => db.getAllProviders().filter(p => p.enabled);

    // 2. Check if model has format "providerId/modelName"
    if (model.includes('/')) {
      const [pId, ...rest] = model.split('/');
      const mName = rest.join('/');
      const provider = db.getProviderById(pId);
      if (provider) {
        // Qualified id "provider/model". The model part is resolved through the
        // provider's own catalog so an alias id can carry a targetModel (needed by
        // xkiro/izzi, whose real slugs contain '/' and would otherwise be re-split and
        // mis-routed to a different provider). Unknown model names still pass through
        // as-is, because custom and local runtimes serve models we cannot know statically.
        const found = (provider.models || []).find(m => m.id === mName || m.targetModel === mName);
        return { provider, targetModel: found?.targetModel || mName, requested: model, known: true, modelKnown: Boolean(found) };
      }
      // Unknown provider prefix -> keep only the model part and continue matching
      model = mName || this._stripClientPrefixes(mName);
    }

    // 3. Strip client profile prefixes and search enabled providers by model id
    const bare = this._stripClientPrefixes(model);
    const providers = enabled();
    for (const candidate of [model, bare]) {
      for (const p of providers) {
        const found = p.models?.find(m => m.id === candidate);
        if (found) {
          return { provider: p, targetModel: found.targetModel || candidate, requested: model, known: true, modelKnown: true };
        }
      }
    }

    // 4. Loose match: a provider model id ending with the requested name
    //    (helps "ddg-gpt-4o-mini" style ids typed without the full prefix)
    if (bare && bare !== model) {
      for (const p of providers) {
        const found = p.models?.find(m => m.id.endsWith(bare));
        if (found) {
          return { provider: p, targetModel: found.targetModel || found.id, requested: model, known: true, modelKnown: true };
        }
      }
    }

    // 5. Default to WENKER Cloud (flagged as unknown so callers can warn honestly)
    const defaultP = db.getProviderById("wenker-cloud") || providers[0];
    return { provider: defaultP, targetModel: model, requested: model, known: false, modelKnown: false };
  }

  /**
   * A short, honest "model not available" answer listing what actually works right
   * now, instead of silently routing to a dead upstream and returning 500500.
   */
  _modelNotFound(res, requested, provider) {
    const providers = db.getAllProviders().filter(p => p.enabled);
    const candidates = [];
    for (const p of providers) {
      for (const m of (p.models || [])) {
        if (candidates.length >= 15) break;
        candidates.push(`${p.id}/${m.id}`);
      }
      if (candidates.length >= 15) break;
    }
    const health = db.getHealth();
    const alive = providers.filter(p => {
      const h = health[p.id];
      return !h || h.ok;
    }).slice(0, 6).map(p => p.name);
    return res.status(404).json({
      error: {
        message: `Model "${requested}" khong ton tai trong router. Provider mac dinh "${provider ? provider.name : 'WENKER Cloud'}" cung khong biet model nay.`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found",
        hint: "Dinh dang duoc ho tro: \"providerId/modelId\" (vi du openrouter/deepseek/deepseek-r1:free) hoac ten model trong danh sach below. Lay danh sach day du: GET /v1/models.",
        available_models: candidates,
        providers_currently_alive: alive
      }
    });
  }

  /**
   * Direct OpenAI-compatible call used by the failover chain (non-streaming).
   */
  async _directChat(provider, targetModel, messages) {
    const apiKey = provider.userApiKey || "";
    if (provider.requiresAuth && !apiKey) throw new Error(`${provider.name}: chua cau hinh API Key`);
    const base = String(provider.baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error(`${provider.name}: thieu Base URL`);
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'WENKER-Router/2.0' };
    if (apiKey) {
      if (provider.authType === 'api-key') headers[provider.headerName || 'x-api-key'] = apiKey;
      else if (provider.authType === 'cookie') headers['Cookie'] = provider.userCookie || apiKey;
      else headers['Authorization'] = provider.authType === 'bearer' ? `Bearer ${apiKey}` : apiKey;
    }
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: targetModel, messages, stream: false }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      const e = new UpstreamError(`${provider.name} HTTP ${r.status}: ${t.slice(0, 160)}`, r.status);
      throw e;
    }
    return await r.json();
  }

  /**
   * Failover chain: when the requested free upstream is down, walk
   * settings.fallbackOrder looking for anything that actually answers.
   * Returns { data, providerId } or null when nothing works.
   */
  async _runFailoverChain(messages, excludeIds) {
    const settings = db.getSettings();
    const order = Array.isArray(settings.fallbackOrder) ? settings.fallbackOrder : [];
    const tried = new Set(excludeIds || []);
    const errors = [];

    for (const id of order) {
      if (tried.has(id)) continue;
      tried.add(id);
      const provider = db.getProviderById(id);
      if (!provider || !provider.enabled) continue;
      // A fallback provider only "accepts" when it returns choices AND the text is a real
      // answer, not an upstream budget/refusal message smuggled back in an HTTP 200. This
      // is the belt-and-suspenders guard: even if a given upstream path (duckduckgo, a
      // direct chat call) slips a refusal through, we treat it as a failure and keep
      // walking the chain instead of returning a fake success to the client.
      const accept = (data) => {
        if (!data || !data.choices) return false;
        const content = data.choices?.[0]?.message?.content || "";
        if (freeProxyService.looksLikeRefusal(content)) {
          throw new Error("upstream refusal in HTTP 200");
        }
        return true;
      };
      try {
        // Pollinations only while the provider still points at pollinations.ai. A WENKER
        // tier re-pointed to xkiro/izzi falls through to _directChat with its own key.
        if (freeProxyService.isPollinationsProvider(provider)) {
          const data = await freeProxyService.handlePollinations({ model: id === 'wenker-cloud' ? 'wenker-deepseek-v3-free' : id, messages, stream: false, targetModel: provider.models?.find(m => m.id === 'wenker-deepseek-v3-free')?.targetModel || 'openai-fast' });
          if (accept(data)) return { data, providerId: id };
          throw new Error('empty response');
        }
        if (id === 'duckduckgo') {
          const data = await freeProxyService.handleDuckDuckGo({ model: 'ddg-gpt-4o-mini', messages, stream: false, res: null });
          if (accept(data)) return { data, providerId: id };
          throw new Error('empty response');
        }
        const model = provider.models?.[0];
        const data = await this._directChat(provider, model?.targetModel || model?.id, messages);
        if (accept(data)) return { data, providerId: id };
        throw new Error('empty response');
      } catch (err) {
        errors.push(`${id}: ${err.message}`);
        console.warn(`[Failover] ${err.message}`);
      }
    }
    console.warn(`[Failover] chain exhausted (${errors.length} attempts)`);
    return null;
  }

  /**
   * A model is "non-chat" when its upstream endpoint is not a chat-completions API:
   * image (SD/ComfyUI/Midjourney/FLUX/Ideogram), video (Sora/Runway/Luma/Kling),
   * speech-in (Whisper/Deepgram/AssemblyAI/Speechmatics) or speech-out (ElevenLabs,
   * Cartesia, Coqui, Neets, Bark, MusicGen). This router only exposes /chat/completions
   * and /embeddings, so such models can NEVER answer a chat request. Detect them from
   * the upstream baseUrl (the most reliable signal we have) so we can fail honestly
   * instead of (a) claiming "cần API key" and (b) burning quota on a fallback chain
   * that routes an image model to a text upstream.
   */
  _NON_CHAT_URL = /(sdapi|comfyui|\/mj\b|bfl\.ml|flux|ideogram|\/image|\/video|sora|runwayml|dream-?machine|klingai|transcription|\/audio|\/music|\/speech|text-to-speech|\/tts|elevenlabs|cartesia|deepgram|assemblyai|speechmatics|neets|bark|musicgen|audiocraft|whisper|coqui)/i;
  isNonChatProvider(provider) {
    if (!provider) return false;
    // Test the whole baseUrl: distinctive brands (bfl.ml, elevenlabs, deepgram...) and
    // non-chat path segments (sdapi, /v1/sora, /audio, /tts...). None of these tokens
    // appears in a real chat-completions provider (mistral/cohere/perplexity use /v1).
    return this._NON_CHAT_URL.test(String(provider.baseUrl || ""));
  }

  // Human-readable modality for the honest rejection message, matched from baseUrl.
  _modalityLabel(provider) {
    const base = String(provider?.baseUrl || "").toLowerCase();
    if (/(transcription|deepgram|assemblyai|speechmatics|whisper)/.test(base)) return "nhận dạng giọng nói (STT)";
    if (/(tts|elevenlabs|cartesia|neets|coqui|bark|musicgen|audiocraft|\/speech|text-to-speech|\/audio|\/music)/.test(base)) return "âm thanh (TTS/audio)";
    if (/(sora|runwayml|dream-?machine|klingai|\/video)/.test(base)) return "tạo video";
    if (/(sdapi|comfyui|flux|bfl|ideogram|\/mj\b|midjourney|\/image)/.test(base)) return "tạo ảnh";
    return "không phải chat";
  }

  /**
   * Main handler for OpenAI Chat Completions
   */
  async handleChatCompletion({ req, res, body, wenkerKey }) {
    const startTime = Date.now();
    const { model, stream = false, temperature, max_tokens, tools, tool_choice } = body;
    const messages = freeProxyService.normalizeMessages(body.messages);

    // Tool-calling is only honest on a REAL OpenAI-compatible upstream. The free
    // no-auth paths (Pollinations / DuckDuckGo) cannot answer with tool_calls -
    // they would return plain text and every agent loop would silently stall. So
    // when a client sends tools, refuse up front with an actionable 400 instead
    // of pretending to support them.
    const hasTools = Array.isArray(tools) && tools.length > 0;
    const toolGuardProvider = this.resolveProviderAndModel(model).provider;
    if (hasTools && toolGuardProvider &&
        (freeProxyService.isPollinationsProvider(toolGuardProvider) || toolGuardProvider.id === "duckduckgo")) {
      db.addLog({
        endpoint: "/v1/chat/completions",
        model: model || null,
        resolvedModel: null,
        providerId: toolGuardProvider.id,
        status: 400,
        latencyMs: Date.now() - startTime,
        promptTokens: 0,
        completionTokens: 0,
        stream: Boolean(stream),
        clientIp: req.ip || "127.0.0.1",
        error: "tools_not_supported"
      });
      return res.status(400).json({
        error: {
          message: `Model "${model}" đang đi qua nguồn miễn phí không key (${toolGuardProvider.name}), nguồn này KHÔNG hỗ trợ tool calling. Hãy chọn một model từ provider có API key miễn phí (Groq / OpenRouter / Gemini / NVIDIA - dán key free vào tab "Nhà Cung Cấp") rồi gọi lại.`,
          type: "invalid_request_error",
          param: "tools",
          code: "tools_not_supported",
          hint: "WENKER Studio / agent loop: dung model groq llama-3.3-70b hoặc openrouter deepseek-r1 - ca hai loai key mien phi."
        }
      });
    }

    // Validate required fields instead of crashing later with a 500
    if (messages.length === 0) {
      db.addLog({
        endpoint: "/v1/chat/completions",
        model: model || null,
        resolvedModel: null,
        providerId: null,
        status: 400,
        latencyMs: Date.now() - startTime,
        promptTokens: 0,
        completionTokens: 0,
        stream: Boolean(stream),
        clientIp: req.ip || "127.0.0.1"
      });
      return res.status(400).json({
        error: {
          message: "Thiếu tham số bắt buộc \"messages\": phải là mảng { role, content } không rỗng.",
          type: "invalid_request_error",
          param: "messages",
          code: "missing_required_parameter"
        }
      });
    }

    const resolved = this.resolveProviderAndModel(model);
    const provider = resolved.provider;
    const targetModel = resolved.targetModel;

    if (!provider) {
      return res.status(404).json({
        error: {
          message: `Không tìm thấy nhà cung cấp cho model "${model}". Kiểm tra tab "Nhà Cung Cấp" hoặc tạo alias trong tab "Định Tuyến".`,
          type: "invalid_request_error",
          param: "model",
          code: "model_not_found"
        }
      });
    }

    // An unknown model name used to be routed silently to the dead default upstream and
    // came back as a confusing 500500. Answer 404 with the models that really exist.
    if (!resolved.known && db.getSettings().strictModelResolution !== false) {
      return this._modelNotFound(res, model, provider);
    }

    // Image / video / speech models cannot answer a chat request at all: this router only
    // exposes /chat/completions and /embeddings. Reject them up front so they neither burn
    // the shared WENKER quota nor get "fallback"-ed to a text upstream that would return an
    // unrelated answer. This is an honest 400, not a fake success.
    if (this.isNonChatProvider(provider)) {
      db.addLog({
        endpoint: "/v1/chat/completions",
        model,
        resolvedModel: targetModel,
        providerId: provider.id,
        status: 400,
        latencyMs: Date.now() - startTime,
        promptTokens: 0,
        completionTokens: 0,
        stream: Boolean(stream),
        clientIp: req.ip || "127.0.0.1"
      });
      return res.status(400).json({
        error: {
          message:
            `"${model}" (nhà cung cấp ${provider.name}) là model ${this._modalityLabel(provider)} ` +
            "không phải model chat, nên không phục vụ được qua /v1/chat/completions. " +
            "Router WENKER hiện chỉ có /v1/chat/completions và /v1/embeddings. " +
            "Hãy chọn một model chat (ví dụ trong danh sách /v1/models).",
          type: "invalid_request_error",
          param: "model",
          code: "unsupported_modality",
          modality: this._modalityLabel(provider)
        }
      });
    }

    // Cached answers cost no upstream budget: serve them before quota and network.
    // Requests carrying tools bypass the cache entirely: the key covers only
    // model+messages (not the tool schema), and a cached plain-text answer would
    // silently swallow the model's tool_calls on replay.
    const cacheKey = db.cacheKey(targetModel, messages);
    const cached = hasTools ? null : db.cacheGet(cacheKey);
    if (cached) {
      const cPrompt = cached.usage?.prompt_tokens || this._estimatePromptTokens(messages);
      const cCompletion = cached.usage?.completion_tokens || this._estimateTokens(cached.content);
      db.addLog({
        endpoint: "/v1/chat/completions",
        model,
        resolvedModel: targetModel,
        providerId: provider.id,
        status: 200,
        latencyMs: Date.now() - startTime,
        promptTokens: cPrompt,
        completionTokens: cCompletion,
        stream: Boolean(stream),
        cached: true,
        clientIp: req.ip || "127.0.0.1"
      });
      if (stream) {
        await freeProxyService._writeSse(res, model, cached.content);
        return { streamed: true, cached: true };
      }
      return res.json({
        id: `chatcmpl-cache-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: targetModel,
        choices: [{ index: 0, message: { role: "assistant", content: cached.content }, finish_reason: "stop" }],
        usage: { prompt_tokens: cPrompt, completion_tokens: cCompletion, total_tokens: cPrompt + cCompletion },
        cached: true
      });
    }

    // WENKER Cloud and its free twins share one anonymous upstream budget, so every
    // consumer (login user / API key / anon IP) is metered against a daily allowance.
    const quotaSubject = quota.resolveSubject(req);
    const isMetered = quota.meteredProviders.includes(provider.id);

    if (isMetered && !quota.tryConsume(quotaSubject, this._estimatePromptTokens(messages))) {
      db.addLog({
        endpoint: "/v1/chat/completions",
        model,
        resolvedModel: targetModel,
        providerId: provider.id,
        status: 409,
        latencyMs: Date.now() - startTime,
        promptTokens: 0,
        completionTokens: 0,
        stream: Boolean(stream),
        clientIp: req.ip || req.headers['x-forwarded-for'] || "127.0.0.1",
        quotaSubject: quotaSubject.id
      });
      return quota.respondExhausted(req, res, quotaSubject);
    }

    try {
      // 1. Free No-Auth Providers (Pollinations anonymous tier only).
      // The decision is made on baseUrl, not id: WENKER Cloud / VIP / Community are
      // re-pointable, and once aimed at xkiro / izzi they must fall through to the
      // generic keyed branch below (Bearer + /chat/completions) instead of being
      // forced through handlePollinations.
      if (freeProxyService.isPollinationsProvider(provider)) {
        let result;
        let servedBy = provider.id;
        try {
          result = await freeProxyService.handlePollinations({
            model,
            messages,
            stream,
            res,
            targetModel
          });
        } catch (freeErr) {
          // Free upstream is down (402 / open circuit): walk the configured fallback
          // chain so the client still gets an answer when any other source is alive.
          if (res.headersSent || !db.getSettings().enableSmartFallback) throw freeErr;
          const fb = await this._runFailoverChain(messages, [provider.id]);
          if (!fb) throw freeErr;
          servedBy = fb.providerId;
          const fbContent = fb.data.choices?.[0]?.message?.content || "";
          if (stream) {
            await freeProxyService._writeSse(res, fb.data.model || model, fbContent);
            result = {
              streamed: true,
              promptTokens: fb.data.usage?.prompt_tokens || this._estimatePromptTokens(messages),
              completionTokens: fb.data.usage?.completion_tokens || this._estimateTokens(fbContent)
            };
          } else {
            result = fb.data;
          }
        }

        const latency = Date.now() - startTime;
        const promptTokens = result.promptTokens || this._estimatePromptTokens(messages);
        const completionTokens = result.completionTokens || 0;
        db.addLog({
          endpoint: "/v1/chat/completions",
          model,
          resolvedModel: result.servedModel || result.model || targetModel,
          providerId: servedBy,
          ...(servedBy !== provider.id ? { fallbackFrom: provider.id, fallbackReason: "upstream_down" } : {}),
          status: 200,
          latencyMs: latency,
          promptTokens,
          completionTokens,
          stream: Boolean(stream),
          clientIp: req.ip || req.headers['x-forwarded-for'] || "127.0.0.1"
        });
        db.incrementKeyUsage(wenkerKey, promptTokens, completionTokens);
        if (isMetered) quota.commit(quotaSubject, promptTokens, completionTokens);
        if (!stream && result.choices) {
          db.cacheSet(cacheKey, result.choices[0]?.message?.content || "", result.usage);
        }

        if (!stream && !res.headersSent) {
          return res.json(result);
        }
        return result;
      }

      if (provider.id === "duckduckgo") {
        let result;
        let ddgServedBy = provider.id;
        try {
          result = await freeProxyService.handleDuckDuckGo({
            model,
            messages,
            stream,
            res
          });
        } catch (ddgErr) {
          if (res.headersSent || !db.getSettings().enableSmartFallback) throw ddgErr;
          const fb = await this._runFailoverChain(messages, [provider.id]);
          if (!fb) throw ddgErr;
          ddgServedBy = fb.providerId;
          const fbContent = fb.data.choices?.[0]?.message?.content || "";
          if (stream) {
            await freeProxyService._writeSse(res, fb.data.model || model, fbContent);
            result = { streamed: true, model: fb.data.model, promptTokens: this._estimatePromptTokens(messages), completionTokens: this._estimateTokens(fbContent) };
          } else {
            result = fb.data;
          }
        }

        const latency = Date.now() - startTime;
        const promptTokens = result.promptTokens || this._estimatePromptTokens(messages);
        const completionTokens = result.completionTokens || 0;
        db.addLog({
          endpoint: "/v1/chat/completions",
          model,
          resolvedModel: result.servedModel || result.model || targetModel,
          providerId: ddgServedBy,
          ...(ddgServedBy !== provider.id ? { fallbackFrom: provider.id, fallbackReason: "upstream_down" } : {}),
          status: 200,
          latencyMs: latency,
          promptTokens,
          completionTokens,
          stream: Boolean(stream),
          clientIp: req.ip || "127.0.0.1"
        });
        db.incrementKeyUsage(wenkerKey, promptTokens, completionTokens);
        if (isMetered) quota.commit(quotaSubject, promptTokens, completionTokens);

        if (!stream && !res.headersSent) {
          return res.json(result);
        }
        return result;
      }

      // 2. Generic Upstream Provider (OpenAI Compatible)
      const apiKey = provider.userApiKey || (req.headers.authorization && !req.headers.authorization.includes("sk-wenker") ? req.headers.authorization.replace(/^Bearer\s+/i, '') : "");
      
      // A provider that demands a key but has none configured used to be silently
      // rerouted to WENKER Cloud ("smart fallback"), which made EVERY keyless model
      // look like it worked (200 OK from the wrong upstream). Answer a real 401 now.
      if (provider.requiresAuth && !apiKey) {
        db.addLog({
          endpoint: "/v1/chat/completions",
          model,
          resolvedModel: targetModel,
          providerId: provider.id,
          status: 401,
          latencyMs: Date.now() - startTime,
          promptTokens: 0,
          completionTokens: 0,
          stream: Boolean(stream),
          clientIp: req.ip || "127.0.0.1",
          error: "missing_api_key"
        });
        return res.status(401).json({
          error: {
            message: `Nhà cung cấp "${provider.name}" yêu cầu API Key nhưng chưa được cấu hình. Router KHÔNG âm thầm chuyển sang provider khác nữa (hành vi cũ khiến mọi model như đều chạy được, nhưng thực tế chỉ một nguồn trả lời).`,
            type: "authentication_error",
            param: null,
            code: "missing_api_key",
            hint: provider.keyHelp
              ? `Vào tab "Nhà Cung Cấp" -> ${provider.name} -> dán key. ${provider.keyHelp}`
              : `Vào tab "Nhà Cung Cấp" -> ${provider.name} -> nhập API Key miễn phí rồi gọi lại.`
          }
        });
      }

      // Build Base URL & headers
      let targetUrl = provider.baseUrl.replace(/\/+$/, '');
      if (!targetUrl.endsWith('/chat/completions')) {
        targetUrl += '/chat/completions';
      }

      const upstreamHeaders = {
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json',
        'User-Agent': 'WENKER-Router/2.0'
      };

      if (apiKey) {
        if (provider.authType === 'bearer') {
          upstreamHeaders['Authorization'] = `Bearer ${apiKey}`;
        } else if (provider.authType === 'api-key') {
          upstreamHeaders[provider.headerName || 'x-api-key'] = apiKey;
        } else if (provider.authType === 'cookie') {
          upstreamHeaders['Cookie'] = provider.userCookie || apiKey;
        } else {
          upstreamHeaders[provider.headerName || 'Authorization'] = apiKey;
        }
      }

      // Add user custom headers if any
      if (provider.userHeaders) {
        Object.assign(upstreamHeaders, provider.userHeaders);
      }

      const upstreamPayload = {
        model: targetModel,
        messages,
        stream: Boolean(stream),
        ...(temperature !== undefined && { temperature }),
        ...(max_tokens !== undefined && { max_tokens }),
        // Forward function/tool calling verbatim (OpenAI-compatible upstreams).
        // Without this the router silently dropped every agent's tool schema and
        // the model could never emit tool_calls.
        ...(hasTools && { tools }),
        ...(hasTools && tool_choice !== undefined && { tool_choice })
      };

      const upstreamRes = await fetch(targetUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(upstreamPayload),
        signal: AbortSignal.timeout(60000)
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        console.error(`Upstream error (${provider.name}):`, upstreamRes.status, errText);

        // Fallback to WENKER Cloud if enabled. Skipped for tool requests: the
        // failover chain replays plain messages (no tool schema), so any answer
        // it returns would be a lie for an agent loop. Surface the real error.
        const settings = db.getSettings();
        if (settings.enableSmartFallback && !res.headersSent && !hasTools) {
          console.log(`[Failover] Provider ${provider.name} failed with ${upstreamRes.status}. Falling back to WENKER Cloud.`);
          if (!quota.tryConsume(quotaSubject, this._estimatePromptTokens(messages))) {
            return quota.respondExhausted(req, res, quotaSubject);
          }
          try {
            const fb = await this._runFailoverChain(messages, [provider.id]);
            if (!fb) throw new Error('khong con nguon mien phi nao song');
            const fbContent = fb.data.choices?.[0]?.message?.content || '';
            const fbPrompt = fb.data.usage?.prompt_tokens || this._estimatePromptTokens(messages);
            const fbCompletion = fb.data.usage?.completion_tokens || this._estimateTokens(fbContent);
            if (stream) {
              await freeProxyService._writeSse(res, fb.data.model || model, fbContent);
            } else {
              db.cacheSet(cacheKey, fbContent, fb.data.usage);
            }
            // Honest bookkeeping: the ANSWER came from fb.providerId, not the called provider.
            fb.data.wenker_fallback_from = provider.id;
            db.addLog({
              endpoint: "/v1/chat/completions",
              model,
              resolvedModel: fb.data.servedModel || fb.data.model || targetModel,
              providerId: fb.providerId,
              fallbackFrom: provider.id,
              fallbackReason: `upstream_http_${upstreamRes.status}`,
              status: 200,
              latencyMs: Date.now() - startTime,
              promptTokens: fbPrompt,
              completionTokens: fbCompletion,
              stream: Boolean(stream),
              clientIp: req.ip || "127.0.0.1"
            });
            db.incrementKeyUsage(wenkerKey, fbPrompt, fbCompletion);
            quota.commit(quotaSubject, fbPrompt, fbCompletion);
            if (!stream && !res.headersSent) {
              return res.json(fb.data);
            }
            return { streamed: Boolean(stream) };
          } catch (fbErr) {
            console.error(`[Failover] WENKER Cloud fallback also failed: ${fbErr.message}`);
            return res.status(upstreamRes.status || 502).json({
              error: {
                message: `${provider.name} trả về lỗi HTTP ${upstreamRes.status}, và phương án dự phòng miễn phí cũng không khả dụng: ${fbErr.message}`,
                type: "upstream_error",
                code: upstreamRes.status || 502,
                hint: "Nguồn miễn phí đang chết. Nhap API Key mien phi cho OpenRouter / Groq / Gemini / NVIDIA / SambaNova trong tab Nha Cung Cap, hoac cai Ollama chay local."
              }
            });
          }
        }

        if (res.headersSent) {
          return res.end();
        }
        return res.status(upstreamRes.status).json({
          error: {
            message: `Lỗi từ ${provider.name}: ${errText.slice(0, 300)}`,
            type: "upstream_error",
            code: upstreamRes.status
          }
        });
      }

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = upstreamRes.body.getReader();
        const sseDecoder = new TextDecoder('utf-8');
        let sseBuffer = '';
        let streamedChars = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Count real content characters from SSE deltas for honest token estimates
          sseBuffer += sseDecoder.decode(value, { stream: true });
          const sseLines = sseBuffer.split('\n');
          sseBuffer = sseLines.pop();
          for (const line of sseLines) {
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === 'string') streamedChars += delta.length;
            } catch (e) { /* ignore partial/non-json lines */ }
          }
          res.write(value);
        }
        res.end();

        const latency = Date.now() - startTime;
        const promptTokens = this._estimatePromptTokens(messages);
        const completionTokens = this._estimateTokens('x'.repeat(streamedChars));
        db.addLog({
          endpoint: "/v1/chat/completions",
          model,
          resolvedModel: targetModel,
          providerId: provider.id,
          status: 200,
          latencyMs: latency,
          promptTokens,
          completionTokens,
          stream: true,
          clientIp: req.ip || "127.0.0.1"
        });
        db.incrementKeyUsage(wenkerKey, promptTokens, completionTokens);
        if (isMetered) quota.commit(quotaSubject, promptTokens, completionTokens);

        return { streamed: true };
      } else {
        const data = await upstreamRes.json();
        const latency = Date.now() - startTime;
        const promptTokens = data.usage?.prompt_tokens || this._estimatePromptTokens(messages);
        const completionTokens = data.usage?.completion_tokens || this._estimateTokens(data.choices?.[0]?.message?.content);
        // Tell the client which model really answered (alias ids can differ).
        data.wenker_served_by = data.model || targetModel;
        db.addLog({
          endpoint: "/v1/chat/completions",
          model,
          resolvedModel: data.model || targetModel,
          providerId: provider.id,
          status: 200,
          latencyMs: latency,
          promptTokens,
          completionTokens,
          stream: false,
          clientIp: req.ip || "127.0.0.1"
        });
        db.incrementKeyUsage(wenkerKey, promptTokens, completionTokens);
        if (isMetered) quota.commit(quotaSubject, promptTokens, completionTokens);
        // Cache generic answers too, so a repeated prompt never re-spends upstream budget.
        // Tool results are never cached: they are conversation state, not an answer.
        if (data.choices && !hasTools) db.cacheSet(cacheKey, data.choices?.[0]?.message?.content || "", data.usage);

        return res.json(data);
      }
    } catch (err) {
      console.error("Proxy Service Exception:", err);
      const latency = Date.now() - startTime;
      db.addLog({
        endpoint: "/v1/chat/completions",
        model,
        resolvedModel: targetModel,
        providerId: provider ? provider.id : null,
        status: 500,
        latencyMs: latency,
        promptTokens: 0,
        completionTokens: 0,
        stream: Boolean(stream),
        clientIp: req.ip || "127.0.0.1",
        error: err.message
      });

      // If the response was already partially streamed we cannot send a JSON error
      if (res.headersSent) {
        return res.end();
      }

      // No simulated content: report the real failure, with the honest upstream status
      // (402/403/429/503) instead of wrapping everything in a mysterious 500500.
      const upstreamStatus = Number(err.status);
      const status = [401, 402, 403, 404, 408, 429, 502, 503, 504].includes(upstreamStatus) ? upstreamStatus : 500;
      return res.status(status).json({
        error: {
          message: `Xử lý yêu cầu thất bại: ${err.message}`,
          type: status === 500 ? "internal_error" : "upstream_error",
          param: null,
          code: err.code || status,
          hint: err.hint || "Thu lai sau it phut, hoac mo tab 'Nha Cung Cap' de nhap API Key mien phi (OpenRouter/Groq/Gemini/NVIDIA) va chuyen model sang provider do."
        }
      });
    }
  }

  /**
   * Handle Anthropic Messages format (/v1/messages) for Claude Code / Cline
   */
  async handleAnthropicMessages({ req, res, body, wenkerKey }) {
    const { model, messages, system, stream = false, max_tokens = 4096 } = body;

    // Transform Anthropic messages structure to OpenAI format for universal routing
    const openAiMessages = [];
    if (system) {
      openAiMessages.push({ role: "system", content: typeof system === "string" ? system : JSON.stringify(system) });
    }

    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (!msg || typeof msg !== "object") continue;
        let textContent = "";
        if (typeof msg.content === "string") {
          textContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          textContent = msg.content.map(c => (typeof c === "string" ? c : c?.text || JSON.stringify(c))).join("\n");
        }
        openAiMessages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: textContent });
      }
    }

    const normalized = freeProxyService.normalizeMessages(openAiMessages);
    if (normalized.length === 0) {
      return res.status(400).json({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Thiếu tham số bắt buộc \"messages\": phải là mảng { role, content } không rỗng."
        }
      });
    }

    // Anthropic streaming writes SSE headers below, so the quota gate must run first
    // to be able to answer a clean 409 (Anthropic error shape) instead of a broken stream.
    const anthQuotaSubject = quota.resolveSubject(req);
    const { provider: anthProvider } = this.resolveProviderAndModel(model);
    const anthMetered = anthProvider && quota.meteredProviders.includes(anthProvider.id);
    if (anthMetered && !quota.tryConsume(anthQuotaSubject, this._estimatePromptTokens(normalized))) {
      return quota.respondExhausted(req, res, anthQuotaSubject);
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send Anthropic initial events
      const messageId = `msg_${Date.now()}`;
      res.write(`event: message_start\ndata: ${JSON.stringify({
        type: "message_start",
        message: {
          id: messageId,
          type: "message",
          role: "assistant",
          content: [],
          model: model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 25, output_tokens: 1 }
        }
      })}\n\n`);

      res.write(`event: content_block_start\ndata: ${JSON.stringify({
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" }
      })}\n\n`);

      // Mock a response writer to catch chunks and convert to Anthropic SSE.
      // NOTE: incoming SSE lines can be split across writes, so buffer them.
      let sseBuffer = "";
      let finished = false;

      const finishAnthropicStream = (outputTokens) => {
        if (finished) return;
        finished = true;
        res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
        res.write(`event: message_delta\ndata: ${JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: outputTokens }
        })}\n\n`);
        res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
        res.end();
      };

      const emitDelta = (text) => {
        res.write(`event: content_block_delta\ndata: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text }
        })}\n\n`);
      };

      const consumeLine = (line) => {
        if (!line.startsWith("data:")) return;
        const dataStr = line.slice(5).trim();
        if (!dataStr) return;
        if (dataStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(dataStr);
          const deltaText = parsed.choices?.[0]?.delta?.content;
          if (deltaText) {
            outputChars += deltaText.length;
            emitDelta(deltaText);
          }
        } catch (e) {
          // Not valid JSON (partial write) -> keep it buffered for the next chunk
          sseBuffer = line + "\n";
        }
      };

      let outputChars = 0;

      const mockRes = {
        headersSent: false,
        setHeader: () => {},
        status: (code) => ({
          json: (errBody) => {
            finished = true;
            res.status(code).json({ type: "error", error: { type: "api_error", message: errBody?.error?.message || "Upstream error" } });
          }
        }),
        write: (chunk) => {
          mockRes.headersSent = true;
          sseBuffer += chunk.toString();
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop(); // keep the trailing partial line
          for (const line of lines) consumeLine(line.trimEnd());
        },
        end: () => {
          if (sseBuffer) { consumeLine(sseBuffer.trimEnd()); sseBuffer = ""; }
          finishAnthropicStream(Math.ceil(outputChars / 4));
        }
      };

      try {
        await this.handleChatCompletion({
          req,
          res: mockRes,
          body: { model, messages: normalized, stream: true },
          wenkerKey
        });
      } catch (err) {
        console.error("Anthropic stream error:", err);
        if (!finished) {
          finished = true;
          if (!res.headersSent) {
            res.status(500).json({ type: "error", error: { type: "api_error", message: err.message } });
          } else {
            res.end();
          }
        }
      }

    } else {
      // Non-streaming
      const mockRes = {
        headersSent: false,
        statusCode: 200,
        setHeader: () => {},
        write: () => { mockRes.headersSent = true; },
        end: () => { mockRes.headersSent = true; },
        status: (code) => {
          mockRes.statusCode = code;
          mockRes.headersSent = true;
          return {
            json: (errBody) => {
              res.status(code).json({
                type: "error",
                error: {
                  type: code === 400 ? "invalid_request_error" : "api_error",
                  message: errBody?.error?.message || "Upstream error"
                }
              });
            }
          };
        },
        json: (data) => {
          mockRes.headersSent = true;
          const replyText = data.choices?.[0]?.message?.content || "";
          res.json({
            id: `msg_${Date.now()}`,
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: replyText }],
            model: model,
            stop_reason: "end_turn",
            usage: {
              input_tokens: data.usage?.prompt_tokens || this._estimatePromptTokens(normalized),
              output_tokens: data.usage?.completion_tokens || this._estimateTokens(replyText)
            }
          });
        }
      };

      await this.handleChatCompletion({
        req,
        res: mockRes,
        body: { model, messages: normalized, stream: false },
        wenkerKey
      });

      // Safety net: upstream handler returned without producing a response
      if (!mockRes.headersSent && !res.headersSent) {
        res.status(502).json({
          type: "error",
          error: { type: "api_error", message: "Nhà cung cấp không trả về nội dung nào. Vui lòng thử lại hoặc chọn model khác." }
        });
      }
    }
  }

  /**
   * Ping / Latency test for a provider
   */
  async testLatency(providerId) {
    const provider = db.getProviderById(providerId);
    if (!provider) {
      return { success: false, error: "Nhà cung cấp không tồn tại" };
    }

    const start = Date.now();
    try {
      let testUrl = provider.baseUrl;
      if (!testUrl || !/^https?:\/\//i.test(testUrl)) {
        return { success: false, latencyMs: 0, error: "Base URL không hợp lệ (chưa cấu hình)", providerId };
      }
      if (testUrl.includes('{')) {
        return { success: false, latencyMs: 0, error: "Base URL chứa biến template, không ping được. Hãy điền giá trị thật.", providerId };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(testUrl, {
        method: "HEAD",
        signal: controller.signal
      }).catch(async () => {
        // Retry with GET if HEAD not supported
        return await fetch(testUrl, { method: "GET", signal: controller.signal });
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      return {
        success: true,
        latencyMs,
        status: res.status || 200,
        providerId
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.name === "AbortError" ? "Timeout (6s)" : (err.message || "Không thể kết nối"),
        providerId
      };
    }
  }

  /**
   * Rough token estimate (~4 chars/token) used only when upstream gives no usage.
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
}

module.exports = new ProxyService();
