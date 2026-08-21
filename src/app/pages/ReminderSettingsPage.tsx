import { useState } from 'react';
import { Clock, Save } from 'lucide-react';
import { useNavigate } from 'react-router';
import { getCurrentUser, updateUserReminderSettings } from '../utils/userStorage';
import type { ReminderFrequency } from '../utils/userStorage';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
import { DarkHeader } from '../components/DarkHeader';

const FREQUENCY_OPTIONS: { value: ReminderFrequency; label: string; description: string }[] = [
  { value: 'hourly',  label: 'Every Hour',        description: 'Remind me every hour about pending payments' },
  { value: '3hours',  label: 'Every 3 Hours',      description: 'Remind me every 3 hours' },
  { value: '5hours',  label: 'Every 5 Hours',      description: 'Remind me every 5 hours' },
  { value: '12hours', label: 'Every 12 Hours',     description: 'Remind me twice a day' },
  { value: 'daily',   label: 'Every 24 Hours',     description: 'Remind me once a day to pay my debts (recommended)' },
  { value: '48hours', label: 'Every 48 Hours',     description: 'Remind me every 2 days' },
  { value: 'weekly',  label: 'Weekly',             description: 'Remind me once a week' },
  { value: 'custom',  label: 'Custom Interval',    description: 'Set my own reminder interval' },
];

export function ReminderSettingsPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [autoEnabled, setAutoEnabled] = useState(currentUser.autoRemindersEnabled !== false);
  const [frequency, setFrequency] = useState<ReminderFrequency>(currentUser.reminderFrequency || 'daily');
  const [customHours, setCustomHours] = useState(currentUser.customReminderHours || 0);
  const [customMinutes, setCustomMinutes] = useState(currentUser.customReminderMinutes || 0);

  const handleSave = () => {
    if (frequency === 'custom' && customHours === 0 && customMinutes === 0) {
      toast.error('Please set a custom interval');
      return;
    }

    updateUserReminderSettings(currentUser.id, {
      reminderFrequency: frequency,
      autoRemindersEnabled: autoEnabled,
      customReminderHours: customHours,
      customReminderMinutes: customMinutes,
    });

    toast.success('Reminder settings saved!');
    window.dispatchEvent(new CustomEvent('reminderSettingsUpdated'));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <DarkHeader title="Reminder Settings" onBack={() => navigate('/profile')} bottomGap="mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-white" />
            <div>
              <p className="text-white font-semibold text-sm">Auto Reminders</p>
              <p className="text-white/80 text-xs">Remind yourself to pay back your debts</p>
            </div>
          </div>
        </div>
      </DarkHeader>

      <div className="flex-1 px-6 py-6 overflow-y-auto pb-24">
        <div className="mb-6">
          <div className="flex items-center justify-between p-4 bg-secondary rounded-2xl">
            <div>
              <p className="font-semibold text-foreground">Enable Auto Reminders</p>
              <p className="text-xs text-muted-foreground mt-1">Get automatic reminders to pay back your debts</p>
            </div>
            <button
              onClick={() => setAutoEnabled(!autoEnabled)}
              className={`relative w-14 h-8 rounded-full transition-colors ${autoEnabled ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${autoEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Reminder Frequency</h3>
          <div className="space-y-3">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFrequency(opt.value)}
                disabled={!autoEnabled}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                  frequency === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-white'
                } ${!autoEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                  </div>
                  {frequency === opt.value && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {frequency === 'custom' && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Set Custom Interval</h3>
            <div className="bg-white rounded-2xl p-4 border-2 border-primary">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Hours</label>
                  <input
                    type="number"
                    min="0" max="23"
                    value={customHours}
                    onChange={(e) => setCustomHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-3 bg-secondary rounded-xl border-2 border-border focus:border-primary outline-none text-foreground font-bold text-center text-lg"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Minutes</label>
                  <input
                    type="number"
                    min="0" max="59"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-3 bg-secondary rounded-xl border-2 border-border focus:border-primary outline-none text-foreground font-bold text-center text-lg"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {customHours === 0 && customMinutes === 0
                  ? 'Reminders will be sent based on every interval you set'
                  : <>
                      Reminders will be sent every{' '}
                      {customHours > 0 && `${customHours} hour${customHours > 1 ? 's' : ''}`}
                      {customHours > 0 && customMinutes > 0 && ' and '}
                      {customMinutes > 0 && `${customMinutes} minute${customMinutes > 1 ? 's' : ''}`}
                    </>}
              </p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
          <p className="text-sm text-blue-900 font-semibold mb-2">How it works</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• You'll receive automatic reminders about payments YOU owe to others</li>
            <li>• Notifications appear in your own notification popup</li>
            <li>• Reminders are sent during active hours (8 AM - 10 PM)</li>
            <li>• Set your preferred frequency: hourly, daily, or custom interval</li>
            <li>• You can disable auto-reminders and pay on your own schedule</li>
          </ul>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-border">
        <button onClick={handleSave} className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Save Settings
        </button>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
