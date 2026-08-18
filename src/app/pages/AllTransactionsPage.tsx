import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  describeTransaction, filterTransactions, getAllTransactions, type Transaction,
} from '../utils/transactionStorage';
import { TRANSACTION_TYPE_META, TRANSACTION_TYPES, type TransactionType } from '../utils/transactionModel';
import { getCurrentUser } from '../utils/userStorage';
import { DarkHeader } from '../components/DarkHeader';
import { useAppEvents } from '../utils/useAppEvents';

type Period = 'all' | 'month' | '30days';

const PERIOD_LABELS: Record<Period, string> = {
  all: 'All time',
  month: 'This month',
  '30days': 'Last 30 days',
};

function periodStart(period: Period): number | undefined {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (period === '30days') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return undefined;
}

export function AllTransactionsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [transactions, setTransactions] = useState<Transaction[]>(() => getAllTransactions(currentUser.id));
  const [term, setTerm] = useState('');
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [showFilters, setShowFilters] = useState(false);

  useAppEvents(['transactionsUpdated', 'userSwitched', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setTransactions(getAllTransactions(user.id));
  });

  const visible = useMemo(
    () => filterTransactions(transactions, { term, types, from: periodStart(period) }),
    [transactions, term, types, period],
  );

  const totals = useMemo(() => {
    let inbound = 0, outbound = 0;
    for (const tx of visible) {
      if (tx.amount >= 0) inbound += tx.amount;
      else outbound += Math.abs(tx.amount);
    }
    return { inbound, outbound };
  }, [visible]);

  const toggleType = (type: TransactionType) => {
    setTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);
  };

  const filtersActive = types.length > 0 || period !== 'all' || term.trim() !== '';
  const clearFilters = () => { setTypes([]); setPeriod('all'); setTerm(''); };

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Transaction History" onBack={() => navigate('/')} bottomGap="mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-white/70 text-xs">Money in</p>
            <p className="text-xl font-black text-white">${totals.inbound.toFixed(2)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <p className="text-white/70 text-xs">Money out</p>
            <p className="text-xl font-black text-white">${totals.outbound.toFixed(2)}</p>
          </div>
        </div>
      </DarkHeader>

      <div className="border-b border-border bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <Search size={16} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <input
              value={term}
              onChange={event => setTerm(event.target.value)}
              placeholder="Search name, category or reference"
              aria-label="Search transactions"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            {term && (
              <button
                onClick={() => setTerm('')}
                aria-label="Clear search"
                className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-white text-muted-foreground"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(current => !current)}
            aria-label="Filter transactions"
            aria-expanded={showFilters}
            className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl ${filtersActive ? 'bg-primary text-white' : 'bg-secondary text-foreground'}`}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
          </button>
        </div>

        {showFilters && (
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {TRANSACTION_TYPES.map(type => {
                const selected = types.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    aria-pressed={selected}
                    className={`rounded-full px-3 py-2 text-[11px] font-bold ${selected ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {TRANSACTION_TYPE_META[type].label}
                  </button>
                );
              })}
            </div>

            <p className="mb-1.5 mt-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Period</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PERIOD_LABELS) as Period[]).map(key => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  aria-pressed={period === key}
                  className={`rounded-full px-3 py-2 text-[11px] font-bold ${period === key ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
                >
                  {PERIOD_LABELS[key]}
                </button>
              ))}
            </div>

            {filtersActive && (
              <button onClick={clearFilters} className="mt-3 text-xs font-black text-primary">
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50 px-5 py-4">
        <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
          {visible.length} of {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
        </p>

        {visible.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-secondary">
              <Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground">
              {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {transactions.length === 0 ? 'Start by scanning a QR code' : 'Try a different search term or period'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((tx) => {
              const described = describeTransaction(tx);
              return (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-border bg-white p-4 text-left transition-all hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                      {described.isIncoming
                        ? <ArrowDownLeft className="h-5 w-5 text-success" aria-hidden="true" />
                        : <ArrowUpRight className="h-5 w-5 text-destructive" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{tx.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {described.meta.activity} · {tx.date}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {described.meta.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 pl-2">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${described.isIncoming ? 'text-success' : 'text-destructive'}`}>
                        {described.signedAmount}
                      </p>
                      <p className="text-xs text-muted-foreground">{described.categoryLabel}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
