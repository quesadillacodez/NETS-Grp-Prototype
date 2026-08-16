import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { loginWithCredentials } from '../utils/authStorage';
import { ApiError } from '../utils/serverApi';
import { getUserHomePath } from '../utils/userStorage';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const recoveredLoginId = (location.state as { loginId?: string } | null)?.loginId ?? '';
  const [loginId, setLoginId] = useState(recoveredLoginId);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now);
  const lockoutSeconds = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - clock) / 1000)) : 0;
  const isLocked = lockoutSeconds > 0;

  useEffect(() => {
    if (!lockedUntil) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= lockedUntil) {
        setLockedUntil(null);
        setError('');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLocked || isSigningIn || pin.length !== 6 || !loginId.trim()) return;

    setError('');
    setIsSigningIn(true);
    await new Promise(resolve => window.setTimeout(resolve, reduceMotion ? 0 : 450));
    try {
      const user = await loginWithCredentials(loginId, pin);
      navigate(getUserHomePath(user), { replace: true });
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      if (apiError?.retryAfter) {
        const now = Date.now();
        setClock(now);
        setLockedUntil(now + apiError.retryAfter * 1000);
        setError('Too many unsuccessful attempts. Sign-in is temporarily locked.');
      } else if (apiError?.status === 401) {
        setError('We could not match those details. Check them and try again.');
      } else {
        setError('Secure sign-in is temporarily unavailable. Check your connection and try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <motion.div
      className="h-full overflow-y-auto bg-[#041b42]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4 }}
    >
          <header className="relative min-h-[238px] overflow-hidden px-7 pb-12 pt-9 text-white">
            <div className="absolute -right-20 -top-20 size-64 rounded-full border-[34px] border-white/[0.04]" />
            <div className="absolute -bottom-20 -left-16 size-48 rounded-full bg-[#0066ff]/20 blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div className="rounded-xl bg-white px-3 py-2 shadow-lg shadow-black/15"><NETSLogo /></div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-100">
                <ShieldCheck className="size-3.5" /> Secure access
              </div>
            </div>

            <motion.div
              className="relative mt-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12 }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#68b2ff]">Welcome back</p>
              <h1 className="mt-2 text-[30px] font-black leading-tight tracking-tight text-white">Let’s get you signed in.</h1>
              <p className="mt-2 text-sm leading-relaxed text-blue-100/70">Access payments, rewards, and your money insights.</p>
            </motion.div>
          </header>

          <main className="relative -mt-6 min-h-[calc(100%-214px)] rounded-t-[30px] bg-white px-6 pb-8 pt-7 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
            <form onSubmit={submit} noValidate>
              <div>
                <label htmlFor="login-user-id" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  User ID
                </label>
                <div className={`flex h-14 items-center rounded-2xl border bg-slate-50 px-4 transition-all focus-within:bg-white focus-within:ring-4 ${error ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-[#0066ff] focus-within:ring-blue-100'}`}>
                  <UserRound className="mr-3 size-5 shrink-0 text-slate-400" />
                  <input
                    id="login-user-id"
                    value={loginId}
                    onChange={event => { setLoginId(event.target.value); if (!isLocked) setError(''); }}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your User ID"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="login-pin" className="text-xs font-bold uppercase tracking-wider text-slate-500">6-digit PIN</label>
                  <button
                    type="button"
                    onClick={() => navigate('/recover-pin', { state: { loginId } })}
                    className="text-xs font-bold text-[#0053a0]"
                  >
                    Forgot PIN?
                  </button>
                </div>
                <div className={`flex h-14 items-center rounded-2xl border bg-slate-50 px-4 transition-all focus-within:bg-white focus-within:ring-4 ${error ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-[#0066ff] focus-within:ring-blue-100'}`}>
                  <LockKeyhole className="mr-3 size-5 shrink-0 text-slate-400" />
                  <input
                    id="login-pin"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); if (!isLocked) setError(''); }}
                    autoComplete="current-password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter your PIN"
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-base font-bold tracking-[0.25em] text-slate-900 outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(current => !current)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="ml-2 grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="min-h-10 pt-2">
                {isLocked ? (
                  <p role="alert" className="text-xs font-semibold leading-relaxed text-red-600">
                    Sign-in locked. Try again in {lockoutSeconds} second{lockoutSeconds === 1 ? '' : 's'}, or recover your PIN.
                  </p>
                ) : error ? <p role="alert" className="text-xs font-semibold leading-relaxed text-red-600">{error}</p> : (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Protected by encrypted server-side verification.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLocked || !loginId.trim() || pin.length !== 6 || isSigningIn}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0053a0] text-sm font-black text-white shadow-[0_12px_24px_rgba(0,83,160,0.24)] transition-all hover:bg-[#004786] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isLocked
                  ? `Try again in ${lockoutSeconds}s`
                  : isSigningIn
                    ? <><LoaderCircle className="size-5 animate-spin" /> Verifying securely…</>
                    : 'Sign in securely'}
              </button>
            </form>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-slate-400">
              By continuing, you agree to the NETS prototype terms and privacy notice.
            </p>
          </main>
    </motion.div>
  );
}
