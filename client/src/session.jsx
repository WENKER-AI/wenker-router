import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'wenker.session.token';

const SessionContext = createContext(null);

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // storage disabled - session simply won't persist across reloads
  }
}

/**
 * fetch() wrapper that always carries the login token, so /v1 requests are metered
 * against the logged-in user (1..9) instead of an anonymous IP.
 */
export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['x-wenker-session'] = token;
  // Server-localized catalog (provider/add-on descriptions) follows the UI language.
  try {
    const lang = localStorage.getItem('wenker.ui.lang');
    if (lang) headers['x-wenker-lang'] = lang;
  } catch (e) {
    /* storage disabled */
  }
  return fetch(url, { ...options, headers });
}

export function SessionProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [pin, setPin] = useState(null);
  const [quota, setQuota] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  // Restore a stored session on boot (and learn today's quota numbers).
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!getToken()) {
        setChecking(false);
        return;
      }
      try {
        const res = await authFetch('/api/auth/session');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setPin(data.pin);
          setQuota(data.quota);
        } else {
          setToken('');
          setTokenState('');
          setPin(null);
          setQuota(null);
        }
      } catch (e) {
        if (!cancelled) setQuota(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (code) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Dang nhap that bai.' };
    }
    setToken(data.token);
    setTokenState(data.token);
    setPin(data.pin);
    setQuota(data.quota);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore network failure, local session is dropped anyway
    }
    setToken('');
    setTokenState('');
    setPin(null);
    setQuota(null);
  }, []);

  const refreshQuota = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const res = await authFetch('/api/auth/quota');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setQuota(data.quota);
        return data.quota;
      }
    } catch (e) {
      // keep the last known numbers
    }
    return null;
  }, []);

  /**
   * Open one random sponsored creative in a new tab, wait for it to finish
   * (it posts back / closes itself), then claim the +N bonus requests.
   */
  const watchAd = useCallback(async () => {
    if (!getToken()) return { success: false, error: 'Chua dang nhap.' };
    const win = window.open('/ad.html', 'wenker_ad_' + Date.now(), 'width=760,height=560,noopener=no');
    if (!win) {
      return { success: false, error: 'Trinh duyet da chan popup. Hay cho phep popup cho localhost.' };
    }

    const finished = await new Promise((resolve) => {
      const onMessage = (event) => {
        if (event.data && event.data.type === 'wenker-ad-done') {
          window.removeEventListener('message', onMessage);
          clearInterval(poll);
          resolve(true);
        }
      };
      window.addEventListener('message', onMessage);
      // Fallback: detect the user closing the ad tab manually.
      const poll = setInterval(() => {
        if (win.closed) {
          window.removeEventListener('message', onMessage);
          clearInterval(poll);
          resolve(true);
        }
      }, 500);
    });

    if (!finished) return { success: false, error: 'Khong ghi nhan duoc luot xem.' };
    const res = await authFetch('/api/auth/quota/ad-credit', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setQuota(data.quota);
      return {
        success: true,
        granted: data.granted,
        bonus: data.bonus,
        reason: data.reason,
        quota: data.quota
      };
    }
    return { success: false, error: data.error || 'Khong the cong them luot.' };
  }, []);

  const value = useMemo(
    () => ({ token, pin, quota, checking, login, logout, refreshQuota, watchAd, authFetch }),
    [token, pin, quota, checking, login, logout, refreshQuota, watchAd]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
