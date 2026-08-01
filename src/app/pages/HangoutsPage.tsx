import { type ReactNode, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, Check, ChevronLeft, Clock3, Heart, MapPin,
  Search, Sparkles, Users, Vote, WalletCards, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { BottomNav } from '../components/BottomNav';
import { NETSLogo } from '../components/NETSLogo';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  ACTIVITIES,
  confirmHangout,
  createHangout,
  getActivity,
  getHangoutsForUser,
  getHangoutVotes,
  getLeadingActivityId,
  getLeadingActivityIds,
  getSavedActivityIds,
  toggleSavedActivity,
  voteForActivity,
  type Activity,
  type ActivityCategory,
  type Hangout,
} from '../utils/hangoutStorage';
import { getAllUsers, getCurrentUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { createPaymentId } from '../utils/paymentFlow';

const CATEGORY_LABELS: Record<ActivityCategory | 'all', string> = {
  all: 'All ideas',
  food: 'Food',
  attraction: 'Explore',
  creative: 'Creative',
  active: 'Active',
};

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function ActivityCard({ activity, saved, onSave, onOpen }: {
  activity: Activity;
  saved: boolean;
  onSave: (id: number) => void;
  onOpen: (activity: Activity) => void;
}) {
  return (
    <motion.article
      layout
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
      whileTap={{ scale: 0.985 }}
    >
      <button className="relative block h-32 w-full" onClick={() => onOpen(activity)}>
        <ImageWithFallback src={activity.image} alt={activity.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-[#1e2a4a]">
          ${activity.pricePerPerson}/person
        </span>
      </button>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(activity)}>
            <h3 className="truncate text-xs font-black text-foreground">{activity.title}</h3>
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <MapPin size={10} /> {activity.location}
            </p>
          </button>
          <button
            aria-label={saved ? 'Remove from shortlist' : 'Add to shortlist'}
            onClick={() => onSave(activity.id)}
            className={`grid h-8 w-8 place-items-center rounded-xl ${saved ? 'bg-red-50 text-red-500' : 'bg-secondary text-muted-foreground'}`}
          >
            <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><Clock3 size={10} />{activity.duration}</span>
          <span className="flex items-center gap-1"><Users size={10} />{activity.groupSize}</span>
        </div>
      </div>
    </motion.article>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-50 flex items-end bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="max-h-[92%] w-full overflow-y-auto rounded-t-[28px] bg-white"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={event => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-white py-3"><div className="h-1 w-10 rounded-full bg-gray-300" /></div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ActivityDetail({ activity, saved, onSave, onPlan, onClose }: {
  activity: Activity;
  saved: boolean;
  onSave: () => void;
  onPlan: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="relative h-52">
        <ImageWithFallback src={activity.image} alt={activity.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <button onClick={onClose} className="absolute right-4 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white"><X size={18} /></button>
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <p className="text-xs font-bold text-white/75">{activity.venue}</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">{activity.title}</h2>
        </div>
      </div>
      <div className="space-y-4 p-5 pb-8">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary p-2"><p className="text-[10px] text-muted-foreground">Budget</p><p className="text-xs font-black">${activity.pricePerPerson}/pax</p></div>
          <div className="rounded-xl bg-secondary p-2"><p className="text-[10px] text-muted-foreground">Time</p><p className="text-xs font-black">{activity.duration}</p></div>
          <div className="rounded-xl bg-secondary p-2"><p className="text-[10px] text-muted-foreground">Rating</p><p className="text-xs font-black">{activity.rating}/5</p></div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{activity.description}</p>
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
          <p className="text-xs font-black text-primary">Designed for group decisions</p>
          <p className="mt-1 text-xs text-muted-foreground">Shortlist this idea, invite friends, and let everyone vote before anyone pays.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-black">
            <Heart size={17} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-red-500' : ''} /> {saved ? 'Shortlisted' : 'Shortlist'}
          </button>
          <button onClick={onPlan} className="flex flex-[1.3] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white">
            Start a Hangout <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function CreateHangoutSheet({ initialIds, ownerId, onCreated, onClose }: {
  initialIds: number[];
  ownerId: string;
  onCreated: (id: number) => void;
  onClose: () => void;
}) {
  const contacts = getAllUsers().filter(user => !user.isAdmin && user.id !== ownerId);
  const [name, setName] = useState('Weekend Catch-up');
  const [date, setDate] = useState(tomorrow());
  const [budget, setBudget] = useState('40');
  const [activityIds, setActivityIds] = useState<number[]>(() => {
    const unique = [...new Set(initialIds)];
    return (unique.length ? unique : ACTIVITIES.slice(0, 3).map(a => a.id)).slice(0, 3);
  });
  const [inviteIds, setInviteIds] = useState<string[]>(() => contacts.slice(0, 2).map(user => user.id));

  const toggleActivity = (id: number) => {
    setActivityIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current);
  };
  const toggleInvite = (id: string) => {
    setInviteIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };
  const canCreate = name.trim().length > 1 && activityIds.length >= 2
    && inviteIds.length > 0 && date >= tomorrow() && Number(budget) > 0;

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <div className="mb-5 flex items-start justify-between">
          <div><p className="text-xs font-black uppercase tracking-wider text-primary">New group plan</p><h2 className="text-2xl font-black text-foreground">Create a Hangout</h2></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X size={18} /></button>
        </div>

        <label className="mb-1 block text-xs font-black">Plan name</label>
        <input value={name} onChange={event => setName(event.target.value)} className="mb-4 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary" />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-black">Date<input type="date" min={tomorrow()} value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-xs font-normal" /></label>
          <label className="text-xs font-black">Budget per person<input type="number" min="1" value={budget} onChange={event => setBudget(event.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-xs font-normal" /></label>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black">Choose 2-3 ideas</p><span className="text-[10px] font-bold text-muted-foreground">{activityIds.length}/3</span></div>
          <div className="space-y-2">
            {ACTIVITIES.filter(activity => activity.pricePerPerson <= Number(budget || 0) || activityIds.includes(activity.id)).map(activity => {
              const selected = activityIds.includes(activity.id);
              return (
                <button key={activity.id} onClick={() => toggleActivity(activity.id)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <ImageWithFallback src={activity.image} alt={activity.title} className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{activity.title}</p><p className="text-[10px] text-muted-foreground">${activity.pricePerPerson}/person - {activity.location}</p></div>
                  <div className={`grid h-6 w-6 place-items-center rounded-full ${selected ? 'bg-primary text-white' : 'bg-secondary text-transparent'}`}><Check size={13} /></div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs font-black">Invite friends to vote</p>
          <div className="flex flex-wrap gap-2">
            {contacts.map(contact => {
              const selected = inviteIds.includes(contact.id);
              return <button key={contact.id} onClick={() => toggleInvite(contact.id)} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${selected ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}><span>{contact.avatar}</span>{contact.name.split(' ')[0]}</button>;
            })}
          </div>
        </div>

        <button
          disabled={!canCreate}
          onClick={() => onCreated(createHangout({ ownerUserId: ownerId, name, activityIds, invitedUserIds: inviteIds, preferredDate: date, budgetPerPerson: Number(budget) }))}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-black text-white disabled:opacity-40"
        >
          Create voting plan
        </button>
      </div>
    </Sheet>
  );
}

function PlanDetail({ plan, currentUserId, onRefresh, onClose, onPay }: {
  plan: Hangout;
  currentUserId: string;
  onRefresh: () => void;
  onClose: () => void;
  onPay: (plan: Hangout, activity: Activity) => void;
}) {
  const votes = getHangoutVotes(plan.id);
  const currentVote = votes.find(vote => vote.userId === currentUserId)?.activityId;
  const leaderId = getLeadingActivityId(plan, votes);
  const leaderIds = getLeadingActivityIds(plan, votes);
  const confirmed = plan.confirmedActivityId ? getActivity(plan.confirmedActivityId) : null;
  const owner = plan.ownerUserId === currentUserId;
  const tieNeedsOwnerChoice = leaderIds.length > 1 && (!currentVote || !leaderIds.includes(currentVote));
  const finalActivityId = leaderIds.length > 1 && currentVote && leaderIds.includes(currentVote) ? currentVote : leaderId;
  const canFinalize = votes.length > 0 && !tieNeedsOwnerChoice;
  const users = getAllUsers();

  const selectVote = (activityId: number) => {
    voteForActivity(plan.id, currentUserId, activityId);
    onRefresh();
  };
  const finalize = () => {
    if (!canFinalize) return;
    confirmHangout(plan.id, currentUserId, finalActivityId);
    onRefresh();
  };

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <div className="mb-4 flex items-start justify-between">
          <div><p className="text-xs font-black uppercase tracking-wider text-primary">{plan.status === 'confirmed' ? 'Plan confirmed' : 'Voting is open'}</p><h2 className="text-2xl font-black">{plan.name}</h2></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><X size={18} /></button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-bold text-muted-foreground">
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1.5"><CalendarDays size={12} />{new Date(`${plan.preferredDate}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1.5"><WalletCards size={12} />Up to ${plan.budgetPerPerson}/person</span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1.5"><Users size={12} />{plan.invitedUserIds.length + 1} participants</span>
        </div>

        {confirmed ? (
          <div>
            <ImageWithFallback src={confirmed.image} alt={confirmed.title} className="h-44 w-full rounded-2xl object-cover" />
            <div className="py-4"><p className="text-xs font-black text-success">Top group choice</p><h3 className="text-xl font-black">{confirmed.title}</h3><p className="mt-1 text-sm text-muted-foreground">{confirmed.venue} - {confirmed.location}</p></div>
            <div className="rounded-2xl bg-success/10 p-3 text-xs text-foreground">Everyone can see the same confirmed activity, date and budget. After the outing, continue to NETS Pay for bill splitting.</div>
            <button onClick={() => onPay(plan, confirmed)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white">Pay and split after the outing <ArrowRight size={17} /></button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-black">Vote for one activity</p>
            <div className="space-y-2">
              {plan.activityIds.map(activityId => {
                const activity = getActivity(activityId);
                if (!activity) return null;
                const count = votes.filter(vote => vote.activityId === activity.id).length;
                const selected = currentVote === activity.id;
                return (
                  <button key={activity.id} onClick={() => selectVote(activity.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <ImageWithFallback src={activity.image} alt={activity.title} className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{activity.title}</p><p className="mt-1 text-[10px] text-muted-foreground">${activity.pricePerPerson}/person - {activity.location}</p></div>
                    <div className="text-center"><p className="text-base font-black text-primary">{count}</p><p className="text-[9px] text-muted-foreground">vote{count === 1 ? '' : 's'}</p></div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl bg-secondary p-3">
              <p className="text-[10px] font-bold text-muted-foreground">Responses</p>
              <div className="mt-2 flex -space-x-1">
                {[plan.ownerUserId, ...plan.invitedUserIds].map(id => {
                  const user = users.find(item => item.id === id);
                  const hasVoted = votes.some(vote => vote.userId === id);
                  return <div key={id} title={`${user?.name ?? 'Friend'}${hasVoted ? ' voted' : ' pending'}`} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-sm ${hasVoted ? 'bg-primary/15' : 'bg-gray-100 grayscale'}`}>{user?.avatar ?? '?'}</div>;
                })}
              </div>
            </div>
            {owner && (
              <>
                {tieNeedsOwnerChoice && <p className="mt-3 text-center text-[11px] font-bold text-amber-700">Tie: vote for one of the leading choices to break it.</p>}
                {votes.length === 0 && <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground">At least one vote is required before confirmation.</p>}
                <button disabled={!canFinalize} onClick={finalize} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white disabled:opacity-40"><Check size={17} /> Confirm current top choice</button>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function HangoutsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [savedIds, setSavedIds] = useState(() => getSavedActivityIds(currentUser.id));
  const [plans, setPlans] = useState(() => getHangoutsForUser(currentUser.id));
  const [tab, setTab] = useState<'discover' | 'plans'>('discover');
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSeed, setCreateSeed] = useState<number[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const refresh = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    setSavedIds(getSavedActivityIds(user.id));
    setPlans(getHangoutsForUser(user.id));
  };
  useAppEvents(['userSwitched', 'savedActivitiesUpdated', 'hangoutsUpdated', 'databaseReady', 'focus'], refresh);

  const visibleActivities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ACTIVITIES.filter(activity =>
      (category === 'all' || activity.category === category) &&
      (!term || [activity.title, activity.venue, activity.location].some(value => value.toLowerCase().includes(term))),
    );
  }, [category, search]);
  const selectedPlan = selectedPlanId ? plans.find(plan => plan.id === selectedPlanId) ?? null : null;

  const save = (id: number) => toggleSavedActivity(currentUser.id, id);
  const startPlan = (ids: number[]) => { setSelected(null); setCreateSeed(ids); setShowCreate(true); };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="bg-white px-4 pb-3 pt-8">
        <div className="flex items-center justify-between">
          <div><NETSLogo /><p className="mt-0.5 text-xs text-muted-foreground">Plan the experience before anyone pays.</p></div>
          <button onClick={() => setShowAccountSwitcher(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base">{currentUser.avatar}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-secondary p-1">
          <button onClick={() => setTab('discover')} className={`rounded-lg py-2 text-xs font-black ${tab === 'discover' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}>Discover</button>
          <button onClick={() => setTab('plans')} className={`rounded-lg py-2 text-xs font-black ${tab === 'plans' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}>My Hangouts {plans.length ? `(${plans.length})` : ''}</button>
        </div>
      </header>

      {tab === 'discover' ? (
        <>
          <div className="border-b border-border bg-white px-4 pb-3">
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Activity, venue or area" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(Object.keys(CATEGORY_LABELS) as (ActivityCategory | 'all')[]).map(key => <button key={key} onClick={() => setCategory(key)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === key ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>{CATEGORY_LABELS[key]}</button>)}
            </div>
          </div>
          <main className="flex-1 overflow-y-auto px-4 py-3 pb-28">
            <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-primary">Suvanesh's feature</p><h1 className="text-lg font-black">Ideas your group can agree on</h1></div><button onClick={() => startPlan(savedIds)} className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white">Plan together</button></div>
            {savedIds.length > 0 && <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/5 p-2.5 text-xs text-primary"><Heart size={14} fill="currentColor" /><strong>{savedIds.length} shortlisted</strong><span className="text-primary/70">- ready for group voting</span></div>}
            <div className="grid grid-cols-2 gap-3">{visibleActivities.map(activity => <ActivityCard key={activity.id} activity={activity} saved={savedIds.includes(activity.id)} onSave={save} onOpen={setSelected} />)}</div>
          </main>
        </>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Shared decisions, one plan</p><h1 className="text-xl font-black">Your group plans</h1></div><button onClick={() => startPlan(savedIds)} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white"><Users size={18} /></button></div>
          {plans.length === 0 ? (
            <div className="mt-14 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Vote size={28} /></div><h2 className="mt-3 text-base font-black">No Hangouts yet</h2><p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">Choose a few activity ideas, invite friends, and replace the endless group-chat debate with one vote.</p><button onClick={() => setTab('discover')} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white">Discover activities</button></div>
          ) : (
            <div className="space-y-3">{plans.map(plan => {
              const activity = plan.confirmedActivityId ? getActivity(plan.confirmedActivityId) : getActivity(getLeadingActivityId(plan));
              const voteCount = getHangoutVotes(plan.id).length;
              return <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className="flex w-full gap-3 rounded-2xl border border-border bg-white p-3 text-left shadow-sm"><ImageWithFallback src={activity?.image} alt={activity?.title ?? plan.name} className="h-20 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${plan.status === 'confirmed' ? 'bg-success/10 text-success' : 'bg-amber-50 text-amber-700'}`}>{plan.status}</span><ChevronLeft size={15} className="rotate-180 text-muted-foreground" /></div><h3 className="mt-1 truncate text-sm font-black">{plan.name}</h3><p className="mt-1 text-[10px] text-muted-foreground">{new Date(`${plan.preferredDate}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} - {voteCount}/{plan.invitedUserIds.length + 1} voted</p></div></button>;
            })}</div>
          )}
        </main>
      )}

      <BottomNav />
      <AccountSwitcher isOpen={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <AnimatePresence>{selected && <ActivityDetail activity={selected} saved={savedIds.includes(selected.id)} onSave={() => save(selected.id)} onPlan={() => startPlan([selected.id, ...savedIds])} onClose={() => setSelected(null)} />}</AnimatePresence>
      <AnimatePresence>{showCreate && <CreateHangoutSheet initialIds={createSeed} ownerId={currentUser.id} onClose={() => setShowCreate(false)} onCreated={id => { setShowCreate(false); refresh(); setTab('plans'); setSelectedPlanId(id); }} />}</AnimatePresence>
      <AnimatePresence>{selectedPlan && <PlanDetail plan={selectedPlan} currentUserId={currentUser.id} onClose={() => setSelectedPlanId(null)} onRefresh={refresh} onPay={(plan, activity) => navigate('/scan', { state: {
        paymentId: createPaymentId(),
        hangoutId: plan.id,
        participantUserIds: plan.invitedUserIds,
        amount: activity.pricePerPerson * (plan.invitedUserIds.length + 1),
        merchantName: activity.venue,
        reference: `${plan.name} - ${activity.title}`,
      } })} />}</AnimatePresence>
    </div>
  );
}
