import { useMemo, useState } from 'react';
import { Check, Flame, Lock, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { DarkHeader } from '../components/DarkHeader';
import {
  calendarMonth,
  currentStreak,
  dayKey,
  evaluateDay,
  getQuestSignals,
  rollingWeek,
  WEEKLY_MISSION_XP_CAP,
  type QuestDay,
} from '../utils/questStorage';
import { getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-based column index, so the grid lines up with the labels above it. */
function weekdayColumn(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function DayCell({ day, selected, onSelect }: {
  day: QuestDay;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = day.missions.length;
  const done = day.completedCount;
  const state = day.isFuture ? 'future' : done === total ? 'all' : done > 0 ? 'some' : 'none';
  const background =
    state === 'all' ? 'bg-success text-white'
      : state === 'some' ? 'bg-success/20 text-success'
        : state === 'future' ? 'bg-secondary/50 text-muted-foreground/50'
          : 'bg-secondary text-muted-foreground';
  return (
    <button
      onClick={onSelect}
      disabled={day.isFuture}
      className={`relative grid aspect-square place-items-center rounded-xl text-xs font-black ${background} ${
        selected ? 'ring-2 ring-primary ring-offset-1' : ''
      } ${day.isToday ? 'outline outline-2 outline-primary/40' : ''}`}
    >
      {day.date.getDate()}
      {state === 'all' && <Check size={10} className="absolute bottom-1 right-1" />}
    </button>
  );
}

export function QuestsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [signals, setSignals] = useState(() => getQuestSignals(currentUser.id));
  const [selectedDay, setSelectedDay] = useState(() => dayKey(Date.now()));
  const [view, setView] = useState<'week' | 'month'>('week');

  useAppEvents(['transactionsUpdated', 'userSwitched', 'databaseReady', 'focus'], () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setSignals(getQuestSignals(user.id));
  });

  const week = useMemo(() => rollingWeek(signals), [signals]);
  const month = useMemo(() => calendarMonth(signals, Date.now()), [signals]);
  const days = view === 'week' ? week : month;
  const detail = useMemo(() => evaluateDay(signals, selectedDay), [signals, selectedDay]);
  const streak = useMemo(() => currentStreak(signals), [signals]);

  // The rolling week is what the calendar shows; the cap applies to the
  // Monday-anchored week the allowance is actually tracked against.
  const weekXP = week.reduce((sum, day) => sum + day.xpEarned, 0);
  const cappedWeekXP = Math.min(weekXP, WEEKLY_MISSION_XP_CAP);
  const capReached = weekXP >= WEEKLY_MISSION_XP_CAP;
  const leadingBlanks = view === 'month' && days.length > 0 ? weekdayColumn(days[0].date) : 0;

  return (
    <div className="flex h-full flex-col bg-background">
      <DarkHeader title="Daily Missions" onBack={() => navigate('/rewards')} bottomGap="mb-5" padding="pt-12 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 text-white/80">
              <Flame size={15} />
              <span className="text-[11px] font-black">Streak</span>
            </div>
            <p className="mt-1 text-3xl font-black text-white">{streak}</p>
            <p className="text-[10px] text-white/70">day{streak === 1 ? '' : 's'} in a row</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 text-white/80">
              <Target size={15} />
              <span className="text-[11px] font-black">This week</span>
            </div>
            <p className="mt-1 text-3xl font-black text-white">+{cappedWeekXP.toLocaleString()}</p>
            <p className="text-[10px] text-white/70">of {WEEKLY_MISSION_XP_CAP} mission XP</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (cappedWeekXP / WEEKLY_MISSION_XP_CAP) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-[#ffca28]"
              />
            </div>
          </div>
        </div>
      </DarkHeader>

      <main className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="mb-3 flex gap-1 rounded-xl bg-secondary p-1">
          {(['week', 'month'] as const).map(option => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={`flex-1 rounded-lg py-2 text-[11px] font-black capitalize ${
                view === option ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {option === 'week' ? 'Last 7 days' : 'This month'}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-white p-3">
          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map(label => (
              <span key={label} className="text-center text-[9px] font-black text-muted-foreground">{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlanks }).map((_, index) => <div key={`blank-${index}`} />)}
            {days.map(day => (
              <DayCell
                key={day.day}
                day={day}
                selected={day.day === selectedDay}
                onSelect={() => setSelectedDay(day.day)}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-success" /> All done</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-success/20" /> Partial</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-secondary" /> Missed</span>
          </div>
        </section>

        <div className="mb-2 mt-5 flex items-baseline justify-between">
          <h2 className="text-sm font-black">
            {detail.isToday ? 'Today' : detail.date.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
          <span className="text-[11px] font-black text-success">
            +{detail.xpEarned.toLocaleString()} XP
          </span>
        </div>

        <div className="space-y-2">
          {detail.missions.map((mission, index) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                mission.complete ? 'border-success/30 bg-success/5' : 'border-border bg-white'
              }`}
            >
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${
                mission.complete ? 'bg-success/15' : 'bg-secondary'
              }`}>
                {detail.isFuture ? <Lock size={16} className="text-muted-foreground" /> : mission.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-black">{mission.title}</p>
                  {mission.complete && <Check size={13} className="shrink-0 text-success" />}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{mission.description}</p>
                {mission.target > 1 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(mission.progress / mission.target) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full bg-success"
                    />
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-black ${mission.complete ? 'text-success' : 'text-muted-foreground'}`}>
                  +{mission.xp}
                </p>
                {mission.target > 1 && (
                  <p className="text-[9px] text-muted-foreground">{mission.progress}/{mission.target}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {capReached && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fff4e5] p-3">
            <Target size={15} className="shrink-0 text-[#b7791f]" />
            <p className="text-[11px] text-[#7a4a00]">
              You have hit this week's {WEEKLY_MISSION_XP_CAP} XP mission cap. Missions still track,
              and the allowance resets on Monday.
            </p>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Missions reset daily and are completed by real activity - paying with NETS, splitting a
          bill or opening the app. Mission XP is credited at the end of each day, up to
          {' '}{WEEKLY_MISSION_XP_CAP} XP a week so missions reward habit rather than grinding.
        </p>
      </main>
    </div>
  );
}
