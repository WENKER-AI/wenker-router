import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from './session';

const THEME_KEY = 'wenker.activeTheme';

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
  const [loading, setLoading] = useState(true);

  const themes = useMemo(() => addons.filter((a) => a.type === 'theme'), [addons]);

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

  // Apply the active theme whenever it (or the store) changes.
  // The previously applied vars are kept in a ref: when the active theme is deleted,
  // it is no longer present in `themes`, so looking it up there would never clear it.
  const appliedRef = useRef(null);
  useEffect(() => {
    const next = activeId ? themes.find((t) => t.id === activeId) : null;
    // Active theme vanished from the store -> fall back to the built-in default.
    if (activeId && !next) {
      setActiveId('');
      return;
    }
    const prev = appliedRef.current;
    if (prev && prev.id !== (next ? next.id : '')) clearVars(prev.vars);
    if (next && next.resolved) applyVars(next.resolved);
    appliedRef.current = next ? { id: next.id, vars: next.resolved } : null;
    try {
      if (activeId) localStorage.setItem(THEME_KEY, activeId);
      else localStorage.removeItem(THEME_KEY);
    } catch (e) {
      /* storage disabled */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, themes]);

  const setTheme = useCallback((id) => setActiveId(id || ''), []);

  const value = useMemo(
    () => ({ addons, themes, activeId, setTheme, reload, loading }),
    [addons, themes, activeId, setTheme, reload, loading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { addons: [], themes: [], activeId: '', setTheme: () => {}, reload: async () => {}, loading: false };
  }
  return ctx;
}
