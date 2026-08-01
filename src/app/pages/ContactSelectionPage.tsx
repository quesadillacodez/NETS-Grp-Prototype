import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { getCurrentUser, getPayableUsers } from '../utils/userStorage';
import { DarkHeader } from '../components/DarkHeader';
import { useRequiredState } from '../utils/useRequiredState';
import type { PaymentFlowContext } from '../utils/paymentFlow';

interface ContactSelectionState extends Record<string, unknown>, PaymentFlowContext {
  amount: number;
  paxCount: number;
  merchantName: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
}

export function ContactSelectionPage() {
  const navigate = useNavigate();
  const state = useRequiredState<ContactSelectionState>(['amount', 'paxCount', 'merchantName'], '/scan');
  const { amount, paxCount, merchantName } = state ?? { amount: 0, paxCount: 0, merchantName: '' };

  const [searchQuery, setSearchQuery] = useState('');
  const currentUser = getCurrentUser();
  const contacts = getPayableUsers()
    .filter(user => user.id !== currentUser.id)
    .map((user): Contact => ({ id: user.id, name: user.name, phone: user.phone, avatar: user.avatar }));
  const plannedIds = state?.participantUserIds?.filter(id => contacts.some(contact => contact.id === id)) ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(() => plannedIds.slice(0, Math.max(0, paxCount - 1)));

  if (!state) return null;

  const filtered = contacts.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else if (selectedIds.length < paxCount - 1) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectedCount = selectedIds.length + 1;
  const isReady = selectedCount === paxCount;
  const selectedContactObjects = selectedIds.map((id) => contacts.find((c) => c.id === id));

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader
        title="Select Contacts"
        onBack={() => navigate('/split-setup', { state })}
        bottomGap="mb-6"
      >
        <p className="text-white/80 text-sm text-center mb-4">
          {selectedCount} of {paxCount} selected
        </p>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl shadow-md outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
      </DarkHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 pb-36">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">From Your Contacts</p>

        <div className="space-y-2">
          {filtered.map((contact) => {
            const isSelected = selectedIds.includes(contact.id);
            const canSelect = selectedIds.length < paxCount - 1 || isSelected;

            return (
              <button
                key={contact.id}
                onClick={() => canSelect && toggle(contact.id)}
                disabled={!canSelect}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary'
                    : canSelect
                    ? 'bg-secondary hover:bg-secondary/80'
                    : 'bg-secondary/50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl">
                    {contact.avatar}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-border space-y-3">
        <button
          onClick={() => navigate('/bill-breakdown', { state: { ...state, amount, paxCount, merchantName, selectedContacts: selectedContactObjects } })}
          disabled={!isReady}
          className={`w-full py-4 rounded-2xl font-semibold shadow-lg transition-all ${
            isReady ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-secondary text-muted-foreground cursor-not-allowed'
          }`}
        >
          Equal Split ({selectedCount}/{paxCount})
        </button>
        <button
          onClick={() => navigate('/custom-split', { state: { ...state, amount, paxCount, merchantName, selectedContacts: selectedContactObjects } })}
          disabled={!isReady}
          className={`w-full py-3 rounded-2xl font-semibold border-2 transition-all ${
            isReady ? 'border-primary text-primary bg-white hover:bg-primary/5' : 'border-border text-muted-foreground bg-secondary cursor-not-allowed'
          }`}
        >
          Custom Split
        </button>
      </div>
    </div>
  );
}
