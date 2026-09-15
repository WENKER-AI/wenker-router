import React, { useEffect, useState } from 'react';
import { Lock, Eye, Delete } from 'lucide-react';
import PixelW from './PixelW';
import { useSession } from '../session';
import { useI18n } from '../i18n';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function LoginScreen() {
  const { login } = useSession();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value) => {
    const pin = String(value).trim();
    if (!DIGITS.includes(pin)) {
      setError(t('login.errDigit'));
      return;
    }
    setBusy(true);
    setError('');
    const result = await login(pin);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      setCode('');
    }
  };

  const press = (digit) => {
    setError('');
    const next = (code + digit).slice(-1); // single digit only
    setCode(next);
    submit(next);
  };

  // Keyboard support: number row + numpad + Enter.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter') {
        if (code) submit(code);
        return;
      }
      if (e.key === 'Backspace') {
        setCode('');
        return;
      }
      if (DIGITS.includes(e.key)) press(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 selection:bg-cyan-500 selection:text-white font-sans">
      {/* soft background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="card-glass bg-slate-900/70 border-slate-800 rounded-2xl p-7 shadow-2xl">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 p-px shadow-sm">
              <div className="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center">
                <PixelW className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <h1 className="mt-3 text-xl font-extrabold tracking-wide text-heading">
              <span className="brand-pixel">WENKER</span> <span className="gradient-text">ROUTER</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{t('login.tagline')}</p>
          </div>

          <div className="flex items-center gap-2 justify-center mb-1">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">{t('login.verifyTitle')}</h2>
          </div>
          <p className="text-xs text-slate-400 text-center leading-relaxed mb-5">
            {t('login.verifySubA')} <span className="text-slate-200 font-semibold">{t('login.verifySubB')}</span> {t('login.verifySubC')}
          </p>

          {/* Passcode display */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{t('login.passwordLabel')}</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 border border-cyan-500/30">
              {DIGITS.map((d) => (
                <span key={d} className="text-lg font-mono font-bold text-cyan-300">{d}</span>
              ))}
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5">
            {DIGITS.map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                disabled={busy}
                className="h-14 rounded-xl bg-slate-800/70 border border-slate-700 text-xl font-bold text-slate-100 hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-300 active:scale-95 transition-all disabled:opacity-50"
              >
                {d}
              </button>
            ))}
          </div>

          {/* Status line */}
          <div className="mt-4 h-5 text-center">
            {busy ? (
              <span className="text-xs text-cyan-400 animate-pulse">{t('login.verifying')}</span>
            ) : error ? (
              <span className="text-xs text-rose-400">{error}</span>
            ) : code ? (
              <span className="text-xs text-slate-400 flex items-center gap-1 justify-center">
                <Eye className="w-3 h-3" /> {t('login.selected')} {code}
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">{t('login.hint')}</span>
            )}
          </div>

          <button
            onClick={() => { setCode(''); setError(''); }}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
          >
            <Delete className="w-3 h-3" />
            {t('login.reenter')}
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-4 font-mono">
          {t('login.footNote')}
        </p>
      </div>
    </div>
  );
}
