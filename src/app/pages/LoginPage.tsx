import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Delete, Fingerprint, ShieldCheck } from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { getAllUsers, type User } from '../utils/userStorage';
import { DEMO_PASSCODE, login } from '../utils/authStorage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function LoginPage() {
  const navigate = useNavigate();
  const [users] = useState(() => getAllUsers());
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = (code: string) => {
    if (!selected) return;
    if (login(selected.id, code)) {
      navigate(selected.isAdmin ? '/admin' : '/', { replace: true });
      return;
    }
    setError('Incorrect passcode. Try again.');
    setPin('');
  };

  const press = (key: string) => {
    setError('');
    if (key === 'del') { setPin(current => current.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) submit(next);
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a]">
      <div className="px-6 pt-14 pb-6">
        {selected ? (
          <button
            onClick={() => { setSelected(null); setPin(''); setError(''); }}
            className="mb-5 grid h-9 w-9 place-items-center rounded-full bg-white/20"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
        ) : (
          <div className="mb-5 h-9" />
        )}
        <div className="rounded-2xl bg-white/95 px-3 py-2 inline-block"><NETSLogo /></div>
        <h1 className="mt-4 text-2xl font-black text-white">
          {selected ? `Welcome back, ${selected.name.split(' ')[0]}` : 'Sign in to NETS'}
        </h1>
        <p className="mt-1 text-sm text-white/70">
          {selected ? 'Enter your 4-digit passcode to continue.' : 'Choose the account you want to use.'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="flex-1 overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-5"
          >
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Accounts</p>
            <div className="space-y-2">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelected(user)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-white p-4 text-left transition-all active:scale-[0.98] hover:border-primary/40"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-2xl">{user.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  </div>
                  {user.isAdmin && (
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-700">ADMIN</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
              <ShieldCheck size={16} className="shrink-0 text-primary" />
              Prototype sign-in — every account uses the passcode {DEMO_PASSCODE}.
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="flex flex-1 flex-col rounded-t-3xl bg-white px-6 pb-8 pt-6"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-2xl">{selected.avatar}</div>
              <div>
                <p className="font-bold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.phone}</p>
              </div>
            </div>

            <div className="mt-7 flex justify-center gap-4">
              {[0, 1, 2, 3].map(index => (
                <motion.div
                  key={index}
                  animate={{ scale: pin.length === index + 1 ? [1, 1.25, 1] : 1 }}
                  className={`h-4 w-4 rounded-full ${index < pin.length ? 'bg-primary' : 'bg-secondary border border-border'}`}
                />
              ))}
            </div>

            <p className="mt-3 h-5 text-center text-xs font-bold text-destructive">{error}</p>

            <div className="mx-auto mt-4 grid w-full max-w-[280px] grid-cols-3 gap-3">
              {KEYS.map((key, index) => key === '' ? <div key={index} /> : (
                <button
                  key={index}
                  onClick={() => press(key)}
                  className="grid h-16 place-items-center rounded-2xl bg-secondary text-xl font-black text-foreground active:scale-95 transition-transform"
                >
                  {key === 'del' ? <Delete size={20} /> : key}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPin(DEMO_PASSCODE); submit(DEMO_PASSCODE); }}
              className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-xs font-black text-primary"
            >
              <Fingerprint size={16} /> Use demo passcode
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
