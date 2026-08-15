import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BadgeCheck, Check, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import { getCurrentUser, isAdminUser, updateUserProfile } from '../utils/userStorage';
import { flushSave } from '../utils/db';
import { useAppEvents } from '../utils/useAppEvents';

const AVATARS = ['👨‍💼', '👩', '👨', '👩‍🦰', '🧑', '👵', '🧕', '👨‍🎓', '👩‍🎓', '🧑‍🍳'];

function isValidEmail(value: string): boolean {
  return value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  return /^\+?[\d\s]{8,16}$/.test(value.trim());
}

export function PersonalInformationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone);
  const [avatar, setAvatar] = useState(user.avatar);
  const [saved, setSaved] = useState(false);

  useAppEvents(['userSwitched'], () => {
    const current = getCurrentUser();
    setUser(current);
  });

  const nameError = name.trim().length < 2 ? 'Enter your full name.' : null;
  const emailError = isValidEmail(email.trim()) ? null : 'Enter a valid email address.';
  const phoneError = isValidPhone(phone) ? null : 'Enter a valid mobile number.';
  const changed = name !== user.name || email !== (user.email ?? '') || phone !== user.phone || avatar !== user.avatar;
  const canSave = changed && !nameError && !emailError && !phoneError;

  const save = async () => {
    if (!canSave) return;
    updateUserProfile(user.id, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatar,
    });
    await flushSave();
    setUser(getCurrentUser());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Personal Information" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-white/20 bg-white/15 text-3xl">
            {avatar}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{name || user.name}</p>
            <p className="flex items-center gap-1 text-xs text-white/70">
              <BadgeCheck size={13} aria-hidden="true" /> Verified NETS account
            </p>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <p className="sr-only" aria-live="polite">{saved ? 'Your details were saved.' : ''}</p>

        <section className="mb-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Profile photo</h2>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map(option => (
              <button
                key={option}
                onClick={() => setAvatar(option)}
                aria-label={`Choose avatar ${option}`}
                aria-pressed={avatar === option}
                className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${avatar === option ? 'bg-primary/15 ring-2 ring-primary' : 'bg-secondary'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1 flex items-center gap-1.5 text-xs font-black text-foreground">
              <UserIcon size={13} aria-hidden="true" /> Full name
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={event => setName(event.target.value)}
              aria-invalid={nameError !== null}
              className="w-full rounded-xl border-2 border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
            {nameError && <p className="mt-1 text-[11px] font-bold text-destructive">{nameError}</p>}
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-1 flex items-center gap-1.5 text-xs font-black text-foreground">
              <Mail size={13} aria-hidden="true" /> Email address
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={event => setEmail(event.target.value)}
              aria-invalid={emailError !== null}
              className="w-full rounded-xl border-2 border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
            {emailError && <p className="mt-1 text-[11px] font-bold text-destructive">{emailError}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">Used for statements and account recovery.</p>
          </div>

          <div>
            <label htmlFor="profile-phone" className="mb-1 flex items-center gap-1.5 text-xs font-black text-foreground">
              <Phone size={13} aria-hidden="true" /> Mobile number
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              aria-invalid={phoneError !== null}
              className="w-full rounded-xl border-2 border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
            {phoneError && <p className="mt-1 text-[11px] font-bold text-destructive">{phoneError}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              This number verifies your identity during PIN recovery.
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-secondary p-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Account</h2>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Login ID</span>
              <span className="font-mono text-xs font-bold text-foreground">{user.loginId ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Account type</span>
              <span className="text-xs font-bold text-foreground">
                {isAdminUser(user) ? 'Management' : 'Personal'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Internal ID</span>
              <span className="font-mono text-xs font-bold text-foreground">{user.id}</span>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            Your login ID can't be changed here. Contact support if you need it updated.
          </p>
        </section>

        <button
          onClick={save}
          disabled={!canSave}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-black text-white disabled:opacity-40"
        >
          {saved ? <><Check size={17} aria-hidden="true" /> Saved</> : 'Save changes'}
        </button>
        {!changed && !saved && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Edit a field to enable saving.</p>
        )}
      </div>
    </div>
  );
}
