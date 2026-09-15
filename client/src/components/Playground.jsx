import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Settings2, 
  Bot, 
  User, 
  Zap, 
  Sliders, 
  RefreshCw,
  Cpu,
  Clock,
  Code,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useSession } from '../session';
import { useI18n } from '../i18n';

const FREE_MODELS = [
  { id: "wenker-deepseek-r1-free", name: "wenker-deepseek-r1-free", tag: "WENKER Cloud", desc: "Yêu cầu deepseek-r1 trên Pollinations; nếu model không khả dụng, router tự chuyển sang model miễn phí đang có." },
  { id: "wenker-deepseek-v3-free", name: "wenker-deepseek-v3-free", tag: "WENKER Cloud", desc: "Alias của WENKER Cloud — model thực sự trả lời phụ thuộc upstream tại thời điểm gọi (xem cột 'Model Thực Trả Lời' trong Nhật Ký)." },
  { id: "wenker-qwen-2.5-coder-free", name: "wenker-qwen-2.5-coder-free", tag: "WENKER Cloud", desc: "Yêu cầu qwen-coder trên Pollinations." },
  { id: "wenker-llama-3.3-70b-free", name: "wenker-llama-3.3-70b-free", tag: "WENKER Cloud", desc: "Yêu cầu llama trên Pollinations." },
  { id: "wenker-mistral-nemo-free", name: "wenker-mistral-nemo-free", tag: "WENKER Cloud", desc: "Yêu cầu mistral trên Pollinations." },
  { id: "wenker-gpt-4o-mini-free", name: "wenker-gpt-4o-mini-free", tag: "WENKER Cloud", desc: "Yêu cầu openai (alias openai-fast = GPT-OSS 20B) - model thực tế ổn định nhất của tier miễn phí." },
  { id: "wenker-gemini-2.5-free", name: "wenker-gemini-2.5-free", tag: "WENKER Cloud", desc: "Yêu cầu searchgpt trên Pollinations." },
  { id: "duckduckgo/ddg-gpt-4o-mini", name: "DuckDuckGo GPT-4o Mini", tag: "DuckDuckGo", desc: "Chat ẩn danh DuckDuckGo. Cần mạng cho phép handshake VQD; nếu lỗi sẽ trả 503 thật (không tự đổi provider khi thiếu key)." },
  { id: "duckduckgo/ddg-claude-3-haiku", name: "DuckDuckGo Claude 3 Haiku", tag: "DuckDuckGo", desc: "Claude 3 Haiku qua DuckDuckGo (cùng điều kiện mạng ở trên)." },
  { id: "duckduckgo/ddg-llama-3.3-70b", name: "DuckDuckGo Llama 3.3 70B", tag: "DuckDuckGo", desc: "Meta Llama qua DuckDuckGo (cùng điều kiện mạng ở trên)." },
  { id: "pollinations/pollinations-deepseek", name: "Pollinations DeepSeek V3", tag: "Pollinations", desc: "Gọi thẳng upstream Pollinations với model deepseek." },
  { id: "pollinations/pollinations-qwen-coder", name: "Pollinations Qwen Coder", tag: "Pollinations", desc: "Gọi thẳng upstream Pollinations với model qwen-coder." }
];

const SUGGESTIONS = ['pg.s1', 'pg.s2', 'pg.s3', 'pg.s4'];

