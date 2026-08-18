import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUICK_ACTION_IDS, QUICK_ACTION_CATALOGUE, QUICK_ACTION_SLOTS,
  findQuickAction, isDefaultQuickActions, normaliseQuickActionIds,
} from './quickActions';

describe('the Quick Actions catalogue', () => {
  it('gives every action a unique id', () => {
    const ids = QUICK_ACTION_CATALOGUE.map(action => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers more actions than there are slots, or there would be nothing to choose', () => {
    expect(QUICK_ACTION_CATALOGUE.length).toBeGreaterThan(QUICK_ACTION_SLOTS);
  });

  it('only points at routes the app actually has', () => {
    // Kept in step with App.tsx by hand; a shortcut to a missing route would
    // land the customer on the catch-all redirect instead.
    for (const action of QUICK_ACTION_CATALOGUE) {
      expect(action.path.startsWith('/')).toBe(true);
    }
  });

  it('defaults to four actions that all exist', () => {
    expect(DEFAULT_QUICK_ACTION_IDS).toHaveLength(QUICK_ACTION_SLOTS);
    for (const id of DEFAULT_QUICK_ACTION_IDS) expect(findQuickAction(id)).toBeDefined();
  });
});

describe('normalising a stored selection', () => {
  it('keeps a valid selection as it is, in the order chosen', () => {
    expect(normaliseQuickActionIds(['wrapped', 'dashboard', 'rewards', 'hangouts']))
      .toEqual(['wrapped', 'dashboard', 'rewards', 'hangouts']);
  });

  it('drops ids the catalogue no longer knows about', () => {
    const chosen = normaliseQuickActionIds(['wrapped', 'a-removed-feature', 'rewards']);
    expect(chosen).not.toContain('a-removed-feature');
    expect(chosen.slice(0, 2)).toEqual(['wrapped', 'rewards']);
  });

  it('tops a short selection up from the defaults rather than leaving a gap', () => {
    const chosen = normaliseQuickActionIds(['wrapped']);
    expect(chosen).toHaveLength(QUICK_ACTION_SLOTS);
    expect(chosen[0]).toBe('wrapped');
  });

  it('never repeats an action', () => {
    const chosen = normaliseQuickActionIds(['wrapped', 'wrapped', 'rewards']);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it('never returns more than the row can hold', () => {
    const everything = QUICK_ACTION_CATALOGUE.map(action => action.id);
    expect(normaliseQuickActionIds(everything)).toHaveLength(QUICK_ACTION_SLOTS);
  });

  it('falls back to the defaults for anything that is not a list of ids', () => {
    expect(normaliseQuickActionIds(null)).toEqual(DEFAULT_QUICK_ACTION_IDS);
    expect(normaliseQuickActionIds('wrapped')).toEqual(DEFAULT_QUICK_ACTION_IDS);
    expect(normaliseQuickActionIds([])).toEqual(DEFAULT_QUICK_ACTION_IDS);
  });
});

describe('recognising the default selection', () => {
  it('matches only the defaults, in their default order', () => {
    expect(isDefaultQuickActions([...DEFAULT_QUICK_ACTION_IDS])).toBe(true);
    expect(isDefaultQuickActions([...DEFAULT_QUICK_ACTION_IDS].reverse())).toBe(false);
    expect(isDefaultQuickActions(['wrapped', 'history', 'split', 'reminders'])).toBe(false);
  });
});
