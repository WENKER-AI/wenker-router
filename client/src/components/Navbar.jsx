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
  ShieldCheck,
  LogOut,
  Compass,
  Puzzle,
  Globe,
  BarChart3,
  ChevronLeft,
  Menu,
  X,
  User as UserIcon
} from 'lucide-react';
import { useSession } from '../session';
import { useI18n, LANGS, LANG_NAMES } from '../i18n';

import PixelW from './PixelW';

const COLLAPSE_KEY = 'wenker.ui.sidebar';

// Version that tu package.json goc (Vite define __APP_VERSION__ trong vite.config.js).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';

export default function Navbar({ activeTab, setActiveTab, stats }) {
  const [copied, setCopied] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) { return false; }
  });
  const { pin, quota, logout } = useSession();
  const { lang, setLang, t } = useI18n();
  const baseUrl = "http://localhost:3600/v1";

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1'); } catch (e) { /* ignore */ }
      return !v;
    });
  };

  const handleCopyBase = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const groups = [
    {
      label: t('nav.sectionMain'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: Activity },
        { id: 'playground', label: t('nav.playground'), icon: Sparkles, badge: 'HOT' },
        { id: 'finder', label: t('nav.finder'), icon: Compass, badge: 'NEW' },
        { id: 'providers', label: `${t('nav.providers')}${stats?.totalProviders != null ? ` ${stats.totalProviders}` : ''}`, icon: Network },
        { id: 'routing', label: t('nav.routing'), icon: Route },
      ],
    },
    {
      label: t('nav.sectionSystem'),
      items: [
        { id: 'addons', label: t('nav.addons'), icon: Puzzle, badge: 'NEW' },
        { id: 'stats', label: t('nav.stats'), icon: BarChart3 },
        { id: 'keys', label: t('nav.keys'), icon: Key },
        { id: 'logs', label: t('nav.logs'), icon: Terminal },
        { id: 'settings', label: t('nav.settings'), icon: Settings },
      ],
    },
  ];

  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center gap-2.5 w-full rounded-lg text-[13px] font-medium transition-all ${
          collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2' : 'px-3 py-2'
        } ${
          isActive
            ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/25'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
        {item.badge && !collapsed && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const LangPicker = ({ alignRight }) => (
    <div className="relative">
      <button
        onClick={() => setLangOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition ${collapsed ? 'lg:w-full lg:justify-center lg:px-0' : ''}`}
        title={t('nav.lang')}
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span className={`uppercase font-mono ${collapsed ? 'lg:hidden' : ''}`}>{lang}</span>
      </button>
      {langOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
          <div className={`absolute bottom-full mb-1.5 z-50 w-40 rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-1.5 ${alignRight ? 'right-0' : 'left-0'}`}>
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
  );

  return (
    <>
      {/* ============ LEFT SIDEBAR (desktop) ============ */}
      <aside
        className={`hidden lg:flex sticky top-0 h-screen shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl z-40 transition-[width] duration-200 ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-4'} h-16 shrink-0 border-b border-slate-800/70`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 p-px shadow-sm shadow-cyan-500/10 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <PixelW className="w-[18px] h-[18px] text-cyan-400" />
            </div>
          </div>
          <div className={`min-w-0 ${collapsed ? 'hidden' : ''}`}>
            <div className="flex items-center gap-1.5">
              <span className="brand-pixel font-extrabold text-[15px] tracking-tight text-heading leading-none">WENKER</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 whitespace-nowrap">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{t('nav.tagline')}</p>
          </div>
          <button
            onClick={toggleCollapsed}
            className={`p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-cyan-500/30 transition ${collapsed ? 'hidden' : 'ml-auto'}`}
            title={t('nav.collapse')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="mx-auto mt-2 p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-cyan-500/30 transition"
            title={t('nav.expand')}
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ${collapsed ? 'text-center px-0' : ''}`}>
                {collapsed ? '···' : group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => <NavButton key={item.id} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        {/* Base URL */}
        <div className={`px-3 pb-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <button
              onClick={handleCopyBase}
              className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition"
              title={t('nav.copyBase')}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] font-mono min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-cyan-300 font-semibold truncate">{baseUrl}</span>
              <button
                onClick={handleCopyBase}
                className="ml-auto p-1 hover:text-cyan-400 text-slate-500 transition shrink-0"
                title={t('nav.copyBase')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Footer: port, language, user */}
        <div className="border-t border-slate-800/70 px-3 py-3 space-y-2">
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${collapsed ? 'justify-center px-0' : ''}`}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className={collapsed ? 'hidden' : ''}>Port: 3600</span>
          </div>
          <LangPicker />
          {pin && (
            <div className="space-y-1.5">
              <div
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 min-w-0 ${collapsed ? 'justify-center px-0' : ''}`}
                title={`${t('nav.user')}: ${pin}`}
              >
                <UserIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className={`font-bold text-cyan-300 ${collapsed ? 'hidden' : ''}`}>User {pin}</span>
                {quota && !collapsed && (
                  <span className={`font-mono ml-auto ${quota.exhausted ? 'text-rose-400' : 'text-slate-400'}`}>
                    {quota.exhausted ? t('nav.quotaOut') : `${quota.remaining}/${quota.dailyLimit}`}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition w-full ${collapsed ? 'justify-center px-0' : ''}`}
                title={t('nav.logout')}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className={collapsed ? 'hidden' : ''}>{t('nav.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ============ TOP BAR (mobile only) ============ */}
      <header className="lg:hidden sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 p-px shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                  <PixelW className="w-[18px] h-[18px] text-cyan-400" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="brand-pixel font-extrabold text-[15px] tracking-tight text-heading leading-none">WENKER</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 whitespace-nowrap">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{t('nav.tagline')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyBase}
                className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-300"
                title={t('nav.copyBase')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <LangPicker alignRight />
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300"
                title={t('nav.menu')}
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* User row */}
          {pin && (
            <div className="flex items-center gap-2 pb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-cyan-300">User {pin}</span>
                {quota && (
                  <span className={`font-mono ${quota.exhausted ? 'text-rose-400' : 'text-slate-400'}`}>
                    {quota.exhausted ? t('nav.quotaOut') : `${quota.remaining}/${quota.dailyLimit}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Port: 3600</span>
              </div>
              <button
                onClick={logout}
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
                title={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Slide-down grouped menu */}
          {mobileOpen && (
            <div className="border-t border-slate-800/70 py-3 space-y-4 bg-slate-950/95">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1 px-3">
                    {group.items.map((item) => <NavButton key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ============ BOTTOM BAR (mobile only) ============ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {[
            { id: 'dashboard', label: t('nav.dashboardShort'), icon: Activity },
            { id: 'playground', label: t('nav.playgroundShort'), icon: Sparkles },
            { id: 'finder', label: t('nav.finder'), icon: Compass },
            { id: 'logs', label: t('nav.logsShort'), icon: Terminal },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  isActive ? 'text-cyan-300' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : ''}`} />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
              mobileOpen || !['dashboard', 'playground', 'finder', 'logs'].includes(activeTab)
                ? 'text-cyan-300'
                : 'text-slate-500'
            }`}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
