import { useState } from 'react';
import { ChevronRight, User, CreditCard, Bell, Lock, HelpCircle, Users, Trash2, Clock, Database, Shield, Sparkles, LogOut } from 'lucide-react';
import { NETSLogo } from '../components/NETSLogo';
import { BottomNav } from '../components/BottomNav';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { getCurrentUser, isAdminUser } from '../utils/userStorage';
import { markUserClearedFresh, flushSave, resetDatabase } from '../utils/db';
import { seedTestReminders } from '../utils/seedTestData';
import { useAppEvents } from '../utils/useAppEvents';
import { useNavigate } from 'react-router';
import { logout } from '../utils/authStorage';

const MENU_ITEMS = [
  { icon: User,        label: 'Personal Information', color: 'from-blue-500 to-blue-600',   path: null },
  { icon: CreditCard,  label: 'Payment Methods',      color: 'from-purple-500 to-purple-600', path: null },
  { icon: Bell,        label: 'Notifications',         color: 'from-green-500 to-green-600',  path: null },
  { icon: Clock,       label: 'Reminder Settings',    color: 'from-indigo-500 to-indigo-600', path: '/reminder-settings' },
  { icon: Lock,        label: 'Security & Privacy',   color: 'from-orange-500 to-orange-600', path: null },
  { icon: HelpCircle,  label: 'Help & Support',       color: 'from-pink-500 to-pink-600',    path: null },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  useAppEvents(['userSwitched'], () => setCurrentUser(getCurrentUser()));

  const handleClearData = async () => {
    if (!confirm('Reset all prototype data, including transactions, plans, rewards, reminders, budgets, merchants and admin catalogue changes?\n\nThis cannot be undone.')) return;
    resetDatabase();
    markUserClearedFresh();
    await flushSave();
    alert('✓ All data cleared! Everyone starts fresh — $2,500 balance, 0 transactions, 0 redemptions.');
    window.location.reload();
  };

  const handleSeedTestData = () => {
    const isAlex = currentUser.name === 'Alex Chen';
    if (!isAlex) alert(`Note: Test data is created for Alex Chen's account.\n\nYou're currently: ${currentUser.name}\n\nSwitch to Alex Chen to see results.`);
    if (!confirm('This will add test data. For best results, clear all data first. Continue?')) return;
    seedTestReminders();
    alert(`✓ Test data added!\n\n${isAlex ? 'You should now see:\n- Shared Bills: Hawker Haven ($156)\n- Insights: Sarah, Mike, Jenny' : 'Switch to Alex Chen to see the test data.'}`);
    window.location.reload();
  };

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
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                className="w-full flex items-center justify-between p-4 bg-secondary rounded-2xl hover:bg-secondary/80 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
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

          <button onClick={() => setShowAccountSwitcher(true)} className="w-full flex items-center justify-between p-4 bg-primary/10 rounded-2xl mt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-primary">Switch Account</span>
            </div>
            <ChevronRight className="w-5 h-5 text-primary" />
          </button>

          <button onClick={handleSeedTestData} className="w-full flex items-center justify-between p-4 bg-success/10 rounded-2xl mt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-success">Add Test Data</span>
            </div>
          </button>

          <button onClick={handleClearData} className="w-full flex items-center justify-between p-4 bg-destructive/10 rounded-2xl mt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-destructive">Clear All Data</span>
            </div>
          </button>

          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="w-full flex items-center justify-between p-4 bg-secondary rounded-2xl mt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted-foreground flex items-center justify-center">
                <LogOut className="w-6 h-6 text-white" />
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
