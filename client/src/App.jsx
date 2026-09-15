import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Playground from './components/Playground';
import ProvidersView from './components/ProvidersView';
import RoutingView from './components/RoutingView';
import KeyManager from './components/KeyManager';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import ModelFinder from './components/ModelFinder';
import AddonsView from './components/AddonsView';
import StatisticsView from './components/StatisticsView';
import LoginScreen from './components/LoginScreen';
import { useSession, authFetch } from './session';
import { useI18n } from './i18n';
import { Zap } from 'lucide-react';

export default function App() {
  const { token, checking } = useSession();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  // Model picked in Model Finder; handed to Playground as a prop because tabs are
  // conditionally mounted and a window event fired before mount is simply lost.
  const [requestedModel, setRequestedModel] = useState(null);

  const useModel = useCallback((modelId) => {
    setRequestedModel(modelId);
    setActiveTab('playground');
  }, []);

  const clearRequestedModel = useCallback(() => setRequestedModel(null), []);

  const fetchStats = async () => {
    try {
      const res = await authFetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    // Only poll stats once the user is past the human-verification gate.
    if (!token) return;
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Boot: verifying a stored session token.
  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 p-px animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">{t('app.checking')}</span>
        </div>
      </div>
    );
  }

  // Human-verification gate on first open.
  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row selection:bg-cyan-500 selection:text-white font-sans">
      {/* Left sidebar (desktop) / top bar (mobile) */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
      />

      <div className="flex-1 flex flex-col min-w-0">
      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'dashboard' && (
          <Dashboard stats={stats} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'playground' && (
          <Playground requestedModel={requestedModel} onModelConsumed={clearRequestedModel} />
        )}
        {activeTab === 'finder' && (
          <ModelFinder setActiveTab={setActiveTab} onUseModel={useModel} />
        )}
        {activeTab === 'addons' && (
          <AddonsView />
        )}
        {activeTab === 'providers' && (
          <ProvidersView />
        )}
        {activeTab === 'routing' && (
          <RoutingView />
        )}
        {activeTab === 'keys' && (
          <KeyManager />
        )}
        {activeTab === 'logs' && (
          <LogsView />
        )}
        {activeTab === 'stats' && (
          <StatisticsView />
        )}
        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">WENKER Router</span>
            <span>•</span>
            <span>{t('app.footerOpen')}</span>
            <span>•</span>
            <span className="text-cyan-400">180+ AI Providers &amp; WENKER Cloud</span>
          </div>
          <div className="text-[11px] font-mono text-slate-600">
            OpenAI &amp; Anthropic Standard Compatible • Localhost Port: 3600
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
