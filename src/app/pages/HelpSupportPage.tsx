import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Check, ChevronDown, Info, LifeBuoy, Mail, MessageSquare, Phone, ShieldAlert,
} from 'lucide-react';
import { DarkHeader } from '../components/DarkHeader';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How do I split a bill?',
    answer: 'Tap Scan on the bottom bar, choose or scan a merchant, then pick Split. Select who was there, confirm each share, and pay. Everyone else gets a reminder with their amount, and you can track who has repaid you under Reminders.',
  },
  {
    question: 'Someone repaid me — where does the money show up?',
    answer: 'Repayments appear in your transaction history as "Repayment Received" and are added to your wallet balance immediately. Open the transaction to see a receipt with its reference number.',
  },
  {
    question: 'How do I earn and spend XP?',
    answer: 'You earn XP on every NETS payment — 10 XP per $1 by default, with 2x at participating heartland merchants. Spend it in Rewards on wallet cashback or merchant vouchers. Cashback is credited to your balance instantly; vouchers appear in your rewards wallet with an expiry date.',
  },
  {
    question: 'My voucher expired before I used it.',
    answer: 'Vouchers show their expiry date on the voucher itself and in your redemption history. Expired vouchers can no longer be marked as used, and the XP spent is not refunded automatically — contact support if a voucher expired because of a technical fault.',
  },
  {
    question: 'I forgot my PIN.',
    answer: 'On the sign-in screen, choose "Forgot PIN". You will verify the mobile number registered to your account and then set a new 6-digit PIN. You can also change your PIN any time under Profile, Security and Privacy.',
  },
  {
    question: 'How do Hangouts work?',
    answer: 'Pick a few activity ideas, invite friends, and everyone votes for their preferred option. Once a winner is clear the host confirms the plan, and the group can pay for it as a single split bill.',
  },
];

const CONTACTS = [
  { icon: Phone, label: 'NETS Customer Care', detail: '6274 1212 · daily, 9am to 9pm' },
  { icon: Mail, label: 'Email support', detail: 'support@nets.example' },
  { icon: MessageSquare, label: 'In-app chat', detail: 'Available on weekdays, 9am to 6pm' },
];

const ISSUE_TYPES = [
  'Payment did not go through',
  'Wrong amount charged',
  'Repayment not received',
  'Voucher or XP problem',
  'Something else',
];

export function HelpSupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledReference = (location.state as { reference?: string } | null)?.reference;

  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [issueType, setIssueType] = useState(prefilledReference ? ISSUE_TYPES[0] : '');
  const [reference, setReference] = useState(prefilledReference ?? '');
  const [details, setDetails] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);

  useAppEvents(['userSwitched'], () => setCurrentUser(getCurrentUser()));

  const canSubmit = issueType !== '' && details.trim().length >= 10;

  const submit = () => {
    if (!canSubmit) return;
    // A support case has no backend to reach in the prototype, so it produces a
    // case reference the user can quote rather than pretending to send an email.
    setCaseId(`CASE-${Date.now().toString(36).toUpperCase().slice(-7)}`);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <DarkHeader title="Help & Support" onBack={() => navigate('/profile')} bottomGap="mb-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-white/20">
            <LifeBuoy size={24} className="text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">We can help, {currentUser.name.split(' ')[0]}</p>
            <p className="text-[11px] text-white/70">Answers to common questions, or report an issue below.</p>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
        <section>
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            Frequently asked
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, index) => {
              const open = openFaq === index;
              return (
                <div key={faq.question} className="overflow-hidden rounded-2xl border-2 border-border">
                  <button
                    onClick={() => setOpenFaq(open ? null : index)}
                    aria-expanded={open}
                    className="flex min-h-11 w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="flex-1 text-xs font-black text-foreground">{faq.question}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {open && (
                    <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            Report an issue
          </h2>

          {caseId ? (
            <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4" role="status" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-black text-success">
                <Check size={17} aria-hidden="true" /> Issue logged
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Your case reference is <span className="font-mono font-bold text-foreground">{caseId}</span>.
                Quote it when you contact NETS Customer Care.
              </p>
              <button
                onClick={() => { setCaseId(null); setDetails(''); setReference(''); setIssueType(''); }}
                className="mt-3 min-h-11 text-xs font-black text-primary"
              >
                Report another issue
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-border p-4">
              <label htmlFor="issue-type" className="mb-1 block text-xs font-black">What went wrong?</label>
              <select
                id="issue-type"
                value={issueType}
                onChange={event => setIssueType(event.target.value)}
                className="mb-3 w-full rounded-xl border-2 border-border bg-white px-3 py-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Choose an issue type</option>
                {ISSUE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>

              <label htmlFor="issue-reference" className="mb-1 block text-xs font-black">
                Transaction reference <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="issue-reference"
                value={reference}
                onChange={event => setReference(event.target.value)}
                placeholder="e.g. NETS2026000012"
                className="mb-3 w-full rounded-xl border-2 border-border px-4 py-3 font-mono text-xs outline-none focus:border-primary"
              />

              <label htmlFor="issue-details" className="mb-1 block text-xs font-black">What happened?</label>
              <textarea
                id="issue-details"
                rows={4}
                value={details}
                onChange={event => setDetails(event.target.value)}
                placeholder="Tell us what you expected and what happened instead."
                className="w-full resize-none rounded-xl border-2 border-border px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {details.trim().length < 10
                  ? 'Please add a little more detail (at least 10 characters).'
                  : 'Thanks — that is enough for us to look into it.'}
              </p>

              <button
                onClick={submit}
                disabled={!canSubmit}
                className="mt-3 w-full rounded-2xl bg-primary py-3.5 text-sm font-black text-white disabled:opacity-40"
              >
                Submit issue
              </button>
            </div>
          )}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Contact us</h2>
          <div className="space-y-2">
            {CONTACTS.map(contact => (
              <div key={contact.label} className="flex items-center gap-3 rounded-2xl border-2 border-border p-4">
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <contact.icon size={19} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{contact.label}</p>
                  <p className="text-xs text-muted-foreground">{contact.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-secondary p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-black text-foreground">
            <ShieldAlert size={14} className="text-destructive" aria-hidden="true" /> Think you have been scammed?
          </h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Stop all payments to the person immediately, freeze the affected payment method under
            Profile, Payment Methods, and report it to the Singapore Police Force ScamShield helpline
            on 1799.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border-2 border-border p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-black text-foreground">
            <Info size={14} className="text-primary" aria-hidden="true" /> About this app
          </h2>
          <div className="mt-2 divide-y divide-border">
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Product</span>
              <span className="text-xs font-bold text-foreground">NETS Split &amp; Pay</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Build</span>
              <span className="text-xs font-bold text-foreground">Prototype</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile/security')}
            className="mt-2 min-h-11 text-xs font-black text-primary"
          >
            Read the privacy policy and terms
          </button>
        </section>
      </div>
    </div>
  );
}
