import { useState } from 'react';
import { Check, ChevronRight, Navigation, RotateCcw, Search, X } from 'lucide-react';
import {
  SELECTABLE_AREAS, formatDistance, getUserArea, isDefaultArea, proximityTo,
  resetUserArea, setUserArea,
} from '../utils/geo';
import { BottomSheet } from './BottomSheet';

/**
 * The banner that states where the customer is, and opens the picker when
 * tapped. Shared by Hangouts and the Rewards store so the location shown — and
 * the one used for filtering — can never disagree between them.
 */
export function LocationBanner({ userId, title, subtitle, onOpen }: {
  userId: string;
  title: string;
  subtitle?: string;
  onOpen: () => void;
}) {
  const area = getUserArea(userId);
  return (
    <button
      onClick={onOpen}
      aria-label={`Change your location — currently ${area}`}
      className="flex w-full items-center gap-2 rounded-2xl bg-primary/5 p-3 text-left"
    >
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-primary text-white">
        <Navigation size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {subtitle ?? 'Based on your location'} · <span className="font-bold text-primary">{area}</span>
        </p>
      </div>
      <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] font-black text-primary">
        Change <ChevronRight size={12} aria-hidden="true" />
      </span>
    </button>
  );
}

/** Sheet listing every area the demo can be moved to, nearest first. */
export function LocationSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const current = getUserArea(userId);
  const term = search.trim().toLowerCase();

  const areas = SELECTABLE_AREAS
    .filter(area => !term || area.toLowerCase().includes(term))
    .map(area => ({ area, proximity: proximityTo(userId, area) }));

  const choose = (area: string) => {
    setUserArea(userId, area);
    onClose();
  };

  return (
    <BottomSheet label="Set your location" onClose={onClose}>
      <div>
        <div className="sticky top-0 z-10 bg-white px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground">Set your location</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Hangout ideas and reward outlets are ranked by distance from here.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close location picker"
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-secondary"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
            <Search size={16} className="text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search an area"
              aria-label="Search an area"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        </div>

        <div className="px-5 pb-8">
          {!isDefaultArea(userId) && (
            <button
              onClick={() => { resetUserArea(userId); onClose(); }}
              className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-xs font-black text-muted-foreground"
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset to my usual area
            </button>
          )}

          {areas.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No area matches "{search.trim()}".
            </p>
          ) : (
            <ul className="space-y-1.5">
              {areas.map(({ area, proximity }) => {
                const selected = area === current;
                return (
                  <li key={area}>
                    <button
                      onClick={() => choose(area)}
                      aria-pressed={selected}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${selected ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary'}`}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{area}</span>
                      {!selected && proximity.km !== null && (
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                          {formatDistance(proximity.km)}
                        </span>
                      )}
                      <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full ${selected ? 'bg-primary text-white' : 'text-transparent'}`}>
                        <Check size={12} aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
            The prototype has no device location permission, so your area is set here.
            A production build would ask the phone for it.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
