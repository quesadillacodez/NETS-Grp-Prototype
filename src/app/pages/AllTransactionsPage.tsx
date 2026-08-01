import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { getAllTransactions } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import { DarkHeader } from '../components/DarkHeader';
import { useAppEvents } from '../utils/useAppEvents';

export function AllTransactionsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [transactions, setTransactions] = useState(getAllTransactions(currentUser.id));

  useAppEvents(['transactionsUpdated', 'userSwitched', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setTransactions(getAllTransactions(user.id));
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="All Transactions" onBack={() => navigate('/')} bottomGap="mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
          <p className="text-white/80 text-sm mb-1">Total Transactions</p>
          <h2 className="text-5xl font-bold text-white">{transactions.length}</h2>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-6 overflow-y-auto bg-gradient-to-b from-white to-gray-50">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
              <ArrowUpRight className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-2">Start by scanning a QR code</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-border transition-all hover:shadow-lg hover:border-primary/30 hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    {tx.amount > 0 ? (
                      <ArrowDownLeft className="w-5 h-5 text-success" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{tx.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.amount > 0 ? 'Paid you back' : 'You paid'} • {tx.date}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${tx.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                    {tx.amount > 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
