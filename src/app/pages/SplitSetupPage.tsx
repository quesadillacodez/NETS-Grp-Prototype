import { useState } from 'react';
import { ChevronUp, ChevronDown, Users, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { DarkHeader } from '../components/DarkHeader';
import { useRequiredState } from '../utils/useRequiredState';
import { getCurrentUser, getPayableUsers } from '../utils/userStorage';
import type { PaymentFlowContext } from '../utils/paymentFlow';

interface SplitSetupState extends Record<string, unknown>, PaymentFlowContext {
  amount: number;
  merchantName: string;
}

export function SplitSetupPage() {
  const navigate = useNavigate();
  const state = useRequiredState<SplitSetupState>(['amount', 'merchantName'], '/scan');

  const [totalAmount, setTotalAmount] = useState<number>(state?.amount ?? 0);
  const plannedParticipants = state?.participantUserIds?.filter(id => id !== getCurrentUser().id) ?? [];
  const [paxCount, setPaxCount] = useState(() => Math.max(2, plannedParticipants.length + 1));
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  if (!state) return null;

  const merchantName = state.merchantName;
  const amountPerPerson = (totalAmount / paxCount).toFixed(2);

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Split Bill" onBack={() => navigate('/scan', { state })}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <p className="text-white/80 text-xs mb-1">Total Amount</p>

          {isEditingAmount ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">$</span>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) setTotalAmount(v);
                }}
                onBlur={() => setIsEditingAmount(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingAmount(false)}
                autoFocus
                className="text-3xl font-bold text-white bg-white/20 rounded-xl px-3 py-1 outline-none border-2 border-white/40 w-full max-w-xs"
              />
            </div>
          ) : (
            <div
              onClick={() => setIsEditingAmount(true)}
              className="cursor-pointer hover:bg-white/10 rounded-xl px-1 py-0.5 -ml-1 transition-colors group flex items-center gap-2"
            >
              <h2 className="text-3xl font-bold text-white">${totalAmount.toFixed(2)}</h2>
              <Edit2 className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            </div>
          )}

          <p className="text-white/70 text-xs mt-1">from {merchantName} · tap to edit</p>
        </div>
      </DarkHeader>

      <div className="flex-1 px-5 py-5">
        <div className="bg-secondary rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Split by number of</p>
              <p className="font-semibold text-sm text-foreground">People</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-xl p-3">
            <button
              onClick={() => setPaxCount(Math.max(2, paxCount - 1))}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <ChevronDown className="w-5 h-5 text-white" />
            </button>

            <motion.div key={paxCount} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-center">
              <p className="text-4xl font-bold text-primary">{paxCount}</p>
              <p className="text-xs text-muted-foreground">people</p>
            </motion.div>

            <button
              onClick={() => setPaxCount(Math.min(getPayableUsers().length, paxCount + 1))}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <ChevronUp className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-5 border-2 border-primary/20">
          <p className="text-xs text-muted-foreground mb-1 text-center">Amount per person</p>
          <motion.p
            key={amountPerPerson}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-3xl font-bold text-primary text-center"
          >
            ${amountPerPerson}
          </motion.p>
        </div>
      </div>

      <div className="p-5 bg-white border-t border-border">
        <button
          onClick={() => navigate('/select-contacts', { state: { ...state, amount: totalAmount, paxCount, merchantName } })}
          className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-2xl font-semibold shadow-lg"
        >
          Select Contacts
        </button>
      </div>
    </div>
  );
}
