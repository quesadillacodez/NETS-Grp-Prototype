import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Check, Eraser, Loader2, PlayCircle, Trash2 } from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import { clearActivityDataAndSave, loadPresentationScenarioAndSave, type DemoScenarioSummary } from '../utils/demoReset';
import { flushSave, markUserClearedFresh, resetDatabase } from '../utils/db';

type Action = 'scenario' | 'clear' | 'wipe';

const SCENARIO_CONTENTS = [
  '13 transactions for Alex Chen across four weeks — purchases, a top-up, a cashback credit and a refund',
  'One settled split bill with Sarah Tan, including her repayment',
  'One open split of $54.60 at Din Tai Fung, with Sarah and Mike each owing $18.20',
  'Two unread repayment requests and one Hangout notification',
  'A "Weekend Catch-up" Hangout that is mid-vote and not yet confirmed',
];

export function DemoControlsPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const runScenario = async () => {
    setRunning('scenario');
    setResult(null);
    const summary: DemoScenarioSummary = await loadPresentationScenarioAndSave();
    setRunning(null);
    setConfirming(null);
    setResult(
      `Presentation scenario loaded — ${summary.transactions} transactions, ${summary.reminders} split bills, ` +
      `${summary.notifications} notifications and ${summary.hangouts} Hangout.`,
    );
  };

  const runClear = async () => {
    setRunning('clear');
    setResult(null);
    await clearActivityDataAndSave();
    setRunning(null);
    setConfirming(null);
    setResult('Activity cleared. Accounts, PINs, merchants and rewards are untouched.');
  };

  const runWipe = async () => {
    setRunning('wipe');
    resetDatabase();
    markUserClearedFresh();
    await flushSave();
    window.location.reload();
  };

  const busy = running !== null;

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Demo Controls" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <p className="text-sm font-black text-white">Get the app ready to present</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/75">
            Put the prototype into a known state before a walkthrough, so every run starts from
            identical numbers and nothing from a previous rehearsal is left behind.
          </p>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <p className="sr-only" role="status" aria-live="polite">{result ?? ''}</p>

        {result && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-success/10 p-4">
            <Check size={17} className="mt-0.5 flex-shrink-0 text-success" aria-hidden="true" />
            <p className="text-xs font-bold text-success">{result}</p>
          </div>
        )}

        <section className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <PlayCircle size={18} className="text-primary" aria-hidden="true" />
            <h2 className="text-sm font-black text-foreground">Load presentation scenario</h2>
            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase text-white">
              Recommended
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Clears previous activity and seeds a repeatable demo state. Everything is dated relative
            to today, so the dashboard, Wrapped and spending trends all have real history.
          </p>
          <ul className="mt-3 space-y-1.5">
            {SCENARIO_CONTENTS.map(item => (
              <li key={item} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Check size={12} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          {confirming === 'scenario' ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={runScenario}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {running === 'scenario' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Yes, load it
              </button>
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="min-h-11 flex-1 rounded-xl border-2 border-border text-xs font-black text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setConfirming('scenario'); setResult(null); }}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-primary py-3.5 text-sm font-black text-white disabled:opacity-50"
            >
              Load presentation scenario
            </button>
          )}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-border p-4">
          <div className="flex items-center gap-2">
            <Eraser size={18} className="text-foreground" aria-hidden="true" />
            <h2 className="text-sm font-black text-foreground">Clear demo activity only</h2>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Removes transactions, split bills, reminders, notifications, Hangouts and redemptions.
            Accounts, PINs, merchants, activities and the rewards catalogue stay exactly as they are,
            so you can demonstrate the empty-state screens and then build data up live.
          </p>

          {confirming === 'clear' ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={runClear}
                disabled={busy}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {running === 'clear' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Yes, clear activity
              </button>
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="min-h-11 flex-1 rounded-xl border-2 border-border text-xs font-black text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setConfirming('clear'); setResult(null); }}
              disabled={busy}
              className="mt-3 w-full rounded-xl border-2 border-border py-3.5 text-sm font-black text-foreground disabled:opacity-50"
            >
              Clear demo activity
            </button>
          )}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-destructive/25 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-destructive" aria-hidden="true" />
            <h2 className="text-sm font-black text-destructive">Wipe everything</h2>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-destructive" aria-hidden="true" />
            Deletes all activity <strong>and</strong> the merchant, activity and rewards catalogues, then
            reloads the app. Nothing is reseeded afterwards. Only use this if you want to show a
            completely blank installation.
          </p>

          {confirming === 'wipe' ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={runWipe}
                disabled={busy}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {running === 'wipe' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Yes, wipe everything
              </button>
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="min-h-11 flex-1 rounded-xl border-2 border-border text-xs font-black text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setConfirming('wipe'); setResult(null); }}
              disabled={busy}
              className="mt-3 w-full rounded-xl border-2 border-destructive/40 py-3.5 text-sm font-black text-destructive disabled:opacity-50"
            >
              Wipe everything
            </button>
          )}
        </section>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          Data lives in this browser only. Running these controls does not affect anyone else's
          device or another browser profile.
        </p>
      </div>
    </div>
  );
}
