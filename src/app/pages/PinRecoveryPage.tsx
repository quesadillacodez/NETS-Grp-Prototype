import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { verifyRecoveryIdentity } from '../utils/authStorage';
import { isAcceptablePin, resetLoginSecurity } from '../utils/loginSecurity';
import { updateUserPin } from '../utils/userStorage';

type RecoveryStep = 'identify' | 'verify' | 'reset' | 'complete';

function createVerificationCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100_000 + (values[0] % 900_000));
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `•••• ${digits.slice(-4)}`;
}

function StepIndicator({ step }: { step: RecoveryStep }) {
  const activeIndex = ['identify', 'verify', 'reset', 'complete'].indexOf(step);
  return (
    <div className="mb-7 flex items-center" aria-label={`Recovery step ${Math.min(activeIndex + 1, 3)} of 3`}>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-1 items-center last:flex-none">
          <div className={`grid size-7 place-items-center rounded-full text-[11px] font-black ${index <= activeIndex ? 'bg-[#0053a0] text-white' : 'bg-slate-100 text-slate-400'}`}>
            {index < activeIndex || step === 'complete' ? '✓' : index + 1}
          </div>
          {index < 2 ? <div className={`h-0.5 flex-1 ${index < activeIndex ? 'bg-[#0053a0]' : 'bg-slate-100'}`} /> : null}
        </div>
      ))}
    </div>
  );
}

