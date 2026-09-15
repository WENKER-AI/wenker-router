import React, { useState } from 'react';
import { 
  Zap, 
  Sparkles, 
  Network, 
  Cpu, 
  Activity, 
  Copy, 
  Check, 
  Terminal, 
  ShieldCheck, 
  ArrowRight,
  Code2,
  Layers,
  ChevronRight,
  Laptop
} from 'lucide-react';
import { useI18n } from '../i18n';

export default function Dashboard({ stats, setActiveTab }) {
  const { t } = useI18n();
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const integrations = [
    {
      id: 'claude-code',
      title: 'Claude Code CLI',
      desc: 'dash.integClaudeDesc',
      command: `export ANTHROPIC_BASE_URL=http://localhost:3600/v1\nexport ANTHROPIC_API_KEY=sk-wenker-local-admin\nclaude`
    },
    {
      id: 'cursor',
      title: 'Cursor AI IDE',
      desc: 'dash.integCursorDesc',
      command: `Base URL: http://localhost:3600/v1\nAPI Key:  sk-wenker-local-admin\nModel:    wenker-deepseek-r1-free`
    },
    {
      id: 'cline',
      title: 'Cline / Roo Code (VSCode)',
      desc: 'dash.integClineDesc',
      command: `Base URL: http://localhost:3600/v1\nAPI Key:  sk-wenker-local-admin\nModel ID: wenker-qwen-2.5-coder-free`
    },
    {
      id: 'curl',
      title: 'cURL Terminal Test',
      desc: 'dash.integCurlDesc',
      command: `curl -X POST http://localhost:3600/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-wenker-local-admin" \\\n  -d '{"model": "wenker-deepseek-r1-free", "messages": [{"role": "user", "content": "Hello WENKER Router!"}]}'`
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>WENKER Router Core 2.0 • {t('dash.readyBadge')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('dash.title')}
            </h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">{t('dash.sub')}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('playground')}
              className="btn-primary justify-center py-2.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('dash.btnTry')}</span>
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className="btn-secondary justify-center py-2.5"
            >
              <Network className="w-4 h-4" />
              <span>{t('dash.btnProviders')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-glass p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('dash.statProviders')}</span>
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">
            {stats?.totalProviders ?? '—'}
          </p>
          <div className="text-[11px] text-cyan-400 mt-1 flex items-center gap-1 font-medium">
            <span>● {t('dash.statActive')}: {stats?.enabledProviders ?? '—'}</span>
          </div>
        </div>

        <div className="card-glass p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('dash.statFree')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">
            {stats?.freeProviders ?? '—'}
          </p>
          <div className="text-[11px] text-slate-400 mt-1">
            {t('dash.statFreeSub')}
          </div>
        </div>

        <div className="card-glass p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('dash.statRequests')}</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">
            {stats?.totalRequests || 0}
          </p>
          <div className="text-[11px] text-emerald-400 mt-1">
            {t('dash.statSuccess')}: {stats?.totalRequests ? `${stats.successRate}%` : t('dash.noData')}
          </div>
        </div>

        <div className="card-glass p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('dash.statLatency')}</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-300 mt-2">
            {stats?.avgLatencyMs ? `${stats.avgLatencyMs}ms` : t('dash.noData')}
          </p>
          <div className="text-[11px] text-slate-400 mt-1">
            {t('dash.measuredFrom')} {stats?.totalRequests || 0} {t('dash.requestsUnit')}
          </div>
        </div>
      </div>

      {/* Quick Setup Guides */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" />
              <span>{t('dash.quickSetup')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('dash.quickSetupSub')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(item => (
            <div key={item.id} className="card-glass p-5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-sm text-slate-100">{item.title}</h3>
                  <button
                    onClick={() => handleCopy(item.command, item.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition"
                  >
                    {copiedKey === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">{t('dash.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{t('dash.copy')}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">{t(item.desc)}</p>
                <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-300 whitespace-pre overflow-x-auto">
                  {item.command}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WENKER Cloud Feature Card */}
      <div className="card-glass p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border-cyan-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{t('dash.cloudQueue')}</h3>
            <p className="text-xs text-slate-400">{t('dash.cloudQueueSub')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>wenker-deepseek-r1-free</span>
            </div>
            <p className="text-slate-400 text-[11px]">{t('dash.m1')}</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>wenker-qwen-2.5-coder-free</span>
            </div>
            <p className="text-slate-400 text-[11px]">{t('dash.m2')}</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="font-bold text-slate-200 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>wenker-llama-3.3-70b-free</span>
            </div>
            <p className="text-slate-400 text-[11px]">{t('dash.m3')}</p>
          </div>
        </div>

        <p className="text-[11px] text-amber-300/90 mt-3 leading-relaxed">
          <span className="inline-block w-2 h-2 bg-amber-400 mr-1 align-middle" aria-hidden="true"></span>{t('dash.honestNote')}
        </p>
      </div>

    </div>
  );
}
