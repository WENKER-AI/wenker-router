import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Radio,
  Filter,
  Activity,
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';
import { onServerEvent } from '../sse';

const MAX_ROWS = 500;

// Bo dau tieng Viet -> khong dau, de o tim kiem goi ASCII van khop duoc noi dung co dau.
function deaccent(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export default function LogsView() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | ok | err | fallback
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await authFetch('/api/logs?limit=100');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Live tail: nhan entry moi qua SSE, chen len dau va nhay mau nhat thoi.
  useEffect(() => {
    if (!live) return;
    const off = onServerEvent('log', (entry) => {
      if (!entry || !entry.id) return;
      setLogs((prev) => {
        if (prev.some((l) => l.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, MAX_ROWS);
      });
      setFlashId(entry.id);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashId(null), 900);
    });
    return () => {
      off();
      clearTimeout(flashTimer.current);
    };
  }, [live]);

  // Sap xep moi nhat len dau theo timestamp (SSE va fetch co the ve khong theo thu tu).
  const sorted = useMemo(
    () => [...logs].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = deaccent(query.trim());
    return sorted.filter((l) => {
      const ok = l.status >= 200 && l.status < 300;
      if (statusFilter === 'ok' && !ok) return false;
      if (statusFilter === 'err' && ok) return false;
      if (statusFilter === 'fallback' && !l.fallbackFrom) return false;
      if (!q) return true;
      const hay = deaccent(
        [l.endpoint, l.model, l.resolvedModel, l.providerId, l.status, l.fallbackFrom].join(' ')
      );
      return hay.includes(q);
    });
  }, [sorted, query, statusFilter]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['timestamp', 'endpoint', 'model', 'resolvedModel', 'providerId', 'status', 'ok', 'fallbackFrom', 'latencyMs', 'promptTokens', 'completionTokens'];
    const rows = filtered.map((l) => [
      l.timestamp, l.endpoint, l.model, l.resolvedModel || '', l.providerId, l.status,
      (l.status >= 200 && l.status < 300) ? 1 : 0, l.fallbackFrom || '', l.latencyMs,
      l.promptTokens || 0, l.completionTokens || 0,
    ].map(esc).join(','));
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `wenker-logs-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-cyan-400" />
            <span>{t('logs.title')}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('logs.sub')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
              live
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title={t('logs.liveTip')}
          >
            <Radio className={`w-3.5 h-3.5 ${live ? 'animate-pulse' : ''}`} />
            <span>{live ? t('logs.liveOn') : t('logs.liveOff')}</span>
          </button>

          <button onClick={fetchLogs} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('logs.refresh')}</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn-secondary text-xs disabled:opacity-40"
            title={t('logs.exportTip')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('logs.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Bo loc + tim kiem */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('logs.searchPh')}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          {[
            { id: 'all', label: t('logs.fAll') },
            { id: 'ok', label: t('logs.fOk') },
            { id: 'err', label: t('logs.fErr') },
            { id: 'fallback', label: t('logs.fFallback') },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                statusFilter === f.id
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 text-xs">
          <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          {logs.length === 0 ? t('logs.empty') : t('logs.noMatch')}
        </div>
      ) : (
        <div className="card-glass rounded-xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">{t('logs.colTime')}</th>
                  <th className="px-4 py-3">{t('logs.colEndpoint')}</th>
                  <th className="px-4 py-3">{t('logs.colReqModel')}</th>
                  <th className="px-4 py-3">{t('logs.colRealModel')}</th>
                  <th className="px-4 py-3">{t('logs.colProvider')}</th>
                  <th className="px-4 py-3">{t('logs.colLatency')}</th>
                  <th className="px-4 py-3">{t('logs.colTokens')}</th>
                  <th className="px-4 py-3">{t('logs.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((log) => {
                  const isOk = log.status >= 200 && log.status < 300;
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();
                  const served = log.resolvedModel || log.model;
                  const bare = log.model && log.model.includes('/') ? log.model.slice(log.model.indexOf('/') + 1) : log.model;
                  const differs = served && log.model && served !== log.model && served !== bare;
                  const isFallback = Boolean(log.fallbackFrom);

                  return (
                    <tr
                      key={log.id}
                      className={`transition ${flashId === log.id ? 'bg-cyan-500/10' : 'hover:bg-slate-900/50'}`}
                    >
                      <td className="px-4 py-2.5 text-slate-400 text-[11px] whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {log.endpoint}
                      </td>
                      <td className="px-4 py-2.5 text-cyan-300 font-semibold truncate max-w-[180px]" title={log.model}>
                        {log.model}
                      </td>
                      <td className="px-4 py-2.5 truncate max-w-[200px]" title={served}>
                        <span className={differs ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                          {served || '—'}
                        </span>
                        {differs && (
                          <span className="ml-1 text-[9px] text-amber-500/80" title={t('logs.aliasTip')}>(alias)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {log.providerId}
                        </span>
                        {isFallback && (
                          <span
                            className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px]"
                            title={t('logs.fallbackTip', { from: log.fallbackFrom, reason: log.fallbackReason || t('logs.upstreamErr') })}
                          >
                            {t('logs.fallbackLabel')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-amber-300">
                        {log.latencyMs}ms
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                        {(log.promptTokens || 0) + (log.completionTokens || 0)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isOk
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isOk ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {log.status} {isOk ? 'OK' : 'ERR'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
