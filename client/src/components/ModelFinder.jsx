import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Copy, Check, Sparkles, RefreshCw, ExternalLink, ArrowRight,
  Filter, Zap, Globe, Lock, Unlock, Cpu, X
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

// Pixel star (9x9 bitmap) — thay cho icon emoji/lucide de dong bo phong cach pixel.
function PixelStar({ className = '' }) {
  const rows = [
    '..X....',
    '..X....',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
    '.XX.XX.',
    'X.....X'
  ];
  const rects = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] === 'X') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  });
  return (
    <svg viewBox="0 0 7 7" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      {rects}
    </svg>
  );
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'wenker', label: 'WENKER gốc' },
  { id: 'free', label: 'Miễn phí no-key' },
  { id: 'flagship', label: 'Flagship' },
  { id: 'inference', label: 'Inference' },
  { id: 'coding', label: 'Coding' },
  { id: 'china', label: 'China' },
  { id: 'specialized', label: 'Specialized' },
  { id: 'local', label: 'Local' }
];

const STATUS_TONE = {
  alive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  down: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  needs_key: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  unknown: 'bg-slate-500/10 text-slate-400 border-slate-600/40'
};
const STATUS_LABEL = {
  alive: 'Dang song',
  down: 'Da tay',
  needs_key: 'Can key',
  unknown: 'Chua kiem tra'
};
const STATUS_DOT = {
  alive: 'bg-emerald-400',
  down: 'bg-rose-400',
  needs_key: 'bg-amber-400',
  unknown: 'bg-slate-500'
};

// Vietnamese / English task words -> hard filters. Everything else is free text match.
// Queries are de-accented first (see normText), so patterns here are written in ASCII
// but still accept the accented original spelling.
const HINTS = [
  { re: /\b(mien ph[ií]|free|no[- ]?key|kh[oô]ng c[aà]n key|an to[aà]n chi|kh[oô]ng thu ph[ií])\b/i, set: { freeOnly: true } },
  { re: /\b(code|coding|l[aậ]p tr[iì]nh|python|javascript|typescript|java|c\+\+|bug|debug|dev|developer|function|snippet|refactor)\b/i, set: { category: 'coding' } },
  { re: /\b(chat|to[aá]n di[ệe]n|th[oô]ng minh|flagship|general|claude|gemini|sonnet|opus|gpt)\b/i, set: { category: 'flagship' } },
  { re: /\b(d[aạ]i|ngữ c[aả]n|context|window|s[aá]ch|t[ià]i li[ệe]u|pdf|r[aà]o c[aả]n|long context)\b/i, set: { minContext: 128000 } },
  { re: /\b(1m|1\.000\.000|1000000|c[ảa] cu[ốo]n s[aá]ch|mega)\b/i, set: { minContext: 1000000 } },
  { re: /\b(nhanh|t[ốo]c [đđ][ộo]|latency|real[- ]?time|fast|low)\b/i, set: { preferFast: true } },
  { re: /\b(local|offline|m[aá]y t[ôo]i|ollama|llama\.cpp|privacy|ri[êe]ng t[ưu])\b/i, set: { category: 'local' } },
  { re: /\b(tr[ệe]u|t[aà]u|china|qwen|deepseek|glm|kimi|minimax|doubao|hunyuan|yi)\b/i, set: { category: 'china' } },
  { re: /\b(s[ốo]ng|alive|đang ch[ạa]y|kh[ảa] d[ụu]ng|usable|on [đd][ịi]nh|stable)\b/i, set: { aliveOnly: true } },
  { re: /\b(vision|[ảa]nh|h[iì]nh|image|multimodal|qu[éê]t|ocr)\b/i, set: { textBoost: 'vision image multimodal ocr' } },
  { re: /\b(ti[ếe]ng vi[ệe]t|vietnamese|viet)\b/i, set: { textBoost: 'vietnamese viet tieng' } },
  { re: /\b(reason|suy lu[ậa]n|logic|to[aá]n|h[ọo]c|math|o1|r1|think)\b/i, set: { textBoost: 'reasoning r1 think o1 math' } },
  { re: /\b(embed|embedding|tim ki[ếe]m|search|retrieval|rag|vector)\b/i, set: { textBoost: 'embedding search retrieval rag' } },
  { re: /\b(v[ẽe] tranh|design|logo|art|s[aá]ng t[ạa]o)\b/i, set: { textBoost: 'art design drawing image' } }
];

