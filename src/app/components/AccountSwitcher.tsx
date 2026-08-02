import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { getAllUsers, getCurrentUser, switchUser } from '../utils/userStorage';
import { setSessionUser } from '../utils/authStorage';
import { motion, AnimatePresence } from 'motion/react';

interface AccountSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSwitcher({ isOpen, onClose }: AccountSwitcherProps) {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [allUsers] = useState(getAllUsers());

  const handleSwitch = (userId: string) => {
    switchUser(userId);
    const user = getCurrentUser();
    setSessionUser(user);
    setCurrentUser(user);
    onClose();

    setTimeout(() => window.dispatchEvent(new CustomEvent('userSwitched')), 50);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl z-50 max-w-sm mx-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">Switch Account</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {allUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSwitch(user.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      user.id === currentUser.id
                        ? 'bg-gradient-to-r from-primary/10 to-accent/10 border-primary shadow-md'
                        : 'bg-white border-border hover:border-primary/30 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl">
                        {user.avatar}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.phone}</p>
                      </div>
                    </div>
                    {user.id === currentUser.id && (
                      <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                Switch between accounts to view different reminders and transactions
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
