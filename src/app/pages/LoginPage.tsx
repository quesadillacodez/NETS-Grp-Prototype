import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Delete } from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { loginByPin } from '../utils/authStorage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = (code: string) => {
    const user = loginByPin(code);
    if (user) {
      navigate(user.isAdmin ? '/admin' : '/', { replace: true });
      return;
    }
    setError('Incorrect PIN. Please try again.');
    setPin('');
  };

  const press = (key: string) => {
    setError('');
    if (key === 'del') { setPin(current => current.slice(0, -1)); return; }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) submit(next);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* NETS red/blue accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#e30613] via-[#0053a0] to-[#0053a0]" />

      <div className="flex flex-1 flex-col px-7 pt-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <NETSLogo />
          <h1 className="mt-7 text-3xl font-black leading-tight text-[#101828]">
            Sign in to NETS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your 6-digit PIN to continue.</p>
        </motion.div>

        {/* PIN text box (tap the pad below to fill it) */}
        <div className="mt-8">
          <label className="mb-2 block text-sm font-semibold text-[#101828]">PIN</label>
          <div
            className={`flex h-14 items-center justify-center gap-3 rounded-2xl border-2 bg-white transition-colors ${
              error ? 'border-destructive' : 'border-border'
            }`}
          >
            {[0, 1, 2, 3, 4, 5].map(index => (
              <motion.div
                key={index}
                animate={{ scale: pin.length === index + 1 ? [1, 1.3, 1] : 1 }}
                className={`h-3.5 w-3.5 rounded-full ${
                  index < pin.length ? 'bg-[#0053a0]' : 'bg-secondary border border-border'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 h-5 text-sm font-semibold text-destructive">{error}</p>
        </div>

        {/* number pad */}
        <div className="mx-auto mt-4 grid w-full max-w-[320px] grid-cols-3 gap-3">
          {KEYS.map((key, index) => key === '' ? <div key={index} /> : (
            <button
              key={index}
              onClick={() => press(key)}
              className="grid h-16 place-items-center rounded-2xl bg-secondary text-2xl font-black text-[#101828] active:scale-95 transition-transform"
            >
              {key === 'del' ? <Delete size={22} /> : key}
            </button>
          ))}
        </div>

        <p className="mt-auto pb-8 pt-6 text-center text-xs text-muted-foreground">
          Your PIN signs you into your own NETS account.
        </p>
      </div>
    </div>
  );
}
