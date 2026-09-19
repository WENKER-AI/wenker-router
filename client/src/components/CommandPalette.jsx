import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Sparkles, Compass, Network, Route, Puzzle, BarChart3, Key,
  Terminal, Settings, Search, CornerDownLeft, Copy, ExternalLink, RefreshCw,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useToast } from '../toast';

/**
 * CommandPalette (Ctrl+K / Cmd+K) - dieu huong va hanh dong nhanh, kieu VS Code.
 * Goi ten tab hoac hanh dong -> Enter. Khong can chuot, hop voi dev tool.
 */
export default function CommandPalette({ open, onClose, setActiveTab }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const NAV = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: Activity, kind: 'nav' },
    { id: 'playground', label: t('nav.playground'), icon: Sparkles, kind: 'nav' },
    { id: 'finder', label: t('nav.finder'), icon: Compass, kind: 'nav' },
    { id: 'providers', label: t('nav.providers'), icon: Network, kind: 'nav' },
    { id: 'routing', label: t('nav.routing'), icon: Route, kind: 'nav' },
    { id: 'addons', label: t('nav.addons'), icon: Puzzle, kind: 'nav' },
    { id: 'stats', label: t('nav.stats'), icon: BarChart3, kind: 'nav' },
    { id: 'keys', label: t('nav.keys'), icon: Key, kind: 'nav' },
    { id: 'logs', label: t('nav.logs'), icon: Terminal, kind: 'nav' },
    { id: 'settings', label: t('nav.settings'), icon: Settings, kind: 'nav' },
  ];

  const ACTIONS = [
    {
      id: 'copyBase', label: t('cmd.copyBase'), icon: Copy, kind: 'action',
      run: () => {
        navigator.clipboard?.writeText('http://localhost:3600/v1');
        push({ type: 'success', title: t('dash.copied'), message: 'http://localhost:3600/v1' });
      },
    },
    {
      id: 'reload', label: t('cmd.reload'), icon: RefreshCw, kind: 'action',
      run: () => window.location.reload(),
    },
    {
      id: 'docs', label: t('cmd.docs'), icon: ExternalLink, kind: 'action',
      run: () => window.open('/wenker/', '_blank'),
    },
  ];

  const all = useMemo(() => [...NAV, ...ACTIONS], []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((it) => it.label.toLowerCase().includes(s));
  }, [q, all]);

  // Reset vi tri khi mo lai / doi truy van.
  useEffect(() => { setIdx(0); }, [q, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    if (item.kind === 'nav') setActiveTab(item.id);
    else if (item.run) item.run();
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('cmd.placeholder')}
            className="flex-1 bg-transparent py-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-slate-500">{t('cmd.empty')}</li>
          )}
          {results.map((item, i) => {
            const Icon = item.icon;
            const active = i === idx;
            return (
              <li key={item.id}>
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => choose(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left text-[13px] transition ${
                    active ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
                    {item.kind === 'nav' ? t('cmd.go') : t('cmd.action')}
                  </span>
                  {active && <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400/70" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
