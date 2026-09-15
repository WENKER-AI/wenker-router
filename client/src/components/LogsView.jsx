import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Activity 
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

export default function LogsView() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await authFetch('/api/logs?limit=100');
      const data = await res.json();
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

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

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span>{t('logs.autoRefresh')}</span>
          </label>

          <button
            onClick={fetchLogs}
            className="btn-secondary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('logs.refresh')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 text-xs">
          <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          {t('logs.empty')}
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
                {logs.map((log) => {
                  const isOk = log.status >= 200 && log.status < 300;
                  const timeStr = new Date(log.timestamp).toLocaleTimeString();
                  const served = log.resolvedModel || log.model;
                  const bare = log.model && log.model.includes('/') ? log.model.slice(log.model.indexOf('/') + 1) : log.model;
                  const differs = served && log.model && served !== log.model && served !== bare;
                  const isFallback = Boolean(log.fallbackFrom);

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition">
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
