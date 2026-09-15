import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from './session';
import { accentVars, DEFAULT_ACCENT } from './accents';

const THEME_KEY = 'wenker.activeTheme';
const ACCENT_KEY = 'wenker.ui.accent';

const ThemeContext = createContext(null);

function applyVars(vars) {
  const root = document.documentElement;
  if (!vars) return;
  for (const [k, v] of Object.entries(vars)) {
    try {
      root.style.setProperty(k, v);
    } catch (e) {
      /* ignore invalid */
    }
  }
}

function clearVars(vars) {
  const root = document.documentElement;
  if (!vars) return;
  for (const k of Object.keys(vars)) root.style.removeProperty(k);
}

/**
 * Loads the add-on store, keeps the currently active theme id, and applies its
 * resolved CSS variables to <html>. Switching themes is instant and persists.
 */
export function ThemeProvider({ children }) {
  const [addons, setAddons] = useState([]);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; }
  });
  const [accentId, setAccentIdState] = useState(() => {
    try { return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT; } catch (e) { return DEFAULT_ACCENT; }
  });
  const [loading, setLoading] = useState(true);

  const themes = useMemo(() => addons.filter((a) => a.type === 'theme'), [addons]);

  const setAccent = useCallback((id) => {
    const next = id || DEFAULT_ACCENT;
    setAccentIdState(next);
    try {
      if (next === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
      else localStorage.setItem(ACCENT_KEY, next);
    } catch (e) { /* storage disabled */ }
  }, []);

  const reload = useCallback(async () => {
    try {
      const res = await authFetch('/api/addons');
      const data = await res.json();
      setAddons(Array.isArray(data.addons) ? data.addons : []);
      return data.addons || [];
    } catch (e) {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Bien CSS dang ap dung cho lan truoc (de clear dung cac key da thay doi).
  const appliedRef = useRef(null);
  useEffect(() => {
    const next = activeId ? themes.find((t) => t.id === activeId) : null;
    // Active theme vanished from the store -> fall back to the built-in default.
    if (activeId && !next) {
      setActiveId('');
      return;
    }
    // Gop accent + add-on theme. Add-on theme (co the chua chinh --color-cyan-*)
    // duoc merge SAU de no toan quyen de len accent khi nguoi dung bat theme.
    const merged = { ...accentVars(accentId), ...((next && next.resolved) || {}) };
    const prev = appliedRef.current;
    if (prev) clearVars(prev.vars);
    applyVars(merged);
    appliedRef.current = { vars: merged };
    try {
      if (activeId) localStorage.setItem(THEME_KEY, activeId);
      else localStorage.removeItem(THEME_KEY);
    } catch (e) {
      /* storage disabled */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, themes, accentId]);

  const setTheme = useCallback((id) => setActiveId(id || ''), []);

  const value = useMemo(
    () => ({ addons, themes, activeId, setTheme, accentId, setAccent, reload, loading }),
    [addons, themes, activeId, setTheme, accentId, setAccent, reload, loading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { addons: [], themes: [], activeId: '', setTheme: () => {}, accentId: DEFAULT_ACCENT, setAccent: () => {}, reload: async () => {}, loading: false };
  }
  return ctx;
}
