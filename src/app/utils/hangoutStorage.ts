import { lastInsertId, query, queryOne, run } from './db';

export type ActivityCategory = 'food' | 'attraction' | 'creative' | 'active';

export interface Activity {
  id: number;
  category: ActivityCategory;
  title: string;
  venue: string;
  location: string;
  pricePerPerson: number;
  duration: string;
  groupSize: string;
  rating: number;
  image: string;
  description: string;
  featured?: boolean;
}

export interface Hangout {
  id: number;
  ownerUserId: string;
  name: string;
  activityIds: number[];
  invitedUserIds: string[];
  preferredDate: string;
  budgetPerPerson: number;
  status: 'voting' | 'confirmed';
  confirmedActivityId: number | null;
  createdAt: number;
}

export interface HangoutVote {
  hangoutId: number;
  userId: string;
  activityId: number;
}

// The Hangouts catalogue is about planning an outing. Prices help a group agree
// on a budget; there are no discounts, XP, vouchers, or redemptions. These rows
// seed the `activities` table, which management can then edit from the portal.
const DEFAULT_ACTIVITIES: Activity[] = [
  {
    id: 1,
    category: 'creative',
    title: 'Neon Art Jam',
    venue: 'Motion Art Space',
    location: 'Arab Street',
    pricePerPerson: 28,
    duration: '90 min',
    groupSize: '2-8 people',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=520&fit=crop&auto=format',
    description: 'Create a shared canvas under neon lights with music and guided prompts.',
    featured: true,
  },
  {
    id: 2,
    category: 'active',
    title: 'Laser Tag Battle',
    venue: 'Laser Quest Singapore',
    location: 'Bugis',
    pricePerPerson: 24,
    duration: '60 min',
    groupSize: '4-12 people',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=520&fit=crop&auto=format',
    description: 'A fast team challenge with private scoring for groups of friends.',
  },
  {
    id: 3,
    category: 'food',
    title: 'Hawker Food Trail',
    venue: 'Maxwell Food Centre',
    location: 'Chinatown',
    pricePerPerson: 18,
    duration: '2 hours',
    groupSize: '2-6 people',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&h=520&fit=crop&auto=format',
    description: 'Build a group tasting route across local stalls with a suggested shared budget.',
  },
  {
    id: 4,
    category: 'attraction',
    title: 'Cloud Forest Evening',
    venue: 'Gardens by the Bay',
    location: 'Marina South',
    pricePerPerson: 32,
    duration: '2-3 hours',
    groupSize: '2-8 people',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800&h=520&fit=crop&auto=format',
    description: 'Plan an evening route through Cloud Forest and the outdoor light show.',
  },
  {
    id: 5,
    category: 'creative',
    title: 'Pottery Taster Session',
    venue: 'The Potters Guilt',
    location: 'River Valley',
    pricePerPerson: 45,
    duration: '2 hours',
    groupSize: '2-6 people',
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=520&fit=crop&auto=format',
    description: 'Learn basic wheel throwing together and keep one finished piece each.',
  },
  {
    id: 6,
    category: 'active',
    title: 'Bouldering Social',
    venue: 'Boulder Movement',
    location: 'Downtown',
    pricePerPerson: 30,
    duration: '2 hours',
    groupSize: '2-10 people',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&h=520&fit=crop&auto=format',
    description: 'Beginner-friendly climbing with shoe rental and a group warm-up.',
  },
  {
    id: 7,
    category: 'attraction',
    title: 'Night Safari Trail',
    venue: 'Mandai Wildlife Reserve',
    location: 'Mandai',
    pricePerPerson: 55,
    duration: '3 hours',
    groupSize: '2-8 people',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800&h=520&fit=crop&auto=format',
    description: 'Coordinate entry time, tram ride, and walking trails in one shared plan.',
  },
  {
    id: 8,
    category: 'food',
    title: 'Kampong Glam Cafe Hop',
    venue: 'Kampong Glam',
    location: 'Bugis',
    pricePerPerson: 25,
    duration: '2 hours',
    groupSize: '2-6 people',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=520&fit=crop&auto=format',
    description: 'Vote on three cafe stops and keep the group within a shared spending limit.',
  },
];

const ACTIVITY_CATEGORIES: ActivityCategory[] = ['food', 'attraction', 'creative', 'active'];

function rowToActivity(row: Record<string, any>): Activity {
  const category = String(row.category) as ActivityCategory;
  return {
    id: Number(row.id),
    category: ACTIVITY_CATEGORIES.includes(category) ? category : 'food',
    title: String(row.title),
    venue: String(row.venue),
    location: String(row.location),
    pricePerPerson: Number(row.price_per_person),
    duration: String(row.duration),
    groupSize: String(row.group_size),
    rating: Number(row.rating),
    image: String(row.image),
    description: String(row.description),
  };
}