export default function Playground({ requestedModel, onModelConsumed }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([
    { role: "assistant", content: t('pg.welcome') }
  ]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(requestedModel || "wenker-deepseek-r1-free");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState(t('pg.sysDefault'));
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const { authFetch, quota, refreshQuota, watchAd } = useSession();

  const messagesEndRef = useRef(null);

  // Model Finder -> Playground: App passes the picked id down as a prop, because this
  // component is mounted only when its tab is active (a window event would be missed).
  useEffect(() => {
    if (!requestedModel) return;
    setSelectedModel(requestedModel);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: t('pg.modelSwitched', { model: requestedModel })
      }
    ]);
    onModelConsumed?.();
  }, [requestedModel, onModelConsumed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Refresh the visible allowance whenever the user returns to the tab.
  useEffect(() => {
    const onFocus = () => refreshQuota();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshQuota]);

  // Keep the banner in sync with the server: after a reload (or an ad bonus that
  // refilled the pool) the exhausted state must appear/disappear by itself.
  useEffect(() => {
    if (quota?.exhausted) setQuotaExhausted(true);
    else if (quota && !quota.exhausted) setQuotaExhausted(false);
  }, [quota]);

  const handleSend = async (textToSend) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMessage = { role: "user", content: promptText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setLatencyMs(null);

    const startTime = Date.now();

    // Prepare assistant placeholder message
    const assistantMessageIndex = updatedMessages.length;
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const payload = {
        model: selectedModel,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: parseFloat(temperature),
        stream: true
      };

      const res = await authFetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-wenker-free-playground"
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        setQuotaExhausted(true);
        refreshQuota();
        setMessages(prev => {
          const newArr = [...prev];
          newArr[assistantMessageIndex] = {
            role: "assistant",
            content: `${errJson.error?.message || t('pg.quotaExhausted')}\n\n${errJson.error?.hint || t('pg.quotaExhausted')}`
          };
          return newArr;
        });
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const e = errJson.error || {};
        const lines = [`[!] [HTTP ${res.status}] ${e.message || `Server error: ${res.status}`}`];
        if (e.hint) lines.push(`[>] ${e.hint}`);
        if (Array.isArray(e.available_models) && e.available_models.length) {
          lines.push(`${t('pg.availableModels')} ${e.available_models.slice(0, 8).join(', ')}${e.available_models.length > 8 ? ' …' : ''}`);
        }
        if (Array.isArray(e.providers_currently_alive) && e.providers_currently_alive.length) {
          lines.push(`${t('pg.aliveSources')} ${e.providers_currently_alive.join(', ')}`);
        }
        throw Object.assign(new Error(lines.join('\n\n')), { handled: true });
      }

      setLatencyMs(Date.now() - startTime);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamBuffer = "";
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              accumulatedContent += delta;
              setMessages(prev => {
                const newArr = [...prev];
                newArr[assistantMessageIndex] = {
                  role: "assistant",
                  content: accumulatedContent
                };
                return newArr;
              });
            }
          } catch (e) {
            // raw text fallback
            accumulatedContent += dataStr;
            setMessages(prev => {
              const newArr = [...prev];
              newArr[assistantMessageIndex] = {
                role: "assistant",
                content: accumulatedContent
              };
              return newArr;
            });
          }
        }
      }
    } catch (err) {
      console.error("Playground Chat Error:", err);
      const detail = err?.handled
        ? err.message
        : t('pg.connError', { msg: err.message });
      setMessages(prev => {
        const newArr = [...prev];
        newArr[assistantMessageIndex] = {
          role: "assistant",
          content: detail
        };
        return newArr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      { role: "assistant", content: t('pg.cleared') }
    ]);
  };

  const handleWatchAd = async () => {
    setAdBusy(true);
    setAdMessage('');
    const result = await watchAd();
    setAdBusy(false);
    if (result.success && result.granted) {
      setAdMessage(t('pg.adGranted', { n: result.bonus }));
      setQuotaExhausted(false);
    } else if (result.success) {
      setAdMessage(result.reason || t('pg.adNone'));
    } else {
      setAdMessage(result.error || t('pg.adFail'));
    }
  };

  return (
    <div className="h-[calc(100dvh-9.5rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950">
      
      {/* Top Controls Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm text-slate-200">{t('pg.model')}</span>
          </div>

          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-950 border border-cyan-500/40 text-cyan-300 text-xs font-medium rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:border-cyan-400 cursor-pointer shadow-sm"
            >
              {(() => {
                const opts = FREE_MODELS.slice();
                if (selectedModel && !opts.some((m) => m.id === selectedModel)) {
                  opts.unshift({ id: selectedModel, name: selectedModel, tag: 'Model Finder', desc: '' });
                }
                return opts.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                  [{m.tag}] {m.name}
                </option>
                ));
              })()}
            </select>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{t('pg.freeTier')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latencyMs && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950/60 border border-slate-800 px-2 py-1 rounded">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('pg.latency')}: {latencyMs}ms</span>
            </div>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              showSettings 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('pg.params')}</span>
          </button>

          <button
            onClick={handleClearChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:text-rose-400 hover:bg-slate-750 transition"
            title={t('pg.clearTitle')}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('pg.clear')}</span>
          </button>
        </div>
      </div>

      {/* Quota banner */}
      {quota && !quota.exhausted && (
        <div className="px-4 py-1.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>
            {t('pg.quotaToday')} <span className="text-cyan-300 font-semibold">{quota.remaining ?? '∞'}</span>/{quota.dailyLimit} {t('pg.quotaTurns')}
            {quota.bonusUsed > 0 && <span className="text-emerald-400"> {t('pg.quotaAds', { n: quota.bonusUsed })}</span>}
          </span>
        </div>
      )}

      {quotaExhausted && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {t('pg.quotaExhausted')}
              {adMessage && <span className="text-slate-400"> {adMessage}</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {quota && quota.adCreditsLeft > 0 && (
              <button
                onClick={handleWatchAd}
                disabled={adBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 active:scale-95 transition disabled:opacity-60"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{adBusy ? t('pg.opening') : t('pg.watchAd', { n: quota.adCreditAmount || 10 })}</span>
              </button>
            )}
            <button
              onClick={() => { refreshQuota(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:text-cyan-300 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('common.retry')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Drawer if open */}
      {showSettings && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-in slide-in-from-top-2">
          <div>
            <label className="block text-slate-300 font-medium mb-1">{t('pg.sysLabel')}</label>
            <textarea
              rows={2}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
              placeholder={t('pg.sysPh')}
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-medium">{t('pg.tempLabel')} {temperature}</label>
              <span className="text-slate-500 text-[10px]">{t('pg.tempHint')}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Messages Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative group ${
                  isUser
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none"
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed font-sans">
                  {msg.content}
                </div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopyMessage(msg.content, index)}
                  className={`absolute top-2 right-2 p-1 rounded transition opacity-0 group-hover:opacity-100 ${
                    isUser ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title={t('pg.copyContent')}
                >
                  {copiedIndex === index ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 items-center text-slate-400 text-xs font-mono">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-white animate-spin" />
            </div>
            <span>{t('pg.generating')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 2 && (
        <div className="max-w-4xl mx-auto w-full px-4 mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(t(s))}
              className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-full px-3 py-1 transition text-left"
            >
              <span className="text-cyan-400 mr-1">&gt;</span>{t(s)}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="border-t border-slate-800/80 bg-slate-950 p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('pg.inputPh', { model: FREE_MODELS.find(m => m.id === selectedModel)?.name || 'WENKER' })}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none font-sans"
          />

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`px-5 rounded-xl font-medium flex items-center justify-center transition shadow-lg ${
              !input.trim() || isLoading
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-cyan-500 text-white hover:bg-cyan-400"
            }`}
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