// "Lập Trình" -> "lap trinh": lets ASCII typing match accented model metadata and vice versa.
const normText = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase();

function parseQuery(q) {
  const out = { category: 'all', freeOnly: false, aliveOnly: false, minContext: 0, preferFast: false, textBoost: '', terms: [] };
  // Match hints against the whole phrase (multi-word hints), then strip what they consumed.
  let rest = ` ${normText(q)} `;
  let changed = true;
  let guard = 0;
  // Repeat until stable so several multi-word hints in one sentence are all consumed.
  while (changed && guard < 8) {
    changed = false;
    guard += 1;
    for (const h of HINTS) {
      if (!h.re.test(rest)) continue;
      const s = h.set;
      if (s.freeOnly) out.freeOnly = true;
      if (s.aliveOnly) out.aliveOnly = true;
      if (s.category && out.category === 'all') out.category = s.category;
      if (s.minContext) out.minContext = Math.max(out.minContext, s.minContext);
      if (s.preferFast) out.preferFast = true;
      if (s.textBoost && !out.textBoost.includes(s.textBoost)) out.textBoost += ' ' + s.textBoost;
      rest = rest.replace(new RegExp(h.re.source, h.re.flags.includes('g') ? h.re.flags : `${h.re.flags}g`), ' ');
      changed = true;
    }
  }
  out.terms = [...new Set(rest.split(/[\s,;]+/).filter((w) => w.length > 1))];
  return out;
}