function notifyActivities(): void {
  window.dispatchEvent(new CustomEvent('activitiesUpdated'));
}

export function seedActivitiesIfEmpty(): void {
  const row = queryOne('SELECT COUNT(*) AS n FROM activities');
  if (row && Number(row.n) > 0) return;
  for (const activity of DEFAULT_ACTIVITIES) {
    run(
      `INSERT INTO activities
        (id, category, title, venue, location, price_per_person, duration, group_size, rating, image, description, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [activity.id, activity.category, activity.title, activity.venue, activity.location,
        activity.pricePerPerson, activity.duration, activity.groupSize, activity.rating,
        activity.image, activity.description],
    );
  }
}

export function getActivities(): Activity[] {
  seedActivitiesIfEmpty();
  return query('SELECT * FROM activities WHERE active = 1 ORDER BY id').map(rowToActivity);
}

export function addActivity(activity: Omit<Activity, 'id'>): number {
  run(
    `INSERT INTO activities
      (category, title, venue, location, price_per_person, duration, group_size, rating, image, description, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [activity.category, activity.title, activity.venue, activity.location, activity.pricePerPerson,
      activity.duration, activity.groupSize, activity.rating, activity.image, activity.description],
  );
  const id = lastInsertId();
  notifyActivities();
  return id;
}

export function updateActivity(activity: Activity): void {
  run(
    `UPDATE activities SET
       category = ?, title = ?, venue = ?, location = ?, price_per_person = ?,
       duration = ?, group_size = ?, rating = ?, image = ?, description = ?
     WHERE id = ?`,
    [activity.category, activity.title, activity.venue, activity.location, activity.pricePerPerson,
      activity.duration, activity.groupSize, activity.rating, activity.image, activity.description,
      activity.id],
  );
  notifyActivities();
}

// Soft delete: hangouts already created may still reference this activity, so the
// row stays readable by getActivity() while disappearing from the catalogue.
export function deleteActivity(activityId: number): void {
  run('UPDATE activities SET active = 0 WHERE id = ?', [activityId]);
  notifyActivities();
}

function parseIds(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function parseUserIds(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rowToHangout(row: Record<string, any>): Hangout {
  return {
    id: Number(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    activityIds: parseIds(row.activity_ids),
    invitedUserIds: parseUserIds(row.invited_user_ids),
    preferredDate: String(row.preferred_date),
    budgetPerPerson: Number(row.budget_per_person),
    status: row.status === 'confirmed' ? 'confirmed' : 'voting',
    confirmedActivityId: row.confirmed_activity_id == null ? null : Number(row.confirmed_activity_id),
    createdAt: Number(row.created_at),
  };
}

function notifyHangouts(): void {
  window.dispatchEvent(new CustomEvent('hangoutsUpdated'));
}

function notifySaved(): void {
  window.dispatchEvent(new CustomEvent('savedActivitiesUpdated'));
}

export function getActivity(activityId: number): Activity | null {
  seedActivitiesIfEmpty();
  const row = queryOne('SELECT * FROM activities WHERE id = ?', [activityId]);
  return row ? rowToActivity(row) : null;
}

export function getSavedActivityIds(userId: string): number[] {
  return query('SELECT activity_id FROM saved_activities WHERE user_id = ? ORDER BY activity_id', [userId])
    .map(row => Number(row.activity_id));
}

export function toggleSavedActivity(userId: string, activityId: number): void {
  const exists = queryOne(
    'SELECT 1 AS found FROM saved_activities WHERE user_id = ? AND activity_id = ?',
    [userId, activityId],
  );
  if (exists) {
    run('DELETE FROM saved_activities WHERE user_id = ? AND activity_id = ?', [userId, activityId]);
  } else {
    run('INSERT INTO saved_activities (user_id, activity_id) VALUES (?, ?)', [userId, activityId]);
  }
  notifySaved();
}

export const MIN_BUDGET_PER_PERSON = 5;
export const MAX_BUDGET_PER_PERSON = 500;

// Returns a human-readable problem with the chosen budget, or null when it's fine.
export function validateBudget(rawBudget: string, selected: Activity[]): string | null {
  const budget = Number(rawBudget);
  if (!rawBudget.trim() || !Number.isFinite(budget)) return 'Enter a budget per person.';
  if (budget <= 0) return 'Budget must be greater than $0.';
  if (budget < MIN_BUDGET_PER_PERSON) return `Budget must be at least $${MIN_BUDGET_PER_PERSON} per person.`;
  if (budget > MAX_BUDGET_PER_PERSON) return `Budget cannot exceed $${MAX_BUDGET_PER_PERSON} per person.`;

  const overBudget = selected.filter(activity => activity.pricePerPerson > budget);
  if (overBudget.length > 0) {
    const cheapest = Math.min(...overBudget.map(activity => activity.pricePerPerson));
    return `${overBudget.length} selected idea${overBudget.length === 1 ? '' : 's'} cost more than $${budget}/person. Raise the budget to at least $${cheapest} or remove them.`;
  }
  return null;
}

export function createHangout(input: {
  ownerUserId: string;
  name: string;
  activityIds: number[];
  invitedUserIds: string[];
  preferredDate: string;
  budgetPerPerson: number;
}): number {
  run(
    `INSERT INTO hangouts
      (owner_user_id, name, activity_ids, invited_user_ids, preferred_date,
       budget_per_person, status, confirmed_activity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'voting', NULL, ?)`,
    [
      input.ownerUserId,
      input.name.trim(),
      JSON.stringify(input.activityIds),
      JSON.stringify(input.invitedUserIds),
      input.preferredDate,
      input.budgetPerPerson,
      Date.now(),
    ],
  );
  const id = lastInsertId();
  notifyHangouts();
  return id;
}

export function getHangout(hangoutId: number): Hangout | null {
  const row = queryOne('SELECT * FROM hangouts WHERE id = ?', [hangoutId]);
  return row ? rowToHangout(row) : null;
}

export function getAllHangouts(): Hangout[] {
  return query('SELECT * FROM hangouts ORDER BY created_at DESC').map(rowToHangout);
}

export function getHangoutsForUser(userId: string): Hangout[] {
  return query('SELECT * FROM hangouts ORDER BY created_at DESC')
    .map(rowToHangout)
    .filter(hangout => hangout.ownerUserId === userId || hangout.invitedUserIds.includes(userId));
}

export function getHangoutVotes(hangoutId: number): HangoutVote[] {
  return query('SELECT * FROM hangout_votes WHERE hangout_id = ?', [hangoutId]).map(row => ({
    hangoutId: Number(row.hangout_id),
    userId: String(row.user_id),
    activityId: Number(row.activity_id),
  }));
}

export function voteForActivity(hangoutId: number, userId: string, activityId: number): void {
  const hangout = getHangout(hangoutId);
  const eligible = hangout && (hangout.ownerUserId === userId || hangout.invitedUserIds.includes(userId));
  if (!hangout || !eligible || hangout.status !== 'voting' || !hangout.activityIds.includes(activityId)) return;
  run(
    `INSERT INTO hangout_votes (hangout_id, user_id, activity_id)
     VALUES (?, ?, ?)
     ON CONFLICT(hangout_id, user_id) DO UPDATE SET activity_id = excluded.activity_id`,
    [hangoutId, userId, activityId],
  );
  notifyHangouts();
}

export function getParticipantIds(hangout: Hangout): string[] {
  return [hangout.ownerUserId, ...hangout.invitedUserIds];
}

// Everyone invited must have voted before a plan can be locked in, so nobody
// loses their say to whoever votes first.
export function hasEveryoneVoted(hangout: Hangout, votes = getHangoutVotes(hangout.id)): boolean {
  const voted = new Set(votes.map(vote => vote.userId));
  return getParticipantIds(hangout).every(id => voted.has(id));
}

export function confirmHangout(hangoutId: number, ownerUserId: string, activityId: number): void {
  const hangout = getHangout(hangoutId);
  if (!hangout) return;
  const votes = getHangoutVotes(hangoutId);
  const leaders = getLeadingActivityIds(hangout, votes);
  if (hangout.status !== 'voting' || hangout.ownerUserId !== ownerUserId
      || !hasEveryoneVoted(hangout, votes) || !leaders.includes(activityId)) return;
  run(
    "UPDATE hangouts SET status = 'confirmed', confirmed_activity_id = ? WHERE id = ?",
    [activityId, hangoutId],
  );
  notifyHangouts();
}

export function getLeadingActivityId(hangout: Hangout, votes = getHangoutVotes(hangout.id)): number {
  return getLeadingActivityIds(hangout, votes)[0] ?? hangout.activityIds[0];
}

export function getLeadingActivityIds(hangout: Hangout, votes = getHangoutVotes(hangout.id)): number[] {
  const totals = new Map<number, number>();
  hangout.activityIds.forEach(id => totals.set(id, 0));
  votes.forEach(vote => totals.set(vote.activityId, (totals.get(vote.activityId) ?? 0) + 1));
  const highest = Math.max(0, ...totals.values());
  if (highest === 0) return [];
  return [...totals.entries()].filter(([, count]) => count === highest).map(([id]) => id);
}
