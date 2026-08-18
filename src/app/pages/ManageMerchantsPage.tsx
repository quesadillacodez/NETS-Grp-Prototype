import { useState } from 'react';
import { Store, Plus, Pencil, Trash2, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import { DarkHeader } from '../components/DarkHeader';
import { useAppEvents } from '../utils/useAppEvents';
import {
  getMerchants,
  saveMerchant,
  deactivateMerchant,
  DEFAULT_XP_BONUS,
  DEFAULT_XP_RATE,
  type Merchant,
} from '../utils/merchantStorage';

function makeId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'merchant'}-${Date.now().toString(36)}`;
}

export function ManageMerchantsPage() {
  const navigate = useNavigate();

  const [merchants, setMerchants] = useState<Merchant[]>(() => getMerchants());
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [xpRate, setXpRate] = useState(String(DEFAULT_XP_RATE));
  const [xpBonus, setXpBonus] = useState(String(DEFAULT_XP_BONUS));

  useAppEvents(['merchantsUpdated'], () => setMerchants(getMerchants()));

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setName('');
    setAmount('');
    setReference('');
    setXpRate(String(DEFAULT_XP_RATE));
    setXpBonus(String(DEFAULT_XP_BONUS));
  };

  const openEdit = (merchant: Merchant) => {
    setIsNew(false);
    setEditing(merchant);
    setName(merchant.name);
    setAmount(merchant.amount.toFixed(2));
    setReference(merchant.reference ?? '');
    setXpRate(String(merchant.xpRate));
    setXpBonus(String(merchant.xpBonus));
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const parsedAmount = parseFloat(amount);

    if (!trimmedName) {
      toast.error('Please enter a merchant name');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    const parsedRate = parseFloat(xpRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      toast.error('XP rate must be greater than 0');
      return;
    }
    const parsedBonus = parseFloat(xpBonus);
    if (isNaN(parsedBonus) || parsedBonus < 1) {
      toast.error('Bonus multiplier must be at least 1');
      return;
    }

    saveMerchant({
      id: editing ? editing.id : makeId(trimmedName),
      name: trimmedName,
      amount: parsedAmount,
      reference: reference.trim() || undefined,
      xpRate: parsedRate,
      xpBonus: parsedBonus,
    });

    toast.success(editing ? 'Merchant updated' : 'Merchant added');
    closeForm();
  };

  const handleRemove = (merchant: Merchant) => {
    deactivateMerchant(merchant.id);
    toast.success(`${merchant.name} removed`);
  };

  const showForm = isNew || editing !== null;

  // Mirrors calculateTransactionXP so the admin sees the exact figure a
  // customer will be awarded before saving.
  const previewAmount = parseFloat(amount);
  const previewRate = parseFloat(xpRate);
  const previewBonus = parseFloat(xpBonus);
  const previewXP =
    previewAmount > 0 && previewRate > 0 && previewBonus >= 1
      ? Math.max(1, Math.round(previewAmount * previewRate * previewBonus))
      : null;

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Manage Merchants" onBack={() => navigate('/profile')} bottomGap="mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-white" />
            <div>
              <p className="text-white font-semibold text-sm">Merchant List</p>
              <p className="text-white/80 text-xs">
                {merchants.length} merchant{merchants.length === 1 ? '' : 's'} available to scan
              </p>
            </div>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-6 overflow-y-auto pb-24">
        {!showForm && (
          <button
            onClick={openNew}
            className="w-full mb-6 p-4 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center gap-2 text-primary font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Merchant
          </button>
        )}

        {showForm && (
          <div className="mb-6 bg-white rounded-2xl p-4 border-2 border-primary">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">
                {editing ? 'Edit Merchant' : 'New Merchant'}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="text-xs text-muted-foreground mb-2 block">Merchant Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kopitiam"
              className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none"
            />

            <label className="text-xs text-muted-foreground mb-2 block">Amount (SGD)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none"
            />

            <label className="text-xs text-muted-foreground mb-2 block">Reference (optional)</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Set A"
              className="w-full mb-4 px-4 py-3 rounded-xl bg-secondary text-foreground outline-none"
            />

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">XP per $1</label>
                <input
                  value={xpRate}
                  onChange={(e) => setXpRate(e.target.value)}
                  inputMode="decimal"
                  placeholder={String(DEFAULT_XP_RATE)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Bonus multiplier</label>
                <input
                  value={xpBonus}
                  onChange={(e) => setXpBonus(e.target.value)}
                  inputMode="decimal"
                  placeholder={String(DEFAULT_XP_BONUS)}
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground outline-none"
                />
              </div>
            </div>

            {previewXP !== null && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-foreground">
                  A ${parseFloat(amount).toFixed(2)} payment here earns{' '}
                  <span className="font-bold">{previewXP.toLocaleString()} XP</span>
                  {parseFloat(xpBonus) > 1 ? ` (${parseFloat(xpBonus)}x bonus applied)` : ''}
                </p>
              </div>
            )}

            <button
              onClick={handleSave}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
            >
              {editing ? 'Save Changes' : 'Add Merchant'}
            </button>
          </div>
        )}

        {merchants.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-foreground">No merchants yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one above so it can be scanned on the pay screen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {merchants.map((merchant) => (
              <div
                key={merchant.id}
                className="p-4 rounded-2xl border-2 border-border bg-white flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{merchant.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${merchant.amount.toFixed(2)}
                    {merchant.reference ? ` · ${merchant.reference}` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {merchant.xpRate} XP / $1
                    </span>
                    {merchant.xpBonus > 1 && (
                      <span className="rounded-full bg-[#fff2bd] px-2 py-0.5 text-[10px] font-bold text-[#7a5a00]">
                        {merchant.xpBonus}x bonus
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => openEdit(merchant)}
                    className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
                  >
                    <Pencil className="w-4 h-4 text-foreground" />
                  </button>
                  <button
                    onClick={() => handleRemove(merchant)}
                    className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}
