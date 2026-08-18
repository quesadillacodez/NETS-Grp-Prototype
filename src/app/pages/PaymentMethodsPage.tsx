import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, CreditCard, Landmark, Lock, Plus, Snowflake, Star, Trash2, Unlock, Wallet, X,
} from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import {
  PAYMENT_METHOD_LABELS, addPaymentMethod, getPaymentMethods, maskAccountNumber,
  removePaymentMethod, setDefaultPaymentMethod, setPaymentMethodFrozen,
  type PaymentMethod, type PaymentMethodType,
} from '../utils/paymentMethodStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

const TYPE_ICONS: Record<PaymentMethodType, typeof Wallet> = {
  wallet: Wallet,
  bank: Building2,
  card: CreditCard,
  paynow: Landmark,
};

const ADDABLE_TYPES: PaymentMethodType[] = ['bank', 'card', 'paynow'];

export function PaymentMethodsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<PaymentMethodType>('bank');
  const [label, setLabel] = useState('');
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useAppEvents(['paymentMethodsUpdated', 'userSwitched', 'databaseReady'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setMethods(getPaymentMethods(user.id));
  });

  const masked = maskAccountNumber(number);
  const canAdd = label.trim().length > 1 && masked !== '';

  const submit = () => {
    if (!canAdd) return;
    addPaymentMethod(currentUser.id, {
      type,
      label: label.trim(),
      detail: `${PAYMENT_METHOD_LABELS[type]} ${masked}`,
    });
    setShowAdd(false);
    setLabel('');
    setNumber('');
    setMessage(`${label.trim()} added.`);
  };

  const remove = (method: PaymentMethod) => {
    const result = removePaymentMethod(currentUser.id, method.id);
    setMessage(result.removed ? `${method.label} removed.` : result.reason ?? 'Could not remove that method.');
  };

  const toggleFreeze = (method: PaymentMethod) => {
    setPaymentMethodFrozen(currentUser.id, method.id, !method.frozen);
    setMessage(method.frozen ? `${method.label} unfrozen.` : `${method.label} frozen — it can't be used to pay.`);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Payment Methods" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <p className="text-xs text-white/70">Linked methods</p>
          <p className="text-3xl font-black text-white">{methods.length}</p>
          <p className="mt-1 text-[11px] text-white/70">
            Your default method funds top-ups and NETS payments.
          </p>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <p className="sr-only" aria-live="polite">{message ?? ''}</p>
        {message && (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-secondary p-3">
            <p className="text-xs text-foreground">{message}</p>
            <button onClick={() => setMessage(null)} aria-label="Dismiss message" className="text-muted-foreground">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="space-y-3">
          {methods.map(method => {
            const Icon = TYPE_ICONS[method.type];
            return (
              <div
                key={method.id}
                className={`rounded-2xl border-2 p-4 ${method.frozen ? 'border-border bg-secondary/50' : 'border-border bg-white'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl ${method.frozen ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary'}`}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-black text-foreground">{method.label}</p>
                      {method.isDefault && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase text-white">
                          Default
                        </span>
                      )}
                      {method.frozen && (
                        <span className="rounded-full bg-slate-300 px-2 py-0.5 text-[9px] font-black uppercase text-slate-700">
                          Frozen
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{method.detail}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!method.isDefault && !method.frozen && (
                    <button
                      onClick={() => { setDefaultPaymentMethod(currentUser.id, method.id); setMessage(`${method.label} is now your default.`); }}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-bold text-foreground"
                    >
                      <Star size={13} aria-hidden="true" /> Make default
                    </button>
                  )}
                  <button
                    onClick={() => toggleFreeze(method)}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-bold text-foreground"
                  >
                    {method.frozen
                      ? <><Unlock size={13} aria-hidden="true" /> Unfreeze</>
                      : <><Snowflake size={13} aria-hidden="true" /> Freeze</>}
                  </button>
                  {method.type !== 'wallet' && (
                    <button
                      onClick={() => remove(method)}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl bg-destructive/10 px-3 text-xs font-bold text-destructive"
                    >
                      <Trash2 size={13} aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showAdd ? (
          <section className="mt-4 rounded-2xl border-2 border-primary/25 bg-primary/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-foreground">Add a payment method</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Cancel adding a payment method">
                <X size={16} className="text-muted-foreground" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {ADDABLE_TYPES.map(option => (
                <button
                  key={option}
                  onClick={() => setType(option)}
                  aria-pressed={type === option}
                  className={`min-h-11 rounded-xl px-2 text-xs font-bold ${type === option ? 'bg-primary text-white' : 'bg-white text-muted-foreground'}`}
                >
                  {PAYMENT_METHOD_LABELS[option]}
                </button>
              ))}
            </div>

            <label htmlFor="method-label" className="mb-1 block text-xs font-black">Display name</label>
            <input
              id="method-label"
              value={label}
              onChange={event => setLabel(event.target.value)}
              placeholder="e.g. OCBC Everyday"
              className="mb-3 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary"
            />

            <label htmlFor="method-number" className="mb-1 block text-xs font-black">Account or card number</label>
            <input
              id="method-number"
              value={number}
              inputMode="numeric"
              onChange={event => setNumber(event.target.value)}
              placeholder="Only the last 4 digits are stored"
              className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock size={12} aria-hidden="true" />
              {masked ? `Will be saved as ${PAYMENT_METHOD_LABELS[type]} ${masked}` : 'Enter at least 4 digits.'}
            </p>

            <button
              onClick={submit}
              disabled={!canAdd}
              className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
              Add method
            </button>
          </section>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 py-4 text-sm font-black text-primary"
          >
            <Plus size={17} aria-hidden="true" /> Add payment method
          </button>
        )}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          This prototype stores only a masked last-4 reference locally. A production wallet would
          tokenise the card with the issuer and never hold the number itself.
        </p>
      </div>
    </div>
  );
}
