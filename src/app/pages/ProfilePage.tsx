import { useState } from 'react';
import { ChevronRight, User, CreditCard, Bell, Lock, HelpCircle, SlidersHorizontal, Clock, Shield, Sparkles, LogOut } from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { BottomNav } from '../components/BottomNav';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { getCurrentUser, isAdminUser } from '../utils/userStorage';
import { getUnreadCount } from '../utils/notificationStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { useNavigate } from 'react-router';
import { logout } from '../utils/authStorage';
import { InstallAppCard } from '../components/InstallAppCard';

const MENU_ITEMS = [
  { icon: User,        label: 'Personal Information', description: 'Name, email and mobile number',        color: 'from-blue-500 to-blue-600',     path: '/profile/personal' },
  { icon: CreditCard,  label: 'Payment Methods',      description: 'Wallet, bank accounts and cards',       color: 'from-purple-500 to-purple-600', path: '/profile/payment-methods' },
  { icon: Bell,        label: 'Notifications',        description: 'History, filters and push settings',    color: 'from-green-500 to-green-600',   path: '/notifications' },
  { icon: Clock,       label: 'Reminder Settings',    description: 'How often friends are nudged',          color: 'from-indigo-500 to-indigo-600', path: '/reminder-settings' },
  { icon: Lock,        label: 'Security & Privacy',   description: 'Change PIN, policies and terms',        color: 'from-orange-500 to-orange-600', path: '/profile/security' },
  { icon: HelpCircle,  label: 'Help & Support',       description: 'FAQs, report an issue, contact us',     color: 'from-pink-500 to-pink-600',     path: '/profile/help' },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [unread, setUnread] = useState(0);

  useAppEvents(['userSwitched'], () => setCurrentUser(getCurrentUser()));
  useAppEvents(['notificationsUpdated', 'userSwitched', 'databaseReady'], () => {
    setUnread(getUnreadCount(getCurrentUser().id));
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-6 pt-14 pb-12">
        <div className="mb-8">
          <NETSLogo />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center text-4xl border-4 border-white/20">
            {currentUser.avatar}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{currentUser.name}</h2>
            <p className="text-white/80">{currentUser.phone}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto pb-24">
        <InstallAppCard />
        {/* NETS Wrapped — the fun, personal side of the app */}
        <button
          onClick={() => navigate('/wrapped')}
          className="relative w-full mb-5 rounded-3xl overflow-hidden text-left group"
          style={{ boxShadow: '0 10px 30px -8px rgba(168,85,247,0.5)' }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(120deg, #6366f1 0%, #a855f7 45%, #ec4899 100%)' }}
          />
          {/* decorative sparkle blobs */}
          <div className="absolute -top-6 -right-4 w-28 h-28 rounded-full bg-white/15 blur-xl" />
          <div className="absolute bottom-0 left-8 w-20 h-20 rounded-full bg-white/10 blur-lg" />
          <div className="relative p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-lg leading-tight">NETS Wrapped</span>
                <span className="text-[10px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full animate-pulse">NEW</span>
              </div>
              <p className="text-white/85 text-xs mt-0.5">Your spending story, {currentUser.name.split(' ')[0]} — tap to unwrap ✨</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Smart Spending Dashboard entry */}
        <button
          onClick={() => navigate('/dashboard')}
          className="relative w-full mb-5 rounded-3xl overflow-hidden text-left group border-2 border-border"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d2b55] to-[#1565c0]" />
          <div className="absolute -top-4 -right-2 w-24 h-24 rounded-full bg-white/10 blur-xl" />
          <div className="relative p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white font-black text-lg leading-tight">Spending Dashboard</span>
              <p className="text-white/85 text-xs mt-0.5">Smart insights, spending score, goals & budgets 📊</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <div className="space-y-3">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const showBadge = item.path === '/notifications' && unread > 0;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between gap-3 p-4 bg-secondary rounded-2xl hover:bg-secondary/80 transition-all text-left"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {showBadge && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">
                      {unread} new
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                </div>
              </button>
            );
          })}

          {isAdminUser(currentUser) && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-500/10 to-violet-600/10 border-2 border-violet-500/30 rounded-2xl mt-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-violet-700 block">Management Portal</span>
                  <span className="text-xs text-violet-600/70">Stats, rewards &amp; transactions</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-violet-500" />
            </button>
          )}

          <button
            onClick={() => navigate('/profile/demo')}
            className="w-full flex items-center justify-between gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl mt-6 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-amber-500 flex items-center justify-center">
                <SlidersHorizontal className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-amber-900 block">Demo Controls</span>
                <p className="truncate text-xs text-amber-700/80">Reset or load a presentation scenario</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
          </button>

          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="w-full flex items-center justify-between p-4 bg-secondary rounded-2xl mt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted-foreground flex items-center justify-center">
                <LogOut className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <span className="font-semibold text-foreground">Sign Out</span>
            </div>
          </button>
        </div>
      </div>

      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
    </div>
  );
}