function fmtCtx(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

export default function ModelFinder({ setActiveTab, onUseModel }) {
  const { t } = useI18n();
  const [raw, setRaw] = useState([]);
  const [health, setHealth] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeMsg, setProbeMsg] = useState('');

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [freeOnly, setFreeOnly] = useState(false);
  const [aliveOnly, setAliveOnly] = useState(false);
  const [minCtx, setMinCtx] = useState(0);
  const [limit, setLimit] = useState(24);
  const [copiedId, setCopiedId] = useState('');
  const [snippets, setSnippets] = useState([]);
  const searchRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [mRes, hRes, aRes] = await Promise.all([
        authFetch('/v1/models'),
        authFetch('/api/health'),
        authFetch('/api/addons')
      ]);
      const mData = await mRes.json();
      const hData = await hRes.json().catch(() => ({ health: {} }));
      const aData = await aRes.json().catch(() => ({ addons: [] }));
      if (!mRes.ok) throw new Error('Khong doc duoc /v1/models');
      // Keep only the plain (non-prefixed) ids; the prefixed form is offered as a copy button.
      const models = (mData.data || []).filter((m) => !m.id.includes('/'));
      setRaw(models);
      setHealth(hData.health || {});
      setSnippets((aData.addons || []).filter((a) => a.type === 'snippet'));
    } catch (e) {
      setError(e.message || 'Loi ket noi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    searchRef.current?.focus();
  }, []);

  const parsed = useMemo(() => parseQuery(query), [query]);
  // Filters the user picked by hand are always enforced. Filters inferred from the
  // description are enforced first and released automatically if they return nothing.
  const effCategory = category !== 'all' ? category : parsed.category;
  const effFree = freeOnly || parsed.freeOnly;
  const effAlive = aliveOnly || parsed.aliveOnly;
  const effCtx = Math.max(minCtx, parsed.minContext);
  const inferred = {
    category: category === 'all' ? parsed.category : 'all',
    free: !freeOnly && parsed.freeOnly,
    alive: !aliveOnly && parsed.aliveOnly,
    ctx: minCtx === 0 ? parsed.minContext : 0
  };
  const hasInferred = inferred.category !== 'all' || inferred.free || inferred.alive || inferred.ctx > 0;

  const { rows, relaxedUsed } = useMemo(() => {
    const terms = parsed.terms;
    const boost = (parsed.textBoost || '').split(/\s+/).filter(Boolean);
    const applyFilters = (list, useInferred) => {
      const cat = useInferred ? inferred.category : (category !== 'all' ? category : 'all');
      const free = freeOnly || (useInferred && inferred.free);
      const alive = aliveOnly || (useInferred && inferred.alive);
      const ctx = Math.max(minCtx, useInferred ? inferred.ctx : 0);
      return list
        .filter((m) => (cat === 'all' ? true : m.wenker_category === cat))
        .filter((m) => (free ? m.wenker_free : true))
        .filter((m) => (alive ? m.wenker_status === 'alive' : true))
        .filter((m) => (ctx ? (m.wenker_context || 0) >= ctx : true));
    };

    const scored = raw
      .map((m) => {
        const hay = normText(`${m.id} ${m.wenker_display_name} ${m.owned_by} ${m.wenker_category} ${m.wenker_description}`);
        let score = 0;
        if (terms.length) {
          // Free words rank results (any hit) instead of demanding every word appear.
          let hits = 0;
          for (const t of terms) {
            if (hay.includes(t)) { hits += 1; score += t.length > 3 ? 3 : 1; }
          }
          if (!hits) return null;
        }
        for (const b of boost) if (hay.includes(b)) score += 4;
        if (m.wenker_status === 'alive') score += 14;
        else if (m.wenker_status === 'needs_key') score += 4;
        else if (m.wenker_status === 'down') score -= 12;
        if (m.wenker_free) score += 8;
        if (m.wenker_category === 'wenker') score += 3;
        if (effCtx && (m.wenker_context || 0) >= effCtx) score += 5;
        if (parsed.preferFast) {
          if (/mini|flash|turbo|fast|small|lite|haiku|nano|qwen2\.5-coder|deepseek/.test(hay)) score += 6;
          if ((m.wenker_context || 0) <= 32000) score += 2;
        }
        return { ...m, score };
      })
      .filter(Boolean);

    const sortFn = (a, b) => b.score - a.score || (b.wenker_context || 0) - (a.wenker_context || 0);
    if (!hasInferred) return { rows: applyFilters(scored, true).sort(sortFn), relaxedUsed: false };
    const strict = applyFilters(scored, true).sort(sortFn);
    if (strict.length) return { rows: strict, relaxedUsed: false };
    return { rows: applyFilters(scored, false).sort(sortFn), relaxedUsed: true };
  }, [raw, parsed, category, freeOnly, aliveOnly, minCtx, effCtx, hasInferred, inferred.category, inferred.free, inferred.alive, inferred.ctx]);

  const stats = useMemo(() => {
    const byProviderAlive = new Set();
    let alive = 0;
    let free = 0;
    for (const m of raw) {
      if (m.wenker_status === 'alive') { alive += 1; byProviderAlive.add(m.wenker_provider); }
      if (m.wenker_free) free += 1;
    }
    return { total: raw.length, alive, free, providers: new Set(raw.map((m) => m.wenker_provider)).size, aliveProviders: byProviderAlive.size };
  }, [raw]);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(''), 1600);
    } catch (e) { /* clipboard blocked */ }
  };

  const copyAliveIds = async () => {
    const ids = rows.filter((m) => m.wenker_status === 'alive').map((m) => `${m.wenker_provider}/${m.id}`);
    const list = (ids.length ? ids : raw.filter((m) => m.wenker_status === 'alive').map((m) => `${m.wenker_provider}/${m.id}`));
    await copy(list.join('\n'), '__alive__');
  };

  const useInPlayground = (modelId) => {
    if (onUseModel) {
      onUseModel(modelId);
    } else {
      window.dispatchEvent(new CustomEvent('wenker:use-model', { detail: modelId }));
      if (setActiveTab) setActiveTab('playground');
    }
  };

  const probeAll = async () => {
    setProbing(true);
    setProbeMsg('Dang goi thu that toi tung nguon (khoang 15-40 giay)...');
    try {
      const res = await authFetch('/api/health/probe', { method: 'POST' });
      const data = await res.json();
      const ok = (data.results || []).filter((r) => r.ok).length;
      setProbeMsg(`Xong: ${ok}/${(data.results || []).length} nguon tra loi that.`);
      await load();
    } catch (e) {
      setProbeMsg('Probe that bai: ' + e.message);
    } finally {
      setProbing(false);
    }
  };

  const hasFilter = Boolean(query) || effCategory !== 'all' || effFree || effAlive || effCtx;
  const showCopyAlive = snippets.some((s) => s.snippet === 'copy_alive_ids');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Search className="w-6 h-6 text-cyan-400" />
            {t('finder.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t('finder.sub')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            {stats.total} model / {stats.providers} nguon
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {stats.alive} song
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            {stats.free} mien phi
          </span>
          <button
            onClick={load}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 transition"
            title="Tai lai danh muc"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Tai lai
          </button>
          <button
            onClick={probeAll}
            disabled={probing}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 flex items-center gap-1.5 transition disabled:opacity-50"
            title="Gui 1 request that toi tung nguon de biet nguon nao song"
          >
            <Zap className={`w-3.5 h-3.5 ${probing ? 'animate-pulse' : ''}`} /> Test nguon song
          </button>
        </div>
      </div>

      {probeMsg && (
        <div className="mb-4 text-[11px] font-mono px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300">
          {probeMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
          {error} — kiem tra server dang chay o port 3600.
        </div>
      )}

      {/* Search + filters */}
      <div className="card-glass p-4 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Vi du: lap trinh python mien phi khong can key / doc tai lieu dai 1m / local tren may toi..."
            className="w-full bg-slate-950/70 border border-slate-800 focus:border-cyan-500/60 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {CATEGORIES.map((c) => {
            const active = effCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={effFree} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" />
            <Unlock className="w-3.5 h-3.5" /> Chi mien phi (khong can key)
            {inferred.free && !freeOnly && <span className="text-[9px] px-1 rounded bg-cyan-500/15 text-cyan-300">AI</span>}
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={effAlive} onChange={(e) => setAliveOnly(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Chi nguon dang song
            {inferred.alive && !aliveOnly && <span className="text-[9px] px-1 rounded bg-cyan-500/15 text-cyan-300">AI</span>}
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <Filter className="w-3.5 h-3.5" />
            Context toi thieu
            <select
              value={String(minCtx)}
              onChange={(e) => setMinCtx(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-md px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-cyan-500/60"
            >
              <option value="0">Khong gioi han</option>
              <option value="8000">8K</option>
              <option value="32000">32K</option>
              <option value="128000">128K</option>
              <option value="256000">256K</option>
              <option value="1000000">1M</option>
            </select>
          </label>
          {parsed.terms.length > 0 && (
            <span className="text-[11px] font-mono text-slate-500">
              keyword: {parsed.terms.map((t) => <span key={t} className="text-cyan-400">{t}</span>).reduce((a, b) => [a, ' ', b])}
            </span>
          )}
          {hasFilter && (
            <button
              onClick={() => { setQuery(''); setCategory('all'); setFreeOnly(false); setAliveOnly(false); setMinCtx(0); }}
              className="ml-auto text-[11px] text-slate-500 hover:text-cyan-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Xoa bo loc
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-400 font-mono">
          <span className="text-cyan-300 font-semibold">{rows.length}</span> model khop
          {relaxedUsed && (
            <span className="text-amber-400"> • da noi bo loc tu suy ra (khong ai khop tuyen doi)</span>
          )}
          {rows.length > 0 && rows[0].score > 0 && (
            <span className="text-slate-600"> • xep theo do phu hop</span>
          )}
        </div>
        {showCopyAlive && (
          <button
            onClick={copyAliveIds}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 transition"
            title="Add-on: Copy All Live IDs"
          >
            {copiedId === '__alive__' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copy toan bo ID dang song
            <span className="text-[9px] px-1 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">add-on</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="card-glass p-4 animate-pulse">
              <div className="h-4 w-2/3 bg-slate-800 rounded mb-3" />
              <div className="h-3 w-1/2 bg-slate-800/70 rounded mb-4" />
              <div className="h-8 w-full bg-slate-800/50 rounded" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300">Khong tim thay model nao voi bo loc hien tai.</p>
          <p className="text-xs text-slate-500 mt-1">Thu bo bo loc "chi nguon dang song", ho goi it tu hon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.slice(0, limit).map((m) => {
            const fullId = `${m.wenker_provider}/${m.id}`;
            const h = health[m.wenker_provider];
            const st = m.wenker_status || 'unknown';
            return (
              <div key={fullId} className="card-glass p-4 flex flex-col gap-3 hover:border-cyan-500/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {m.wenker_free && <PixelStar className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <h3 className="text-sm font-bold text-white truncate" title={m.wenker_display_name}>
                        {m.wenker_display_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                      <span className="truncate" title={m.owned_by}>{m.owned_by}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-cyan-300 truncate" title={m.id}>{m.id}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${STATUS_TONE[st]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]} ${st === 'alive' ? 'animate-pulse' : ''}`} />
                    {STATUS_LABEL[st]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400">{m.wenker_category}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400">ctx {fmtCtx(m.wenker_context)}</span>
                  <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${m.wenker_requires_key ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
                    {m.wenker_requires_key ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    {m.wenker_requires_key ? 'can key' : 'no key'}
                  </span>
                  {h && typeof h.latencyMs === 'number' && h.latencyMs > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400">{h.latencyMs}ms</span>
                  )}
                  {m.wenker_free && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400">free</span>}
                  {m.wenker_served_by && m.wenker_served_by !== m.id && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300"
                      title={`${t('model.servedBy')}: ${m.wenker_served_by}`}
                    >
                      → {m.wenker_served_by.split('/').pop()}
                    </span>
                  )}
                </div>

                {m.wenker_description && (
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{m.wenker_description}</p>
                )}

                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <button
                    onClick={() => useInPlayground(m.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold hover:from-cyan-400 hover:to-blue-500 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Dung ngay
                  </button>
                  <button
                    onClick={() => copy(fullId, fullId)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 transition"
                    title={`Copy "${fullId}"`}
                  >
                    {copiedId === fullId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => copy(m.id, m.id)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 transition"
                    title="Copy chi ten model (khong prefix)"
                  >
                    {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-[10px] font-mono">id</span>}
                  </button>
                  {m.wenker_website && (
                    <a
                      href={m.wenker_website}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300 transition"
                      title="Mo trang nha cung cap"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && rows.length > limit && (
        <div className="flex justify-center mt-5">
          <button
            onClick={() => setLimit((n) => n + 30)}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-xs flex items-center gap-2 transition"
          >
            Xem them {Math.min(30, rows.length - limit)} model <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-600 mt-6 font-mono">
        Meo: go <span className="text-cyan-400">"code mien phi"</span>,
        {' '}<span className="text-cyan-400">"doc tai lieu dai 1m"</span>,
        {' '}<span className="text-cyan-400">"local"</span>,
        {' '}<span className="text-cyan-400">"reasoning"</span> — WENKER tu dich ra bo loc.
        {' '}Model tra ve theo <span className="text-slate-400">provider/model</span> la goi duoc ngay qua <span className="text-slate-400">/v1/chat/completions</span>.
      </p>
    </div>
  );
}
