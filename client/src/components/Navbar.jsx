import React, { useState } from 'react';
import { 
  Terminal, 
  Sparkles, 
  Network, 
  Route, 
  Key, 
  Activity, 
  Settings, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Zap,
  LogOut,
  Compass,
  Puzzle,
  Globe,
  User as UserIcon
} from 'lucide-react';
import { useSession } from '../session';
import { useI18n, LANGS, LANG_NAMES } from '../i18n';

import PixelW from './PixelW';

export default function Navbar({ activeTab, setActiveTab, stats }) {
  const [copied, setCopied] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { pin, quota, logout } = useSession();
  const { lang, setLang, t } = useI18n();
  const baseUrl = "http://localhost:3600/v1";

  const handleCopyBase = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: Activity },
    { id: 'playground', label: t('nav.playground'), icon: Sparkles, badge: 'HOT' },
    { id: 'finder', label: t('nav.finder'), icon: Compass, badge: 'NEW' },
    { id: 'providers', label: `${t('nav.providers')} (${stats?.totalProviders ?? '…'})`, icon: Network },
    { id: 'routing', label: t('nav.routing'), icon: Route },
    { id: 'addons', label: t('nav.addons'), icon: Puzzle, badge: 'NEW' },
    { id: 'keys', label: t('nav.keys'), icon: Key },
    { id: 'logs', label: t('nav.logs'), icon: Terminal },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 p-px shadow-sm">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <PixelW className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="brand-pixel font-extrabold text-lg tracking-tight text-white">WENKER</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  ROUTER v2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">{t('nav.tagline')}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Info & Base URL Copy */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-400">Base URL:</span>
              <span className="text-cyan-300 font-semibold">{baseUrl}</span>
              <button 
                onClick={handleCopyBase} 
                className="p-1 hover:text-cyan-400 text-slate-400 transition" 
                title={t('nav.copyBase')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Language picker */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition"
                title={t('nav.lang')}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="uppercase font-mono">{lang}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-1.5">
                    {LANGS.map((code) => (
                      <button
                        key={code}
                        onClick={() => { setLang(code); setLangOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition ${
                          code === lang ? 'bg-cyan-500/15 text-cyan-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {LANG_NAMES[code]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Port: 3600</span>
            </div>

            {/* Logged-in user + WENKER Cloud allowance */}
            {pin && (
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300"
                  title={`${t('nav.user')}: ${pin}`}
                >
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold text-cyan-300">User {pin}</span>
                  {quota && (
                    <span className={`font-mono ${quota.exhausted ? 'text-rose-400' : 'text-slate-400'}`}>
                      {quota.exhausted ? t('nav.quotaOut') : `${quota.remaining}/${quota.dailyLimit}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Mobile Nav */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-1 border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap font-medium transition ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}
