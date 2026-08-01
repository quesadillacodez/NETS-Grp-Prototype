import { useState } from 'react';
import { ChevronLeft, DollarSign, Users, Check, Percent } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import { useRequiredState } from '../utils/useRequiredState';
import type { PaymentFlowContext, SplitParticipant } from '../utils/paymentFlow';

interface SelectedContact { id: string; name: string; avatar: string }

interface CustomSplitState extends Record<string, unknown>, PaymentFlowContext {
  amount: number;
  paxCount: number;
  selectedContacts: SelectedContact[];
  merchantName: string;
}

type Split = Pick<SplitParticipant, 'userId' | 'name' | 'avatar' | 'amount'>;

type EditMode = 'dollar' | 'percent';

export function CustomSplitPage() {
  const navigate = useNavigate();
  const state = useRequiredState<CustomSplitState>(['amount', 'paxCount', 'selectedContacts', 'merchantName'], '/scan');
  const { amount: totalAmount, paxCount, selectedContacts, merchantName } = state ?? {
    amount: 0,
    paxCount: 0,
    selectedContacts: [],
    merchantName: '',
  };

  const equalSplit = parseFloat((totalAmount / paxCount).toFixed(2));

  const [participants, setParticipants] = useState<Split[]>(() => {
    const othersTotal = parseFloat((equalSplit * selectedContacts.length).toFixed(2));
    return [
      { name: 'You', avatar: '😊', amount: parseFloat((totalAmount - othersTotal).toFixed(2)) },
      ...selectedContacts.map(c => ({ userId: c.id, name: c.name, avatar: c.avatar, amount: equalSplit })),
    ];
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editMode, setEditMode] = useState<EditMode>('dollar');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const totalSplit = parseFloat(participants.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  const remaining = parseFloat((totalAmount - totalSplit).toFixed(2));
  const isBalanced = remaining === 0;

  const updateAmount = (index: number, value: string) => {
    setEditingValue(value);
    if (value === '') { setParticipants((prev) => prev.map((p, i) => i === index ? { ...p, amount: 0 } : p)); return; }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    if (editMode === 'percent') {
      if (num > 100) { toast.error('Percentage cannot exceed 100%'); return; }
      setParticipants((prev) => prev.map((p, i) => i === index ? { ...p, amount: parseFloat(((num / 100) * totalAmount).toFixed(2)) } : p));
    } else {
      setParticipants((prev) => prev.map((p, i) => i === index ? { ...p, amount: parseFloat(num.toFixed(2)) } : p));
    }
  };

  const addDelta = (index: number, delta: number) => {
    const newAmount = parseFloat((participants[index].amount + delta).toFixed(2));
    if (newAmount < 0) return;
    const othersTotal = participants.reduce((sum, p, i) => i === index ? sum : sum + p.amount, 0);
    if (othersTotal + newAmount > totalAmount + 0.001) {
      toast.error('Amount exceeds total bill');
      return;
    }
    setParticipants((prev) => prev.map((p, i) => i === index ? { ...p, amount: newAmount } : p));
  };

  const addRemainingToFirst = () => {
    if (remaining > 0) {
      setParticipants((prev) => prev.map((p, i) => i === 0 ? { ...p, amount: parseFloat((p.amount + remaining).toFixed(2)) } : p));
    }
  };

  const stopEditing = (index: number) => {
    if (editingValue === '' || editingValue === '0') setParticipants((prev) => prev.map((p, i) => i === index ? { ...p, amount: 0 } : p));
    setEditingIndex(null);
    setEditMode('dollar');
  };

  const renderRemainingBanner = () => {
    if (isBalanced) return null;
    if (remaining > 0) {
      return (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-white/90 text-xs mb-2">
            Still <span className="font-bold">${remaining.toFixed(2)}</span> left to assign
          </p>
          <button onClick={addRemainingToFirst} className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-semibold">
            Add ${remaining.toFixed(2)} to my share
          </button>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-3 border-t border-white/20">
        <p className="text-white/90 text-xs">
          <span className="font-bold">${Math.abs(remaining).toFixed(2)} too much</span> assigned — reduce someone's amount
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-primary px-5 pt-12 pb-5">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-semibold">Custom Split</h1>
          <div className="w-9" />
        </div>

        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs mb-0.5">Total Bill</p>
              <p className="text-2xl font-bold text-white">${totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs mb-0.5">Assigned</p>
              <p className={`text-2xl font-bold ${isBalanced ? 'text-success' : remaining > 0 ? 'text-warning' : 'text-red-300'}`}>
                ${totalSplit.toFixed(2)}
              </p>
            </div>
          </div>
          {renderRemainingBanner()}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto pb-36">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Customize Each Share</p>
        </div>

        <div className="space-y-2">
          {participants.map((p, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-secondary rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl">{p.avatar}</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.amount > 0 ? ((p.amount / totalAmount) * 100).toFixed(1) : '0.0'}% of bill</p>
                  </div>
                </div>

                {editingIndex === index ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <button onMouseDown={(e) => { e.preventDefault(); setEditMode('dollar'); setEditingValue(p.amount.toString()); }} className={`p-1.5 rounded-lg transition-colors ${editMode === 'dollar' ? 'bg-primary text-white' : 'bg-white text-foreground'}`}>
                        <DollarSign className="w-3.5 h-3.5" />
                      </button>
                      <button onMouseDown={(e) => { e.preventDefault(); setEditMode('percent'); setEditingValue(((p.amount / totalAmount) * 100).toFixed(1)); }} className={`p-1.5 rounded-lg transition-colors ${editMode === 'percent' ? 'bg-primary text-white' : 'bg-white text-foreground'}`}>
                        <Percent className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-base font-bold text-foreground">{editMode === 'dollar' ? '$' : '%'}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingValue}
                        onChange={(e) => updateAmount(index, e.target.value)}
                        onFocus={(e) => { setEditingValue(editMode === 'dollar' ? p.amount.toString() : ((p.amount / totalAmount) * 100).toFixed(1)); e.target.select(); }}
                        onBlur={() => stopEditing(index)}
                        onKeyDown={(e) => e.key === 'Enter' && stopEditing(index)}
                        autoFocus
                        className="w-20 text-base font-bold text-foreground bg-white rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {editMode === 'percent' && <p className="text-xs text-muted-foreground text-right">= ${p.amount.toFixed(2)}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingIndex(index); setEditMode('dollar'); setEditingValue(p.amount.toString()); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg hover:bg-gray-50"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <span className="text-base font-bold text-foreground">{p.amount.toFixed(2)}</span>
                  </button>
                )}
              </div>

              <div className="flex gap-1.5">
                <button onClick={() => setParticipants((prev) => prev.map((p2, i) => i === index ? { ...p2, amount: parseFloat(Math.max(0, p2.amount - 5).toFixed(2)) } : p2))} className="flex-1 py-1 bg-white rounded-lg text-xs font-semibold text-foreground">-$5</button>
                <button onClick={() => setParticipants((prev) => prev.map((p2, i) => i === index ? { ...p2, amount: equalSplit } : p2))} className="flex-1 py-1 bg-white rounded-lg text-xs font-semibold text-primary">Equal</button>
                <button onClick={() => addDelta(index, 5)} className="flex-1 py-1 bg-white rounded-lg text-xs font-semibold text-foreground">+$5</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-border space-y-2">
        {!isConfirmed ? (
          <button
            onClick={() => isBalanced && setIsConfirmed(true)}
            disabled={!isBalanced}
            className={`w-full py-3.5 rounded-2xl font-semibold shadow-lg transition-all ${
              isBalanced ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isBalanced
              ? 'Confirm Custom Split'
              : remaining > 0
              ? `Assign $${remaining.toFixed(2)} more to confirm`
              : `Remove $${Math.abs(remaining).toFixed(2)} to confirm`}
          </button>
        ) : (
          <>
            <div className="bg-success/10 border-2 border-success rounded-xl p-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-success">Split Confirmed!</p>
                <p className="text-xs text-foreground">${totalAmount.toFixed(2)} across {participants.length} people</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/payment-success', {
                state: {
                  ...state,
                  participants: participants.map(participant => ({
                    ...participant,
                    status: participant.name === 'You' ? 'host' : 'pending',
                  })),
                  amount: totalAmount,
                  merchantName,
                  customSplits: participants,
                },
              })}
              className="w-full py-3.5 bg-primary text-white rounded-2xl font-semibold shadow-lg"
            >
              Pay Bill & Send Reminders
            </button>
            <button onClick={() => setIsConfirmed(false)} className="w-full py-2.5 border-2 border-border text-foreground rounded-2xl font-semibold text-sm">
              Edit Amounts
            </button>
          </>
        )}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
