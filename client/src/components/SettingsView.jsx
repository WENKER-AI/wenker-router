import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Check, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Sliders, 
  Info,
  Terminal,
  Laptop,
  Globe
} from 'lucide-react';
import { authFetch } from '../session';
import { useI18n } from '../i18n';

export default function SettingsView() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [proxyTesting, setProxyTesting] = useState(false);
  const [proxyResult, setProxyResult] = useState(null);

  const testProxy = async () => {
    setProxyTesting(true);
    setProxyResult(null);
    try {
      const res = await authFetch('/api/settings/proxy-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyUrl: settings.proxyUrl })
      });
      const data = await res.json();
      setProxyResult(data);
    } catch (err) {
      setProxyResult({ ok: false, error: String(err && err.message ? err.message : err) });
    } finally {
      setProxyTesting(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      <div>
        <h1 className="text-2xl font-extrabold text-heading flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          <span>{t('set.title')}</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          {t('set.sub')}
        </p>
      </div>

      {loading || !settings ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Card: Core Settings */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-heading flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>{t('set.localTitle')}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('set.portLabel')}</label>
                <input
                  type="number"
                  value={settings.port || 3600}
                  onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 3600 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{t('set.portHelp')}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('set.hostLabel')}</label>
                <input
                  type="text"
                  value={settings.host || '0.0.0.0'}
                  onChange={(e) => setSettings({ ...settings, host: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{t('set.hostHelp')}</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-slate-300 font-medium mb-1 text-xs">{t('set.defaultModelLabel')}</label>
              <input
                type="text"
                value={settings.defaultModel || 'wenker-deepseek-r1-free'}
                onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Card: Smart Fallback */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-heading flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t('set.failoverTitle')}</span>
            </h2>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="smartFallbackCheck"
                checked={Boolean(settings.enableSmartFallback)}
                onChange={(e) => setSettings({ ...settings, enableSmartFallback: e.target.checked })}
                className="mt-1 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <div>
                <label htmlFor="smartFallbackCheck" className="text-slate-200 text-xs font-semibold cursor-pointer block">
                  {t('set.failoverCheck')}
                </label>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  {t('set.failoverHelp')}
                </p>
              </div>
            </div>
          </div>

          {/* Card: Outbound VPN / HTTP proxy */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="font-bold text-sm text-heading flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              <span>{t('set.proxyTitle')}</span>
            </h2>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="proxyEnabledCheck"
                checked={Boolean(settings.proxyEnabled)}
                onChange={(e) => setSettings({ ...settings, proxyEnabled: e.target.checked })}
                className="mt-1 rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-violet-500"
              />
              <div>
                <label htmlFor="proxyEnabledCheck" className="text-slate-200 text-xs font-semibold cursor-pointer block">
                  {t('set.proxyCheck')}
                </label>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  {t('set.proxyHelp')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('set.proxyUrlLabel')}</label>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:7890"
                  value={settings.proxyUrl || ''}
                  onChange={(e) => setSettings({ ...settings, proxyUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{t('set.proxyUrlHelp')}</span>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('set.noProxyLabel')}</label>
                <input
                  type="text"
                  placeholder="localhost, internal.company"
                  value={settings.proxyNoProxy || ''}
                  onChange={(e) => setSettings({ ...settings, proxyNoProxy: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-violet-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">{t('set.noProxyHelp')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={testProxy}
                disabled={proxyTesting || !settings.proxyUrl}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {proxyTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>{t('set.testConn')}</span>
              </button>
              {proxyResult && (
                <span className={proxyResult.ok ? 'text-[11px] text-emerald-400' : 'text-[11px] text-rose-400'}>
                  {proxyResult.ok
                    ? <>{t('set.testOk')} <strong className="font-mono">{proxyResult.ip}</strong> · {proxyResult.latencyMs}ms</>
                    : <>{t('set.testFail')} {proxyResult.error}</>}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {t('set.proxySaveNote')}
            </p>
          </div>

          {/* Card: About */}
          <div className="card-glass p-6 rounded-xl space-y-3">
            <h2 className="font-bold text-sm text-heading flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>{t('set.aboutTitle')}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">{t('set.version')}</span>
                <span className="font-bold text-slate-200">{settings.version || '2.0.0'}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">{t('set.license')}</span>
                <span className="font-bold text-slate-200">{t('set.licenseVal')}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">{t('set.protocol')}</span>
                <span className="font-bold text-cyan-400">OpenAI + Anthropic</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] block">{t('set.env')}</span>
                <span className="font-bold text-emerald-400">Local Zero-Latency</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary text-xs"
            >
              {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{saved ? t('common.saved') : t('common.saveChanges')}</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
