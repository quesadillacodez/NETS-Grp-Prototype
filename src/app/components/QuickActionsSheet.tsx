import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  QUICK_ACTION_CATALOGUE, QUICK_ACTION_SLOTS, isDefaultQuickActions,
  resetQuickActions, setQuickActionIds,
} from '../utils/quickActions';
import { BottomSheet } from './BottomSheet';
import { QuickActionIcon } from './QuickActionIcon';

/**
 * Choose which four shortcuts sit on Home.
 *
 * Selection is ordered: tapping an action appends it, so the order chosen here
 * is the order they appear in. With four already chosen, the rest are disabled
 * rather than hidden, so it stays obvious what else is available and why it
 * cannot be added yet.
 */
export function QuickActionsSheet({ userId, selected, onClose }: {
  userId: string;
  selected: string[];
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const full = chosen.length === QUICK_ACTION_SLOTS;

  const toggle = (id: string) => {
    setChosen(current => current.includes(id)
      ? current.filter(item => item !== id)
      : current.length < QUICK_ACTION_SLOTS ? [...current, id] : current);
  };

  return (
    <BottomSheet label="Edit Quick Actions" onClose={onClose}>
      <div>
        <div className="sticky top-0 z-10 bg-white px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-foreground">Edit Quick Actions</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Pick the {QUICK_ACTION_SLOTS} shortcuts you use most. They appear in the order you choose them.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close quick actions editor"
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-secondary"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p role="status" className="mt-2 text-[11px] font-bold text-primary">
            {chosen.length} of {QUICK_ACTION_SLOTS} chosen
            {full && (
              <span className="font-normal text-muted-foreground"> · tap a chosen one to free a slot</span>
            )}
          </p>
        </div>

        <div className="px-5 pb-8">
          <ul className="space-y-1.5">
            {QUICK_ACTION_CATALOGUE.map((action) => {
              const index = chosen.indexOf(action.id);
              const isChosen = index !== -1;
              return (
                <li key={action.id}>
                  <button
                    onClick={() => toggle(action.id)}
                    disabled={!isChosen && full}
                    aria-pressed={isChosen}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left disabled:opacity-40 ${isChosen ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary'}`}
                  >
                    <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${isChosen ? 'bg-primary text-white' : 'bg-white text-foreground'}`}>
                      <QuickActionIcon name={action.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-foreground">{action.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{action.description}</p>
                    </div>
                    <span
                      className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[10px] font-black ${isChosen ? 'bg-primary text-white' : 'border-2 border-border text-transparent'}`}
                    >
                      {isChosen ? index + 1 : 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => { setQuickActionIds(userId, chosen); onClose(); }}
              disabled={chosen.length !== QUICK_ACTION_SLOTS}
              className="min-h-11 w-full rounded-xl bg-primary text-xs font-black text-white disabled:opacity-40"
            >
              {full ? 'Save Quick Actions' : `Choose ${QUICK_ACTION_SLOTS - chosen.length} more`}
            </button>
            {!isDefaultQuickActions(chosen) && (
              <button
                onClick={() => { setChosen(resetQuickActions(userId)); }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-xs font-black text-muted-foreground"
              >
                <RotateCcw size={14} aria-hidden="true" /> Reset to the defaults
              </button>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
