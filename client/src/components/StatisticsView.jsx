import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  RefreshCw,
  Zap,
  Coins,
  CheckCircle2,
  Layers,
  Timer,
  Route,
  Database,
  Download,
  PieChart
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

const WINDOWS = [7, 14, 30];

// Compact number formatting: 12.3k / 4.5M — keeps the KPI tiles readable.
function fmt(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

// Latency is in ms: show seconds above 1s, otherwise raw ms. fmt() would render
// 3300 as "3.3k" which reads as tokens, not time.
function fmtMs(ms) {
  const v = Number(ms) || 0;
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 's';
  return `${Math.round(v)}ms`;
}

// Tailwind needs STATIC class strings (dynamic bg-${x} gets purged), so map
// a 0-100 rate to a fixed tone set.
function rateTone(pct) {
  if (pct >= 90) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (pct >= 70) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
  if (pct >= 40) return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
}

// Tailwind purges dynamic `text-${tone}-400`, so keep a static class map.
const ICON_TONES = {
  cyan: 'text-cyan-400',
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400'
};

function KpiTile({ icon: Icon, label, value, sub, tone = 'cyan' }) {
  return (
    <div className="card-glass p-4 sm:p-5 rounded-xl flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className={`w-4 h-4 shrink-0 ${ICON_TONES[tone] || ICON_TONES.cyan}`} />
        <span className="text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-heading leading-none truncate">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

// Static hex palette for the donut: inline styles bypass Tailwind's purge entirely.
const DONUT_COLORS = ['#22d3ee', '#818cf8', '#34d399', '#38bdf8', '#fbbf24', '#fb7185', '#a78bfa', '#f472b6'];

// Request-share donut built from pure SVG dash-array circles (no chart library).
function ProviderDonut({ providers, otherLabel }) {
  const top = providers.slice(0, 7);
  const rest = providers.slice(7).reduce((s, p) => s + p.requests, 0);
  const slices = top.map((p) => ({ name: p.name, value: p.requests }));
  if (rest > 0) slices.push({ name: otherLabel, value: rest });
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div className="flex items-center gap-4 mb-4">
      <svg viewBox="0 0 42 42" className="w-28 h-28 shrink-0">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4.5" />
        <g transform="rotate(-90 21 21)">
          {slices.map((s, i) => {
            const pct = (s.value / sum) * 100;
            const off = -acc;
            acc += pct;
            return (
              <circle
                key={s.name}
                cx="21" cy="21" r="15.915" fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="4.5"
                strokeDasharray={`${pct.toFixed(3)} ${(100 - pct).toFixed(3)}`}
                strokeDashoffset={off}
              >
                <title>{`${s.name}: ${s.value} · ${Math.round(pct)}%`}</title>
              </circle>
            );
          })}
        </g>
      </svg>
      <ul className="space-y-1 text-[11px] min-w-0 flex-1">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="truncate text-slate-300" title={s.name}>{s.name}</span>
            <span className="ml-auto font-mono text-slate-500 shrink-0 pl-2">{Math.round((s.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Success vs failed per day as two SVG polylines; invisible rects carry hover tooltips.
function DailyLines({ daily, successLabel, failedLabel }) {
  const W = 100;
  const H = 34;
  const n = daily.length;
  if (!n) return null;
  const maxV = Math.max(1, ...daily.map((d) => d.requests));
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => H - 1 - (v / maxV) * (H - 2);
  const pts = (get) => daily.map((d, i) => `${x(i).toFixed(2)},${y(get(d)).toFixed(2)}`).join(' ');
  const colW = W / n;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-32">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={y(maxV * f)} y2={y(maxV * f)} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={pts((d) => d.requests - d.failed)} fill="none" stroke="#34d399" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <polyline points={pts((d) => d.failed)} fill="none" stroke="#fb7185" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {daily.map((d, i) => (
          <rect key={d.date} x={x(i) - colW / 2} y="0" width={colW} height={H} fill="transparent">
            <title>{`${d.date}: ${d.requests - d.failed} ${successLabel} · ${d.failed} ${failedLabel}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
        <span>{daily[0].date.slice(5)}</span>
        {n > 2 && <span>{daily[Math.floor(n / 2)].date.slice(5)}</span>}
        <span>{daily[n - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

export default function StatisticsView() {
  const { t } = useI18n();
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchStats = async (d) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/usage?days=${d}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(days);
  }, [days]);

  // One CSV with four sections (totals / daily / by provider / by model). BOM +
  // CRLF so Excel on Windows opens it with correct UTF-8 Vietnamese names.
  const exportCsv = () => {
    if (!data) return;
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [];
    rows.push(['# totals']);
    rows.push(['metric', 'value']);
    Object.entries(data.totals || {}).forEach(([k, v]) => rows.push([k, v]));
    rows.push([]);
    rows.push(['# daily']);
    rows.push(['date', 'requests', 'success', 'failed', 'tokens', 'cacheHits', 'fallbacks', 'avgLatencyMs']);
    (data.daily || []).forEach((d) => rows.push([d.date, d.requests, d.requests - d.failed, d.failed, d.tokens, d.cacheHits, d.fallbacks, d.avgLatencyMs]));
    rows.push([]);
    rows.push(['# by_provider']);
    rows.push(['providerId', 'name', 'requests', 'tokens', 'successRate', 'avgLatencyMs', 'fallbacks']);
    (data.byProvider || []).forEach((p) => rows.push([p.providerId, p.name, p.requests, p.tokens, p.successRate, p.avgLatencyMs, p.fallbacks]));
    rows.push([]);
    rows.push(['# by_model']);
    rows.push(['model', 'requests', 'tokens']);
    (data.byModel || []).forEach((m) => rows.push([m.model, m.requests, m.tokens]));
    const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wenker-usage-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totals = data?.totals;
  const daily = data?.daily || [];

  const maxRequests = useMemo(
    () => Math.max(1, ...daily.map((d) => d.requests)),
    [daily]
  );

  // Show at most ~10 x-axis labels even for a 30-day window.
  const labelEvery = daily.length > 14 ? Math.ceil(daily.length / 10) : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-heading flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <span>{t('stat.title')}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">{t('stat.sub')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  days === w
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {t('stat.lastDays').replace('{n}', w)}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} disabled={!data} className="btn-secondary text-xs disabled:opacity-40">
            <Download className="w-3.5 h-3.5" />
            <span>{t('stat.exportCsv')}</span>
          </button>
          <button onClick={() => fetchStats(days)} className="btn-secondary text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('stat.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Honest window notice: the log buffer is capped, so a 30-day request
          may only cover the retained recent entries. */}
      {data?.window?.truncated && (
        <div className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          <Database className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {t('stat.truncated')
              .replace('{c}', data.window.counted)
              .replace('{n}', data.window.days)}
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-lg px-4 py-3">
          {t('stat.error')}: {error}
        </div>
      )}

      {!error && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            <KpiTile icon={Zap} label={t('stat.requests')} value={fmt(totals?.requests)} sub={t('stat.inWindow')} />
            <KpiTile icon={Coins} label={t('stat.tokens')} value={fmt(totals?.totalTokens)} sub={`${fmt(totals?.promptTokens)} → ${fmt(totals?.completionTokens)}`} tone="indigo" />
            <KpiTile icon={CheckCircle2} label={t('stat.success')} value={`${totals?.successRate ?? 0}%`} sub={`${fmt(totals?.failed)} ${t('stat.failed').toLowerCase()}`} tone="emerald" />
            <KpiTile icon={Layers} label={t('stat.cacheHits')} value={`${totals?.cacheHitRate ?? 0}%`} sub={fmt(totals?.cacheHits)} tone="sky" />
            <KpiTile icon={Timer} label={t('stat.avgLatency')} value={fmtMs(totals?.avgLatencyMs)} sub={t('stat.perRequest')} tone="amber" />
            <KpiTile icon={Route} label={t('stat.fallbacks')} value={fmt(totals?.fallbacks)} sub={t('stat.realFailover')} tone="rose" />
          </div>

          {/* Daily bar chart */}
          <div className="card-glass p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-heading flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                {t('stat.dailyTitle')}
              </h2>
              <span className="text-[11px] text-slate-500">{t('stat.requestsPerDay')}</span>
            </div>
            {loading && !data ? (
              <div className="h-40 flex items-center justify-center text-slate-500 text-xs">{t('stat.loading')}</div>
            ) : (
              <div className="flex items-end gap-1 sm:gap-1.5 h-40 overflow-x-auto pb-1">
                {daily.map((d) => {
                  const h = Math.round((d.requests / maxRequests) * 100);
                  const showLabel = daily.indexOf(d) % labelEvery === 0;
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 flex-1 h-full min-w-[18px] group">
                      <div className="relative w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-cyan-600/60 to-cyan-400/90 transition-all hover:from-cyan-500 hover:to-cyan-300"
                          style={{ height: `${Math.max(h, d.requests ? 4 : 0)}%` }}
                          title={`${d.date}: ${d.requests} ${t('stat.requestsLower')} · ${fmt(d.tokens)} ${t('stat.tokenLower')} · ${d.cacheHits} ${t('stat.cacheLower')} · ${d.fallbacks} ${t('stat.fbLower')}`}
                        />
                      </div>
                      <span className={`text-[9px] font-mono ${showLabel ? 'text-slate-500' : 'text-transparent'}`}>
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Success vs failed lines */}
          <div className="card-glass p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-heading flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {t('stat.svTitle')}
              </h2>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <span className="w-3 h-0.5 rounded bg-emerald-400 inline-block" />
                  {t('stat.successLine')}
                </span>
                <span className="flex items-center gap-1.5 text-rose-300">
                  <span className="w-3 h-0.5 rounded bg-rose-400 inline-block" />
                  {t('stat.failedLine')}
                </span>
              </div>
            </div>
            {daily.length > 0 ? (
              <DailyLines daily={daily} successLabel={t('stat.successLine')} failedLabel={t('stat.failedLine')} />
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-500 text-xs">{t('stat.noData')}</div>
            )}
          </div>

          {/* Provider + model breakdown */}
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* By provider */}
            <div className="card-glass p-5 rounded-2xl">
              <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                {t('stat.byProvider')}
              </h2>
              {data && data.byProvider.length > 0 && (
                <ProviderDonut providers={data.byProvider} otherLabel={t('stat.other')} />
              )}
              {data && data.byProvider.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">{t('stat.noData')}</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="font-medium px-1 py-2">{t('stat.colProvider')}</th>
                        <th className="font-medium px-1 py-2 text-right">{t('stat.colReq')}</th>
                        <th className="font-medium px-1 py-2 text-right">{t('stat.colTok')}</th>
                        <th className="font-medium px-1 py-2 text-right">{t('stat.colRate')}</th>
                        <th className="font-medium px-1 py-2 text-right">{t('stat.colLat')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.byProvider || []).slice(0, 10).map((p) => (
                        <tr key={p.providerId} className="border-t border-slate-800/60">
                          <td className="px-1 py-2 text-slate-200 truncate max-w-[160px]" title={p.name}>
                            {p.name}
                            {p.fallbacks > 0 && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                {p.fallbacks}
                              </span>
                            )}
                          </td>
                          <td className="px-1 py-2 text-right font-mono text-slate-300">{fmt(p.requests)}</td>
                          <td className="px-1 py-2 text-right font-mono text-slate-400">{fmt(p.tokens)}</td>
                          <td className="px-1 py-2 text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${rateTone(p.successRate)}`}>
                              {p.successRate}%
                            </span>
                          </td>
                          <td className="px-1 py-2 text-right font-mono text-slate-400">{fmtMs(p.avgLatencyMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* By model */}
            <div className="card-glass p-5 rounded-2xl">
              <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-cyan-400" />
                {t('stat.byModel')}
              </h2>
              {data && data.byModel.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">{t('stat.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {(data?.byModel || []).map((m) => {
                    const maxTok = Math.max(1, ...(data?.byModel || []).map((x) => x.tokens));
                    const pct = Math.round((m.tokens / maxTok) * 100);
                    return (
                      <div key={m.model} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-slate-300 truncate" title={m.model}>{m.model}</span>
                          <span className="text-slate-500 shrink-0">{fmt(m.tokens)} · {fmt(m.requests)}req</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {updatedAt && (
            <p className="text-[11px] text-slate-600 text-right">
              {t('stat.updated')}: {updatedAt.toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
