import React, { useState, useEffect } from 'react';
import { 
  Route, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  ArrowRight, 
  RefreshCw, 
  ShieldAlert, 
  SlidersHorizontal 
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

export default function RoutingView() {
  const { t } = useI18n();
  const [routing, setRouting] = useState({ aliases: {}, fallbacks: [] });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // New alias form
  const [newAliasKey, setNewAliasKey] = useState('');
  const [newAliasTarget, setNewAliasTarget] = useState('');

  const fetchRouting = async () => {
    try {
      const res = await authFetch('/api/routing');
      const data = await res.json();
      setRouting(data || { aliases: {}, fallbacks: [] });
    } catch (err) {
      console.error('Error fetching routing rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouting();
  }, []);

  const handleAddAlias = (e) => {
    e.preventDefault();
    if (!newAliasKey.trim() || !newAliasTarget.trim()) return;

    setRouting(prev => ({
      ...prev,
      aliases: {
        ...prev.aliases,
        [newAliasKey.trim()]: newAliasTarget.trim()
      }
    }));

    setNewAliasKey('');
    setNewAliasTarget('');
  };

  const handleDeleteAlias = (key) => {
    setRouting(prev => {
      const copy = { ...prev.aliases };
      delete copy[key];
      return { ...prev, aliases: copy };
    });
  };

  const handleSave = async () => {
    try {
      const res = await authFetch('/api/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routing)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save routing:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Route className="w-6 h-6 text-cyan-400" />
            <span>{t('route.title')}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('route.sub')}
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary text-xs self-start md:self-auto"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{saved ? t('common.saved') : t('common.saveChanges')}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: Model Aliases */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                  <span>{t('route.aliasTitle')}</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t('route.aliasSub')}
                </p>
              </div>
            </div>

            {/* List of current aliases */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {Object.entries(routing.aliases || {}).map(([fromModel, toModel]) => (
                <div 
                  key={fromModel}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <span className="text-slate-300 font-semibold">{fromModel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-cyan-300 truncate">{toModel}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteAlias(fromModel)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition shrink-0"
                    title={t('route.delAliasTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Alias Form */}
            <form onSubmit={handleAddAlias} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 text-xs">
              <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                {t('route.addNew')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t('route.aliasFromPh')}
                  value={newAliasKey}
                  onChange={(e) => setNewAliasKey(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={t('route.aliasToPh')}
                  value={newAliasTarget}
                  onChange={(e) => setNewAliasTarget(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="btn-secondary w-full justify-center text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('route.addRule')}</span>
              </button>
            </form>
          </div>

          {/* Section 2: Smart Failover & Fallback Info */}
          <div className="card-glass p-6 rounded-xl space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>{t('route.failoverTitle')}</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('route.failoverSub')}
              </p>

              <div className="space-y-3 mt-4 text-xs">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">OpenAI Fallback</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{t('route.onlyRealErr')}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    {t('route.openaiDesc')}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Anthropic Claude Fallback</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{t('route.onlyRealErr')}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    {t('route.anthropicDesc')}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{t('route.internetTitle')}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">{t('route.realErrBadge')}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    {t('route.internetDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-xs text-cyan-300">
              <span className="text-cyan-400 mr-1">[&gt;]</span> <strong>{t('route.tipLabel')}</strong> {t('route.tipBody')}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