export function PinRecoveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const incomingState = location.state as { loginId?: string; from?: string } | null;
  const initialLoginId = incomingState?.loginId ?? '';
  const from = incomingState?.from;
  const [step, setStep] = useState<RecoveryStep>('identify');
  const [loginId, setLoginId] = useState(initialLoginId);
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const pause = () => new Promise(resolve => window.setTimeout(resolve, reduceMotion ? 0 : 450));

  const identifyAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginId.trim() || !phone.trim() || isWorking) return;
    setError('');
    setIsWorking(true);
    await pause();
    const user = verifyRecoveryIdentity(loginId, phone);
    setIsWorking(false);
    if (!user) {
      setError('Those details do not match our records. Check them and try again.');
      return;
    }

    setAccountId(user.id);
    setMaskedPhone(maskPhone(user.phone));
    setVerificationCode(createVerificationCode());
    setStep('verify');
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enteredCode.length !== 6 || isWorking) return;
    setError('');
    setIsWorking(true);
    await pause();
    setIsWorking(false);
    if (enteredCode !== verificationCode) {
      setError('That verification code is not correct. Please try again.');
      return;
    }
    setStep('reset');
  };

  const saveNewPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!isAcceptablePin(newPin)) {
      setError('Choose six digits that are not repeated or sequential.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('The two PIN entries do not match.');
      return;
    }
    if (isWorking) return;

    setIsWorking(true);
    await pause();
    updateUserPin(accountId, newPin);
    resetLoginSecurity();
    setIsWorking(false);
    setStep('complete');
  };

  const goBack = () => {
    setError('');
    if (step === 'identify') {
      navigate('/login', { replace: true, state: { loginId, from } });
    } else if (step === 'verify') {
      setEnteredCode('');
      setStep('identify');
    } else if (step === 'reset') {
      setNewPin('');
      setConfirmPin('');
      setStep('verify');
    }
  };

  return (
    <motion.div
      className="h-full overflow-y-auto bg-[#041b42]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
    >
      <header className="relative min-h-[210px] overflow-hidden px-6 pb-11 pt-8 text-white">
        <div className="absolute -right-20 -top-24 size-64 rounded-full border-[34px] border-white/[0.04]" />
        {step !== 'complete' ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="relative grid size-10 place-items-center rounded-full border border-white/15 bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : <div className="h-10" />}
        <div className="relative mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#68b2ff]">Secure account recovery</p>
          <h1 className="mt-2 text-[28px] font-black leading-tight text-white">
            {step === 'complete' ? 'Your PIN is ready.' : 'Reset your PIN safely.'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-blue-100/70">
            {step === 'complete' ? 'Use your new PIN the next time you sign in.' : 'We’ll verify it’s you before making any changes.'}
          </p>
        </div>
      </header>

      <main className="relative -mt-6 min-h-[calc(100%-186px)] rounded-t-[30px] bg-white px-6 pb-8 pt-7">
        <StepIndicator step={step} />

        {step === 'identify' ? (
          <form onSubmit={identifyAccount} noValidate>
            <h2 className="text-xl font-black text-slate-900">Confirm your account</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Enter the details registered to your NETS profile.</p>

            <label htmlFor="recovery-user-id" className="mb-2 mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">User ID</label>
            <div className="flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#0066ff] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
              <UserRound className="mr-3 size-5 text-slate-400" />
              <input id="recovery-user-id" value={loginId} onChange={event => { setLoginId(event.target.value); setError(''); }} autoComplete="username" autoCapitalize="none" placeholder="Enter your User ID" className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" />
            </div>

            <label htmlFor="recovery-phone" className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Registered mobile number</label>
            <div className="flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#0066ff] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
              <Phone className="mr-3 size-5 text-slate-400" />
              <input id="recovery-phone" value={phone} onChange={event => { setPhone(event.target.value); setError(''); }} autoComplete="tel" inputMode="tel" placeholder="Enter your mobile number" className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" />
            </div>

            <RecoveryMessage error={error} />
            <RecoveryButton disabled={!loginId.trim() || !phone.trim() || isWorking} loading={isWorking}>Send verification code</RecoveryButton>
          </form>
        ) : null}

        {step === 'verify' ? (
          <form onSubmit={verifyCode} noValidate>
            <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-[#0053a0]"><MessageSquareText className="size-6" /></div>
            <h2 className="mt-5 text-xl font-black text-slate-900">Check your messages</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">We sent a six-digit verification code to {maskedPhone}.</p>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Prototype verification code</p>
              <p className="mt-1 font-mono text-xl font-black tracking-[0.3em] text-amber-900">{verificationCode}</p>
            </div>

            <label htmlFor="recovery-code" className="mb-2 mt-5 block text-xs font-bold uppercase tracking-wider text-slate-500">Verification code</label>
            <div className="flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#0066ff] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
              <KeyRound className="mr-3 size-5 text-slate-400" />
              <input id="recovery-code" value={enteredCode} onChange={event => { setEnteredCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="Enter the 6-digit code" className="h-full min-w-0 flex-1 bg-transparent font-mono text-base font-bold tracking-[0.22em] text-slate-900 outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400" />
            </div>

            <RecoveryMessage error={error} />
            <RecoveryButton disabled={enteredCode.length !== 6 || isWorking} loading={isWorking}>Verify code</RecoveryButton>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form onSubmit={saveNewPin} noValidate>
            <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-[#0053a0]"><LockKeyhole className="size-6" /></div>
            <h2 className="mt-5 text-xl font-black text-slate-900">Create a new PIN</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Use six digits that are not repeated or sequential.</p>

            <label htmlFor="new-pin" className="mb-2 mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">New PIN</label>
            <PinField id="new-pin" value={newPin} showPin={showPin} onChange={setNewPin} onToggle={() => setShowPin(current => !current)} placeholder="Enter a new PIN" />

            <label htmlFor="confirm-pin" className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Confirm new PIN</label>
            <PinField id="confirm-pin" value={confirmPin} showPin={showPin} onChange={setConfirmPin} placeholder="Re-enter your new PIN" />

            <RecoveryMessage error={error} />
            <RecoveryButton disabled={newPin.length !== 6 || confirmPin.length !== 6 || isWorking} loading={isWorking}>Save new PIN</RecoveryButton>
          </form>
        ) : null}

        {step === 'complete' ? (
          <div className="text-center">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <BadgeCheck className="size-10" />
            </motion.div>
            <h2 className="mt-6 text-2xl font-black text-slate-900">PIN reset complete</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">Your account is unlocked and ready to use with your new PIN.</p>
            <button type="button" onClick={() => navigate('/login', { replace: true, state: { loginId, from } })} className="mt-8 h-14 w-full rounded-2xl bg-[#0053a0] text-sm font-black text-white shadow-[0_12px_24px_rgba(0,83,160,0.24)]">Return to sign in</button>
          </div>
        ) : null}

        {step !== 'complete' ? (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-500" /> Never share your verification code or PIN.
          </p>
        ) : null}
      </main>
    </motion.div>
  );
}

function RecoveryMessage({ error }: { error: string }) {
  return (
    <div className="min-h-11 pt-2">
      {error ? <p role="alert" className="text-xs font-semibold leading-relaxed text-red-600">{error}</p> : null}
    </div>
  );
}

function RecoveryButton({ children, disabled, loading }: { children: string; disabled: boolean; loading: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0053a0] text-sm font-black text-white shadow-[0_12px_24px_rgba(0,83,160,0.24)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
      {loading ? <><LoaderCircle className="size-5 animate-spin" /> Checking securely…</> : children}
    </button>
  );
}

interface PinFieldProps {
  id: string;
  value: string;
  showPin: boolean;
  onChange: (value: string) => void;
  onToggle?: () => void;
  placeholder: string;
}

function PinField({ id, value, showPin, onChange, onToggle, placeholder }: PinFieldProps) {
  return (
    <div className="flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#0066ff] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
      <LockKeyhole className="mr-3 size-5 text-slate-400" />
      <input id={id} type={showPin ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="new-password" inputMode="numeric" maxLength={6} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent font-mono text-base font-bold tracking-[0.22em] text-slate-900 outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400" />
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-label={showPin ? 'Hide PIN' : 'Show PIN'} className="ml-2 grid size-9 place-items-center rounded-full text-slate-400">
          {showPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      ) : null}
    </div>
  );
}
