import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Snowflake, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  CARD_BALANCE_LIMIT, loadCard, setCardFrozen, unloadCard, type Card,
} from '../utils/cardStorage';
import { BottomSheet } from './BottomSheet';

const QUICK_AMOUNTS = [10, 20, 50, 100];

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What a card can do, on the card itself rather than buried in settings: load
 * it from the wallet, take the money back, or freeze it.
 *
 * Both transfers go through `cardStorage`, which is where the limits live — the
 * sheet asks for a move and reports what it is told, so the buttons can never
 * move money the rules would refuse.
 */
export function CardSheet({ card, walletBalance, onClose }: {
  card: Card;
  walletBalance: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'load' | 'unload' | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const move = () => {
    const result = mode === 'load'
      ? loadCard(card.userId, card.id, value)
      : unloadCard(card.userId, card.id, value);

    if (!result.ok) { setError(result.reason ?? 'That transfer could not be completed.'); return; }
    setError(null);
    setDone(mode === 'load'
      ? `${money(result.moved)} loaded onto your ${card.meta.label}.`
      : `${money(result.moved)} returned to your wallet.`);
    setAmount('');
    setMode(null);
  };

  const freeze = () => {
    const result = setCardFrozen(card.userId, card.id, !card.frozen);
    if (!result.ok) { setError(result.reason ?? null); return; }
    setError(null);
    setDone(card.frozen ? 'Card unfrozen. It can be used again.' : 'Card frozen. Nothing can be moved until you unfreeze it.');
  };

  const startMode = (next: 'load' | 'unload') => {
    setMode(mode === next ? null : next);
    setAmount('');
    setError(null);
    setDone(null);
  };

  return (
    <BottomSheet label={`${card.meta.label} details`} onClose={onClose}>
      <div className="px-5 pb-8 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-foreground">{card.meta.label}</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ···· {card.lastFour} · {card.meta.purpose}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close card details"
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-secondary"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-secondary p-3">
            <p className="text-[11px] text-muted-foreground">
              {card.meta.holdsOwnBalance ? 'On this card' : 'Wallet balance'}
            </p>
            <p className="text-2xl font-black text-foreground">{money(card.balance)}</p>
            {card.meta.holdsOwnBalance && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Holds up to {money(CARD_BALANCE_LIMIT)}. Loading it moves money out of your wallet;
                it is still yours until you spend it.
              </p>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{card.meta.acceptedAt}</p>

          {done && (
            <p role="status" className="mt-3 rounded-xl bg-success/10 p-2.5 text-[11px] font-bold text-success">
              {done}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-2.5 text-[11px] font-bold text-destructive">
              {error}
            </p>
          )}

          {card.meta.holdsOwnBalance ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => startMode('load')}
                  aria-pressed={mode === 'load'}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-black ${mode === 'load' ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}
                >
                  <ArrowDownToLine size={14} aria-hidden="true" /> Add money
                </button>
                <button
                  onClick={() => startMode('unload')}
                  aria-pressed={mode === 'unload'}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-black ${mode === 'unload' ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}
                >
                  <ArrowUpFromLine size={14} aria-hidden="true" /> Move to wallet
                </button>
              </div>

              {mode && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    {mode === 'load'
                      ? `From your wallet — ${money(walletBalance)} available`
                      : `From this card — ${money(card.balance)} on it`}
                  </p>
                  <div className="mb-2 grid grid-cols-4 gap-1.5">
                    {QUICK_AMOUNTS.map(quick => (
                      <button
                        key={quick}
                        onClick={() => { setAmount(String(quick)); setError(null); }}
                        className={`min-h-11 rounded-xl text-xs font-black ${amount === String(quick) ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}
                      >
                        ${quick}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={amount}
                    onChange={event => { setAmount(event.target.value); setError(null); }}
                    placeholder="Custom amount"
                    aria-label="Amount"
                    className="mb-2 min-h-11 w-full rounded-xl border-2 border-border px-3 text-xs outline-none focus:border-primary"
                  />
                  <button
                    onClick={move}
                    disabled={!valid}
                    className="min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white disabled:opacity-40"
                  >
                    {mode === 'load' ? 'Load' : 'Move'} {valid ? money(value) : ''}
                  </button>
                </div>
              )}

              <button
                onClick={freeze}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-xs font-black text-foreground"
              >
                <Snowflake size={14} aria-hidden="true" />
                {card.frozen ? 'Unfreeze card' : 'Freeze card'}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/top-up')}
              className="mt-4 min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white"
            >
              Top up your wallet
            </button>
          )}
      </div>
    </BottomSheet>
  );
}
