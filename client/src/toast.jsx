import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

/**
 * ToastProvider - thay the alert()/confirm() thong bao bang "toast" goct phai,
 * tu dong tat. Khong block chuoi nhu alert, chuyen nghiep hon nhieu.
 *
 * useToast().push({ type: 'success'|'error'|'info'|'warn', title, message, duration })
 * goi duoc tu bat ky component nao nam trong provider.
 */
const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, ring: 'border-emerald-500/40', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  error:   { icon: XCircle,       ring: 'border-rose-500/40',     text: 'text-rose-400',     bar: 'bg-rose-500' },
  warn:    { icon: AlertTriangle,  ring: 'border-amber-500/40',    text: 'text-amber-400',    bar: 'bg-amber-500' },
  info:    { icon: Info,           ring: 'border-cyan-500/40',     text: 'text-cyan-400',     bar: 'bg-cyan-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((opts) => {
    const id = ++idRef.current;
    const toast = {
      id,
      type: opts.type || 'info',
      title: opts.title || '',
      message: opts.message || '',
      duration: opts.duration == null ? 4200 : opts.duration,
    };
    setToasts((list) => [...list.slice(-4), toast]);
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none">
        {toasts.map((t) => {
          const tone = TONES[t.type] || TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border ${tone.ring} bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-black/40 pl-3 pr-8 py-2.5 animate-[toastIn_.18s_ease-out]`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone.text}`} />
                <div className="min-w-0">
                  {t.title && <p className="text-[13px] font-semibold text-slate-100 leading-tight">{t.title}</p>}
                  {t.message && <p className="text-xs text-slate-400 leading-snug mt-0.5 break-words">{t.message}</p>}
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="absolute top-2 right-2 p-0.5 rounded text-slate-500 hover:text-slate-200 transition"
                aria-label="close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <span className={`absolute left-0 top-0 h-full w-0.5 ${tone.bar}`} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { push: () => {}, dismiss: () => {} };
  return ctx;
}
