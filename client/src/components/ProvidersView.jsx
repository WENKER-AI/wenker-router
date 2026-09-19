import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Key, 
  ExternalLink, 
  Check, 
  Copy, 
  RefreshCw, 
  Layers, 
  Zap, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Server,
  Globe,
  Settings,
  Activity,
  Trash2
} from 'lucide-react';
import { authFetch } from '../session.jsx';
import { useI18n } from '../i18n';

const CATEGORIES = [
  { id: 'all', label: 'cat.all' },
  { id: 'wenker', label: 'cat.wenker' },
  { id: 'free', label: 'cat.free' },
  { id: 'flagship', label: 'cat.flagship' },
  { id: 'inference', label: 'cat.inference' },
  { id: 'china', label: 'cat.china' },
  { id: 'local', label: 'cat.local' },
  { id: 'coding', label: 'cat.coding' },
  { id: 'specialized', label: 'cat.specialized' },
  { id: 'custom', label: 'cat.custom' }
];

export default function ProvidersView() {
  const { t } = useI18n();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [pingResults, setPingResults] = useState({});
  const [pingingId, setPingingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Edit / Config Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [detailProvider, setDetailProvider] = useState(null);
  const [modelSearch, setModelSearch] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');

  // Live health probe state: which providers actually answer a real chat request
  const [health, setHealth] = useState({});
  const [probing, setProbing] = useState(false);
  const [probingId, setProbingId] = useState(null);

  // Add Custom Provider Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    baseUrl: 'http://localhost:8000/v1',
    authType: 'bearer',
    userApiKey: '',
    isFree: false,
    description: '',
    modelName: 'custom-model'
  });

  const fetchProviders = async () => {
    try {
      const res = await authFetch('/api/providers');
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await authFetch('/api/health');
      const data = await res.json();
      setHealth(data.health || {});
    } catch (err) {
      console.error('Error fetching health:', err);
    }
  };

  useEffect(() => {
    fetchProviders();
    fetchHealth();
  }, []);

  const handleProbeAll = async () => {
    setProbing(true);
    try {
      const res = await authFetch('/api/health/probe', { method: 'POST' });
      const data = await res.json();
      setHealth(data.results || {});
    } catch (err) {
      console.error('Probe all failed:', err);
    } finally {
      setProbing(false);
    }
  };

  const handleProbeOne = async (providerId) => {
    setProbingId(providerId);
    try {
      const res = await authFetch(`/api/health/probe/${providerId}`, { method: 'POST' });
      const data = await res.json();
      if (data.result) setHealth(prev => ({ ...prev, [providerId]: data.result }));
    } catch (err) {
      console.error('Probe failed:', err);
    } finally {
      setProbingId(null);
    }
  };

  const handleToggle = async (provider) => {
    const updatedStatus = !provider.enabled;
    try {
      const res = await authFetch(`/api/providers/${provider.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: updatedStatus })
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, enabled: updatedStatus } : p));
      }
    } catch (err) {
      console.error('Failed to toggle provider:', err);
    }
  };

  const handlePing = async (providerId) => {
    setPingingId(providerId);
    try {
      const res = await authFetch(`/api/providers/${providerId}/ping`, { method: 'POST' });
      const data = await res.json();
      setPingResults(prev => ({
        ...prev,
        [providerId]: data
      }));
    } catch (err) {
      setPingResults(prev => ({
        ...prev,
        [providerId]: { success: false, error: 'Network Error' }
      }));
    } finally {
      setPingingId(null);
    }
  };

  const handleCopyBaseUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;
    const payload = { baseUrl: baseUrlInput };
    // The server now returns a masked placeholder instead of the real secret, so an
    // untouched field must not be written back over the stored credential. An empty
    // field where a key *was* configured is an explicit clear.
    const keyCleared = selectedProvider.hasApiKey && !apiKeyInput.trim();
    if (keyCleared) payload.userApiKey = '';
    else if (apiKeyInput && !apiKeyInput.includes('•')) payload.userApiKey = apiKeyInput;
    const cookieCleared = selectedProvider.hasCookie && !cookieInput.trim();
    if (cookieCleared) payload.userCookie = '';
    else if (cookieInput && !cookieInput.includes('•')) payload.userCookie = cookieInput;
    try {
      const res = await authFetch(`/api/providers/${selectedProvider.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => p.id === selectedProvider.id ? {
          ...p,
          ...(data.provider || {}),
          baseUrl: baseUrlInput
        } : p));
        setSelectedProvider(null);
      }
    } catch (err) {
      console.error('Failed to save provider config:', err);
    }
  };

  const handleAddCustomProvider = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/providers/custom/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customForm.name,
          baseUrl: customForm.baseUrl,
          authType: customForm.authType,
          userApiKey: customForm.userApiKey,
          isFree: customForm.isFree,
          description: customForm.description,
          models: [{ id: customForm.modelName, name: customForm.modelName, contextWindow: 32000, isFree: customForm.isFree }]
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setCustomForm({
          name: '',
          baseUrl: 'http://localhost:8000/v1',
          authType: 'bearer',
          userApiKey: '',
          isFree: false,
          description: '',
          modelName: 'custom-model'
        });
        fetchProviders();
      }
    } catch (err) {
      console.error('Failed to add custom provider:', err);
    }
  };

  const handleDeleteCustom = async (id) => {
    if (!confirm(t('prov.deleteConfirm'))) return;
    try {
      await authFetch(`/api/providers/custom/${id}`, { method: 'DELETE' });
      fetchProviders();
    } catch (err) {
      console.error('Failed to delete custom provider:', err);
    }
  };

  // Filtering
  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.models && p.models.some(m => m.id.toLowerCase().includes(search.toLowerCase())));
    
    if (!matchesSearch) return false;
    if (activeCategory === 'all') return true;
    if (activeCategory === 'custom') return p.isCustom;
    if (activeCategory === 'free') return p.isFree || !p.requiresAuth;
    return p.category === activeCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-heading flex items-center gap-2">
            <span>{t('prov.title')}</span>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {providers.length} Providers
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('prov.sub')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleProbeAll}
            disabled={probing}
            className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-60"
            title={t('prov.probeAllTitle')}
          >
            {probing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-emerald-400" />}
            <span>{probing ? t('prov.probing') : t('prov.probeAll')}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('prov.addProvider')}</span>
          </button>
        </div>
      </div>

      {/* Search & Category Tabs */}
      <div className="space-y-4 mb-8">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('prov.searchPh')}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t(cat.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Providers */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map(p => {
            const ping = pingResults[p.id];
            const isPingTesting = pingingId === p.id;
            const hasUserKey = Boolean(p.hasApiKey || p.userApiKey);
            const h = health[p.id];
            const isProbing = probingId === p.id;
            const HEALTH_TONES = {
              slate: 'bg-slate-800/80 text-slate-400 border-slate-700',
              emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            };
            const DOT_TONES = { slate: 'bg-slate-500', emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400' };
            const healthTone = !h ? 'slate' : (h.stale ? 'slate' : h.ok ? 'emerald' : (h.needsKey || h.keyWouldHelp || h.keyInvalid || h.keyExhausted) ? 'amber' : 'rose');
            const healthLabel = !h ? t('h.notTested') : h.stale ? t('h.stale', { n: Math.round(h.ageMs / 60000) }) : h.ok ? t('h.alive', { n: h.latencyMs || 0 }) : h.needsKey ? t('h.needKey') : h.keyInvalid ? t('h.keyInvalid') : h.keyExhausted ? t('h.keyExhausted') : h.keyWouldHelp ? t('h.freeOut') : t('h.dead');

            return (
              <div
                key={p.id}
                onClick={() => setDetailProvider(p)}
                className={`card-glass p-4 rounded-xl flex flex-col justify-between transition-all relative cursor-pointer hover:border-cyan-500/40 ${
                  !p.enabled ? 'opacity-60 bg-slate-950/40' : ''
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {p.category === 'wenker' ? (
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                        ) : p.isFree ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Cpu className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-100 leading-snug">{p.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {p.category}
                          </span>
                          {/* Cost and auth are two different things: a provider can be
                              free to use yet still require a (free) API key. Show them apart. */}
                          {p.isFree ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {t('prov.free')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {t('prov.paid')}
                            </span>
                          )}
                          {p.requiresAuth ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20" title={p.authType}>
                              {t('prov.needKeyBadge')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              {t('prov.noKeyBadge')}
                            </span>
                          )}
                          <span
                            title={h ? (h.ok ? t('prov.sampleAnswer', { s: h.sample || '' }) : h.error) : t('prov.healthTipTitle')}
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border flex items-center gap-1 ${HEALTH_TONES[healthTone]}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${DOT_TONES[healthTone]} ${h && !h.stale && h.ok ? 'animate-pulse' : ''}`} />
                            {healthLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(p); }}
                      className="text-slate-400 hover:text-cyan-400 transition"
                      title={p.enabled ? t('prov.toggleOn') : t('prov.toggleOff')}
                    >
                      {p.enabled ? (
                        <ToggleRight className="w-6 h-6 text-cyan-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-600" />
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 mt-1 leading-relaxed">
                    {p.description}
                  </p>

                  {/* Base URL Box */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 mb-3 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="truncate mr-2 text-cyan-300">{p.baseUrl}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyBaseUrl(p.baseUrl, p.id); }}
                      className="text-slate-400 hover:text-cyan-400 shrink-0"
                      title={t('prov.copyBaseTitle')}
                    >
                      {copiedId === p.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Models list snippet */}
                  <div className="mb-3">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {t('prov.modelsLabel')} ({p.models?.length || 0}):
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(p.models || []).slice(0, 3).map(m => (
                        <span key={m.id} className="text-[10px] bg-slate-800/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                          {m.id}
                        </span>
                      ))}
                      {(p.models || []).length > 3 && (
                        <span className="text-[10px] text-slate-500 self-center">
                          {t('prov.more', { n: p.models.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="border-t border-slate-800/60 pt-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePing(p.id); }}
                      disabled={isPingTesting}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition"
                      title={t('prov.pingTitle')}
                    >
                      {isPingTesting ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                      ) : (
                        <Zap className="w-3 h-3 text-amber-400" />
                      )}
                      <span>Ping</span>
                    </button>

                    {ping && (
                      <span className={`text-[10px] font-mono font-semibold ${ping.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ping.success ? `${ping.latencyMs}ms` : t('common.error')}
                      </span>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleProbeOne(p.id); }}
                      disabled={isProbing}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition disabled:opacity-60"
                      title={t('prov.testTitle')}
                    >
                      {isProbing ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      ) : (
                        <Activity className="w-3 h-3 text-emerald-400" />
                      )}
                      <span>Test</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {p.isCustom && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCustom(p.id); }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                        title={t('prov.deleteCustomTitle')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProvider(p);
                        setApiKeyInput(p.userApiKey || '');
                        setCookieInput(p.userCookie || '');
                        setBaseUrlInput(p.baseUrl || '');
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition flex items-center gap-1 ${
                        hasUserKey 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <Key className="w-3 h-3" />
                      <span>{hasUserKey ? t('prov.configured') : t('prov.configure')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Config Provider Key / Cookie */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card-glass bg-slate-900 border-slate-700 w-full max-w-lg p-6 rounded-2xl shadow-2xl">
            <h2 className="text-lg font-bold text-heading mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-cyan-400" />
              <span>{t('prov.configTitle')} {selectedProvider.name}</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t('prov.configSub')}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('prov.baseUrlLabel')}</label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('prov.apiKeyLabel')}{selectedProvider.authType && selectedProvider.authType !== 'none' ? ` (${selectedProvider.authType})` : ''}:
                  {!selectedProvider.requiresAuth && (
                    <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {t('prov.notRequired')}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={selectedProvider.requiresAuth ? 'sk-...' : t('prov.noKeyPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                {selectedProvider.hasApiKey && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-cyan-200/80">
                    {t('prov.maskHint')}
                  </p>
                )}
                {!selectedProvider.requiresAuth && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {t('prov.noKeyHelp')}
                  </p>
                )}
                {selectedProvider.keyHelp && (
                  <div className="mt-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-2.5 text-[11px] leading-relaxed text-cyan-200">
                    <span className="font-semibold text-cyan-300">
                      {selectedProvider.requiresAuth ? `${t('prov.keyHelpAuth')} ` : `${t('prov.keyHelpOpt')} `}
                    </span>
                    {selectedProvider.keyHelp}
                    {selectedProvider.website && (
                      <a
                        href={selectedProvider.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 ml-1 text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                      >
                        {t('prov.openPage')} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('prov.cookieLabel')}
                </label>
                <textarea
                  rows={2}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder={t('prov.cookiePh')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedProvider(null)}
                className="btn-secondary text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveConfig}
                className="btn-primary text-xs"
              >
                {t('common.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Provider Detail (OmniRouter-style: config + info + full model list) */}
      {detailProvider && (() => {
        const dp = detailProvider;
        const models = (dp.models || []).filter(m =>
          !modelSearch ||
          m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
          (m.name || '').toLowerCase().includes(modelSearch.toLowerCase())
        );
        const InfoRow = ({ label, value, mono }) => (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800/50 last:border-0">
            <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
            <span className={`text-[11px] text-slate-200 text-right break-all ${mono ? 'font-mono' : 'font-medium'}`}>
              {value === true ? <span className="text-emerald-400">{t('common.yes')}</span>
                : value === false ? <span className="text-slate-500">{t('common.no')}</span>
                : (value === '' || value == null) ? <span className="text-slate-600">—</span>
                : value}
            </span>
          </div>
        );
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => { setDetailProvider(null); setModelSearch(''); }}
          >
            <div
              className="card-glass bg-slate-900 border-slate-700 w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-start justify-between gap-3 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    {dp.category === 'wenker' ? (
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                    ) : dp.isFree ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Cpu className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-heading leading-tight">{dp.name}</h2>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">{dp.category}</span>
                      {dp.isFree && <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{t('prov.free')}</span>}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${dp.requiresAuth ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'}`}>
                        {dp.requiresAuth ? t('prov.needKeyBadge') : t('prov.noKeyBadge')}
                      </span>
                      {dp.isCustom && <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Custom</span>}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${dp.enabled ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        {dp.enabled ? t('prov.enabled') : t('prov.disabled')}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setDetailProvider(null); setModelSearch(''); }}
                  className="text-slate-500 hover:text-heading text-xl leading-none px-1"
                  title={t('common.close')}
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Thông tin */}
                <section>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" /> {t('prov.info')}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{dp.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow label="Provider ID" value={dp.id} mono />
                    <InfoRow label={t('prov.category')} value={dp.category} />
                    {dp.website && (
                      <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800/50">
                        <span className="text-[11px] text-slate-500 shrink-0">Website</span>
                        <a href={dp.website} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-400 hover:underline text-right break-all flex items-center gap-1">
                          {t('prov.openPage')} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    <InfoRow label={t('prov.modelCount')} value={dp.models?.length || 0} />
                  </div>
                </section>

                {/* Cấu hình */}
                <section>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-cyan-400" /> {t('prov.config')}
                  </h3>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2">
                    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/60">
                      <span className="text-[11px] text-slate-500 shrink-0">Base URL</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-cyan-300 truncate">{dp.baseUrl}</span>
                        <button
                          onClick={() => handleCopyBaseUrl(dp.baseUrl, 'detail-' + dp.id)}
                          className="text-slate-400 hover:text-cyan-400 shrink-0"
                          title={t('common.copy')}
                        >
                          {copiedId === 'detail-' + dp.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <InfoRow label={t('prov.authType')} value={dp.authType || 'none'} mono />
                    <InfoRow label={t('prov.headerName')} value={dp.headerName} mono />
                    <InfoRow label={t('prov.requiresKey')} value={dp.requiresAuth} />
                    <InfoRow label={t('prov.savedKey')} value={dp.userApiKey ? `${t('common.yes')} (${String(dp.userApiKey).slice(0, 6)}…${String(dp.userApiKey).slice(-4)})` : t('common.notSet')} mono />
                    <InfoRow label={t('prov.savedCookie')} value={dp.userCookie ? t('common.yes') : t('common.no')} />
                    {(() => {
                      const dh = health[dp.id];
                      const label = !dh ? t('prov.notChecked') : dh.stale ? t('prov.oldResult', { n: Math.round(dh.ageMs / 60000) }) : dh.ok ? t('prov.aliveStatus', { n: dh.latencyMs || 0 }) : dh.needsKey ? `${t('prov.needKeyStatus')}${dh.error ? ` — ${dh.error}` : ''}` : dh.keyInvalid ? `${t('prov.keyInvalidStatus')} — ${dh.error}` : dh.keyExhausted ? `${t('prov.keyExhaustedStatus')} — ${dh.error}` : dh.keyWouldHelp ? `${t('prov.freeOutStatus')} (${dh.error})` : `${t('prov.noAnswerStatus')} — ${dh.error}`;
                      return <InfoRow label={t('prov.checkStatus')} value={label} />;
                    })()}
                  </div>
                  {dp.keyHelp && (
                    <div className="mt-3 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-[11px] leading-relaxed text-cyan-200">
                      <div className="font-semibold text-cyan-300 mb-0.5">{t('prov.howToGetKey')}</div>
                      {dp.keyHelp}
                      {dp.website && (
                        <a href={dp.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
                          {t('prov.openSignup')} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSelectedProvider(dp);
                      setApiKeyInput(dp.userApiKey || '');
                      setCookieInput(dp.userCookie || '');
                      setBaseUrlInput(dp.baseUrl || '');
                    }}
                    className="btn-secondary text-xs mt-3 w-full justify-center"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{t('prov.editConfig')}</span>
                  </button>
                </section>

                {/* Danh sách model */}
                <section>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" /> {t('prov.modelList')} ({dp.models?.length || 0})
                    </h3>
                    <div className="relative w-44">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder={t('prov.filterModelPh')}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {models.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-3 text-center">{t('prov.noMatch')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {models.map(m => (
                        <div key={m.id} className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-mono text-slate-200 truncate" title={m.id}>{m.id}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {m.name || ''}
                              {m.servedModel && m.servedModel !== m.id && (
                                <span className="ml-1 px-1 py-px rounded bg-sky-500/10 border border-sky-500/25 text-sky-300" title={t('prov.realModel') + ' ' + m.servedModel}>
                                  → {m.servedModel.split('/').pop()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {m.contextWindow && (
                              <span className="text-[9px] font-mono text-slate-500">{Math.round(m.contextWindow / 1000)}k</span>
                            )}
                            <button
                              onClick={() => handleCopyBaseUrl(m.id, 'model-' + m.id)}
                              className="text-slate-500 hover:text-cyan-400"
                              title={t('prov.copyModelTitle')}
                            >
                              {copiedId === 'model-' + m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Add Custom Provider */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card-glass bg-slate-900 border-slate-700 w-full max-w-lg p-6 rounded-2xl shadow-2xl">
            <h2 className="text-lg font-bold text-heading mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>{t('prov.addTitle')}</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {t('prov.addSub')}
            </p>

            <form onSubmit={handleAddCustomProvider} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('prov.nameLabel')}</label>
                <input
                  required
                  type="text"
                  value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                  placeholder={t('prov.namePh')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('prov.baseUrlLabel')}</label>
                <input
                  required
                  type="text"
                  value={customForm.baseUrl}
                  onChange={(e) => setCustomForm({ ...customForm, baseUrl: e.target.value })}
                  placeholder="http://localhost:8000/v1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('prov.authLabel')}</label>
                  <select
                    value={customForm.authType}
                    onChange={(e) => setCustomForm({ ...customForm, authType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="bearer">{t('prov.authBearer')}</option>
                    <option value="api-key">{t('prov.authApiKey')}</option>
                    <option value="none">{t('prov.authNone')}</option>
                    <option value="cookie">{t('prov.authCookie')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('prov.defaultModelLabel')}</label>
                  <input
                    type="text"
                    value={customForm.modelName}
                    onChange={(e) => setCustomForm({ ...customForm, modelName: e.target.value })}
                    placeholder={t('prov.modelNamePh')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('prov.apiKeyIfAny')}</label>
                <input
                  type="password"
                  value={customForm.userApiKey}
                  onChange={(e) => setCustomForm({ ...customForm, userApiKey: e.target.value })}
                  placeholder={t('prov.apiKeyPh')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('prov.descLabel')}</label>
                <input
                  type="text"
                  value={customForm.description}
                  onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                  placeholder={t('prov.descPh')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFreeCheck"
                  checked={customForm.isFree}
                  onChange={(e) => setCustomForm({ ...customForm, isFree: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="isFreeCheck" className="text-slate-300 font-medium cursor-pointer">
                  {t('prov.freeCheck')}
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  {t('prov.createProvider')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
