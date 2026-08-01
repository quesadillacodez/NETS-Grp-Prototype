import { useNavigate } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import { useRequiredState } from '../utils/useRequiredState';
import { splitAmountExactly, type PaymentFlowContext, type SplitParticipant } from '../utils/paymentFlow';

interface SelectedContact { id: string; name: string; avatar: string; phone: string }

interface BillBreakdownState extends Record<string, unknown>, PaymentFlowContext {
  amount: number;
  paxCount: number;
  selectedContacts: SelectedContact[];
  merchantName: string;
  customSplits?: SplitParticipant[] | null;
}

export function BillBreakdownPage() {
  const navigate = useNavigate();
  const state = useRequiredState<BillBreakdownState>(['amount', 'paxCount', 'selectedContacts', 'merchantName'], '/scan');
  const { amount, paxCount, selectedContacts, merchantName, customSplits } = state ?? {
    amount: 0,
    paxCount: 0,
    selectedContacts: [],
    merchantName: '',
    customSplits: null,
  };

  if (!state) return null;

  const exactAmounts = splitAmountExactly(amount, paxCount);
  const amountPerPerson = (amount / paxCount).toFixed(2);
  const isCustomSplit = !!customSplits;

  const participants: SplitParticipant[] = isCustomSplit
    ? customSplits.map(s => ({ ...s, status: s.name === 'You' ? 'host' : 'pending' }))
    : [
        { name: 'You', avatar: '😊', status: 'host', amount: exactAmounts[0] },
        ...selectedContacts.map((contact, index) => ({
          userId: contact.id,
          name: contact.name,
          avatar: contact.avatar,
          status: 'pending' as const,
          amount: exactAmounts[index + 1],
        })),
      ];

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Bill Breakdown" onBack={() => navigate(-1)}>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white/80 text-sm mb-1">Total Bill</p>
              <h2 className="text-4xl font-bold text-white">${amount.toFixed(2)}</h2>
              <p className="text-white/70 text-xs mt-1">from {merchantName}</p>
            </div>
            <div className="text-right">
              <p className="text-white/80 text-sm mb-1">Split {paxCount} ways</p>
              <p className="text-2xl font-bold text-white">${amountPerPerson}</p>
              <p className="text-white/60 text-xs">per person</p>
            </div>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
              style={{ width: `${(1 / paxCount) * 100}%` }}
            />
          </div>
          <p className="text-white/80 text-xs mt-2">You're paying the full bill</p>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <h3 className="text-sm text-muted-foreground uppercase tracking-wide mb-4">Participants</h3>

        <div className="space-y-3">
          {participants.map((p, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border-2 ${
                p.status === 'host'
                  ? 'bg-gradient-to-r from-success/10 to-green-400/10 border-success'
                  : 'bg-secondary border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl">
                    {p.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${p.amount.toFixed(2)}
                      {isCustomSplit && (
                        <span className="ml-1 text-xs text-primary">
                          ({((p.amount / amount) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  p.status === 'host' ? 'bg-blue-500/20 text-blue-700' : 'bg-warning/20 text-warning'
                }`}>
                  {p.status === 'host' ? 'You (Host)' : 'Owes You'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/20">
          <p className="text-sm text-foreground">
            <span className="font-semibold">How it works:</span> You pay the full bill (${amount.toFixed(2)}) upfront. Friends pay back their share{' '}
            {isCustomSplit ? '(custom amounts)' : '(with any rounding cent assigned to your share)'} after approval.
          </p>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-border">
        <button
          onClick={() => navigate('/payment-success', { state: { ...state, participants, amount, merchantName, customSplits } })}
          className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white rounded-2xl font-semibold shadow-lg"
        >
          Pay Full Bill & Send Requests
        </button>
      </div>
    </div>
  );
}
