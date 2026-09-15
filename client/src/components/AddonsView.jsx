import React, { useMemo, useState } from 'react';
import {
  Puzzle, Check, X, Download, Trash2, Palette, Server, ScrollText,
  RefreshCw, Sparkles, Upload, Code2, Eye, RotateCcw
} from 'lucide-react';
import { authFetch } from '../session';
import { useTheme } from '../theme';
import { useI18n } from '../i18n';

const TYPE_META = {
  theme: { label: 'addon.typeTheme', icon: Palette, tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  provider: { label: 'addon.typeProvider', icon: Server, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  snippet: { label: 'addon.typeSnippet', icon: ScrollText, tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
};

const EXAMPLE_ADDON = `{
  "id": "my.theme.ocean",
  "name": "Ocean Blue",
  "type": "theme",
  "version": "1.0.0",
  "author": "ban",
  "description": "Xanh duong sau, bo goc mem.",
  "theme": {
    "accent": "#38bdf8",
    "surface": "#04101c",
    "text": "#e0f2fe",
    "radius": "16px"
  }
}`;

function Swatches({ theme }) {
  const accent = theme.accent || theme['--accent-cyan'] || '#06b6d4';
  const surface = theme.surface || theme['--bg-primary'] || '#0b1120';
  const text = theme.text || theme['--text-primary'] || '#e2e8f0';
  return (
    <div className="flex items-center gap-1.5">
      {[surface, accent, text].map((c, i) => (
        <span
          key={i}
          className="w-5 h-5 rounded-md border border-white/10"
          style={{ background: String(c).startsWith('#') ? c : 'rgb(' + String(c).replace(/\s+/g, ',') + ')' }}
          title={String(c)}
        />
      ))}
    </div>
  );
}

export default function AddonsView() {
  const { t } = useI18n();
  const { addons, loading, reload, activeId, setTheme } = useTheme();
  const [tab, setTab] = useState('all');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind:'ok'|'err', text}
  const [preview, setPreview] = useState(null);

  const filtered = useMemo(
    () => addons.filter((a) => (tab === 'all' ? true : a.type === tab)),
    [addons, tab]
  );
  const counts = useMemo(() => {
    const c = { all: addons.length, theme: 0, provider: 0, snippet: 0 };
    for (const a of addons) if (c[a.type] !== undefined) c[a.type] += 1;
    return c;
  }, [addons]);

  const flash = (kind, text) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const install = async (manifestSource) => {
    setBusy(true);
    try {
      const res = await authFetch('/api/addons/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: manifestSource })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        flash('err', data.error || t('addon.installFail'));
        return false;
      }
      await reload();
      flash('ok', t('addon.installed', { name: data.addon.name, type: data.addon.type }));
      if (data.addon.type === 'theme') setTheme(data.addon.id);
      return true;
    } catch (e) {
      flash('err', t('addon.netError', { msg: e.message }));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await install(String(reader.result));
      if (ok) setSource('');
    };
    reader.onerror = () => flash('err', t('addon.readFail'));
    reader.readAsText(file);
    e.target.value = '';
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/addons/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) flash('err', data.error || t('addon.deleteFail'));
      else {
        if (activeId === id) setTheme('');
        await reload();
        flash('ok', t('addon.deleted'));
      }
    } catch (e) {
      flash('err', t('addon.netError', { msg: e.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-cyan-400" />
            {t('addon.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('addon.sub')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeId ? (
            <button
              onClick={() => setTheme('')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-xs flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t('addon.resetDefault')}
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-500 text-xs font-mono">
              {t('addon.usingDefault')}
            </span>
          )}
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('addon.reload')}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 text-sm px-3 py-2 rounded-lg border font-mono ${
          msg.kind === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Write / install */}
      <div className="card-glass p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" /> {t('addon.installFileTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSource(EXAMPLE_ADDON)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-[11px] flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> {t('addon.sampleBtn')}
            </button>
            <label className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 text-[11px] flex items-center gap-1.5 cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" /> {t('addon.uploadBtn')}
              <input type="file" accept=".addon,.json,application/json" className="hidden" onChange={onFile} />
            </label>
          </div>
        </div>

        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          placeholder={t('addon.sourcePh')}
          className="w-full h-40 bg-slate-950/80 border border-slate-800 focus:border-cyan-500/60 rounded-xl p-3 text-[12px] font-mono text-slate-200 placeholder:text-slate-600 outline-none resize-y leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={() => install(source).then((ok) => ok && setSource(''))}
            disabled={busy || !source.trim()}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-40 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> {busy ? t('addon.processing') : t('addon.installBtn')}
          </button>
          <span className="text-[11px] text-slate-500 font-mono">
            {t('addon.theLoaiHint')}
          </span>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {[
          { id: 'all', label: 'addon.tabAll' },
          { id: 'theme', label: 'addon.typeTheme' },
          { id: 'provider', label: 'addon.typeProvider' },
          { id: 'snippet', label: 'addon.typeSnippet' }
        ].map((ft) => (
          <button
            key={ft.id}
            onClick={() => setTab(ft.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition ${
              tab === ft.id
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {t(ft.label)}
            <span className="ml-1.5 text-slate-500 font-mono">{counts[ft.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Gallery */}
      {filtered.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <Puzzle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300">{t('addon.emptyTitle')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('addon.emptySub')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const meta = TYPE_META[a.type] || TYPE_META.snippet;
            const Icon = meta.icon;
            const isActive = a.type === 'theme' && activeId === a.id;
            return (
              <div key={a.id} className={`card-glass p-4 flex flex-col gap-3 ${isActive ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h3 className="text-sm font-bold text-white truncate" title={a.name}>{a.name}</h3>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5" title={a.id}>{a.id}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${meta.tone}`}>{t(meta.label)}</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{a.description || '—'}</p>

                {a.type === 'theme' && (
                  <div className="flex items-center justify-between gap-2">
                    <Swatches theme={a.theme || {}} />
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                      <span>v{a.version || '1.0.0'}</span>
                      <span>•</span>
                      <span>{a.builtin ? 'WENKER' : a.author || 'user'}</span>
                    </div>
                  </div>
                )}

                {a.type === 'provider' && a.provider && (
                  <p className="text-[10px] font-mono text-slate-500 truncate" title={a.provider.baseUrl}>
                    {a.provider.baseUrl}
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  {a.type === 'theme' && (
                    <button
                      onClick={() => setTheme(isActive ? '' : a.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500'
                      }`}
                    >
                      {isActive ? (<><Check className="w-3.5 h-3.5" /> {t('addon.themeOn')}</>) : (<><Palette className="w-3.5 h-3.5" /> {t('addon.themeEnable')}</>)}
                    </button>
                  )}
                  {a.type === 'theme' && (
                    <button
                      onClick={() => setPreview(preview === a.id ? null : a.id)}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 transition"
                      title={t('addon.viewVars')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {a.type === 'provider' && (
                    <span className="flex-1 text-[10px] font-mono text-slate-500 px-2 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      {t('addon.providerNote')}
                    </span>
                  )}
                  {a.type === 'snippet' && (
                    <span className="flex-1 text-[10px] font-mono text-amber-400/80 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      {t('addon.snippetNote')}
                    </span>
                  )}
                  {!a.builtin && (
                    <button
                      onClick={() => remove(a.id)}
                      disabled={busy}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition disabled:opacity-40"
                      title={t('addon.uninstall')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {preview === a.id && (
                  <pre className="text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 max-h-40 overflow-auto leading-relaxed">
                    {JSON.stringify(a.resolved || a.theme || {}, null, 1)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cheat sheet */}
      <div className="card-glass p-4 mt-6">
        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" /> {t('addon.howToTitle')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-[11px] text-slate-400 leading-relaxed">
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <p className="text-cyan-300 font-semibold mb-1">theme</p>
            <p className="font-mono text-slate-500">{`{ "id":"my.theme", "name":"My", "type":"theme",
  "theme":{ "accent":"#f472b6",
            "surface":"#150a26",
            "text":"#fff", "radius":"16px" } }`}</p>
            <p className="mt-1.5">{t('addon.howToTheme')}</p>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <p className="text-emerald-300 font-semibold mb-1">provider</p>
            <p className="font-mono text-slate-500">{`{ "id":"my.provider", "name":"My API",
  "type":"provider",
  "provider":{ "id":"my-api", "name":"My API",
    "baseUrl":"http://localhost:11434/v1",
    "requiresAuth":false,
    "models":[{"id":"llama3","name":"Llama 3"}] } }`}</p>
            <p className="mt-1.5">{t('addon.howToProvider')}</p>
          </div>
          <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
            <p className="text-amber-300 font-semibold mb-1">snippet</p>
            <p className="font-mono text-slate-500">{`{ "id":"my.snippet", "name":"My trick",
  "type":"snippet",
  "snippet":"copy_alive_ids" }`}</p>
            <p className="mt-1.5">{t('addon.howToSnippet')}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 font-mono">
          {t('addon.noteStore')} <span className="text-slate-300">~/.wenker/addons.json</span> —{' '}
          <span className="text-slate-300">WENKER_HOME</span> {t('addon.noteHome')}
        </p>
      </div>
    </div>
  );
}
