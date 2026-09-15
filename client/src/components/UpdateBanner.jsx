import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { authFetch } from '../session';
import { onServerEvent } from '../sse';

const DISMISS_KEY = 'wenker.update.dismissed';

/**
 * UpdateBanner - thong bao toan dashboard khi server phat hien ban WENKER moi hon
 * tren npm registry (xem server/services/updateService.js).
 *
 * Server day su kien 'update' qua SSE; o day lang nghe va hien mot thanh ngang.
 * Nguoi dung co the dong (luu vao localStorage theo version de khong nhac lai),
 * hoac mo trang npm de tai ban moi.
 */
export default function UpdateBanner() {
  const { t } = useI18n();
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Lan dau: lay trang thai update server dang co (khong cho ket noi SSE).
    let alive = true;
    authFetch('/api/update').then((r) => r.json()).then((d) => {
      if (alive && d && d.available) setInfo(d);
    }).catch(() => {});
    // Sau do: nhan bao khi server phat hien ban moi.
    const off = onServerEvent('update', (d) => {
      if (d && d.available) setInfo(d);
      if (d && !d.available) setInfo(null);
    });
    return () => { alive = false; off(); };
  }, []);

  if (!info || !info.available) return null;

  let dismissed = '';
  try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch (e) { /* ignore */ }
  if (dismissed === info.latest) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, info.latest); } catch (e) { /* ignore */ }
    setInfo(null);
  };

  const recheck = async () => {
    setChecking(true);
    try {
      const r = await authFetch('/api/update?force=1');
      const d = await r.json();
      if (d && d.available) setInfo(d); else setInfo(null);
    } catch (e) { /* keep banner */ }
    finally { setChecking(false); }
  };

  return (
    <div className="sticky top-0 z-[70] px-4 pt-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 to-indigo-500/10 backdrop-blur-xl px-4 py-2.5 shadow-lg shadow-cyan-500/5">
        <ArrowUpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-100 leading-tight">
            {t('upd.title', { v: info.latest })}
          </p>
          <p className="text-[11px] text-slate-400 leading-snug mt-0.5 truncate">
            {t('upd.sub', { cur: info.current })}
          </p>
        </div>
        <button
          onClick={() => window.open(`https://www.npmjs.com/package/wenker-router/v/${info.latest}`, '_blank')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t('upd.view')}</span>
        </button>
        <button
          onClick={recheck}
          disabled={checking}
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 transition disabled:opacity-50 shrink-0"
          title={t('upd.recheck')}
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={close} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition shrink-0" title={t('upd.later')}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
