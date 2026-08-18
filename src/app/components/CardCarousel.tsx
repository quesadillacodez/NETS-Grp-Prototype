import { useEffect, useRef, useState } from 'react';
import { Snowflake, Sparkles, TrendingUp } from 'lucide-react';
import { CARD_KIND_META, type Card } from '../utils/cardStorage';
import { prefersReducedMotion } from '../utils/motionPreference';

/**
 * The NETS cards on Home, as a carousel the customer can actually swipe.
 *
 * Scrolling is native — a scroll-snap track rather than a JavaScript drag
 * gesture — so a finger swipe behaves the way every other list on the phone
 * does: it follows the finger, keeps its momentum, and never fights the page's
 * vertical scroll. The dots below are real buttons, and the track takes arrow
 * keys, so the carousel is reachable without a touchscreen too.
 */
export function CardCarousel({ cards, activeIndex, onActiveIndexChange, onSelect, userName, userAvatar }: {
  cards: Card[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (card: Card) => void;
  userName: string;
  userAvatar: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Suppresses the scroll listener while a dot or arrow key is animating the
  // track, so the active dot doesn't flicker through the cards in between.
  const scrollingTo = useRef<number | null>(null);

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track || index < 0 || index >= cards.length) return;
    scrollingTo.current = index;
    onActiveIndexChange(index);
    track.scrollTo({
      left: index * track.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (scrollingTo.current !== null) {
      if (scrollingTo.current !== index) return;
      scrollingTo.current = null;
    }
    if (index !== activeIndex && index >= 0 && index < cards.length) onActiveIndexChange(index);
  };

  // Keep the track on the active card when the window is resized, otherwise a
  // rotation leaves it stopped between two cards.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onResize = () => track.scrollTo({ left: activeIndex * track.clientWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex]);

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); scrollToIndex(activeIndex + 1); }
          if (event.key === 'ArrowLeft')  { event.preventDefault(); scrollToIndex(activeIndex - 1); }
        }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Your NETS cards — swipe or use the arrow keys"
        // The track is exactly one card wide, so a card's offset is always a
        // whole multiple of `clientWidth` — which is what turns a scroll
        // position back into the index of the card in view.
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, index) => (
          <div key={card.id} className="w-full flex-shrink-0 snap-center pr-2 last:pr-0">
            <CardFace
              card={card}
              isActive={index === activeIndex}
              position={index + 1}
              total={cards.length}
              userName={userName}
              userAvatar={userAvatar}
              onSelect={() => onSelect(card)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {cards.map((card, index) => (
          <button
            key={card.id}
            onClick={() => scrollToIndex(index)}
            aria-label={`Show ${card.meta.label}`}
            aria-current={index === activeIndex}
            className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-5 bg-primary' : 'w-2 bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  );
}

function CardFace({ card, isActive, position, total, userName, userAvatar, onSelect }: {
  card: Card;
  isActive: boolean;
  position: number;
  total: number;
  userName: string;
  userAvatar: string;
  onSelect: () => void;
}) {
  const meta = CARD_KIND_META[card.kind];
  const balance = `$${card.balance.toFixed(2)}`;

  return (
    <button
      onClick={onSelect}
      // Only the card in view is announced; the others are reachable by moving
      // the carousel, and reading all three at once would be nonsense.
      aria-hidden={!isActive}
      tabIndex={isActive ? 0 : -1}
      aria-label={`${meta.label}, ${balance}${card.frozen ? ', frozen' : ''}. Card ${position} of ${total}. Open card details.`}
      className={`w-full rounded-2xl bg-gradient-to-br ${meta.face} p-4 text-left shadow-lg`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
            <span className="text-sm" aria-hidden="true">{userAvatar}</span>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 truncate text-xs leading-none text-white/80">{meta.label}</p>
            <p className="truncate text-xs font-semibold text-white">{userName}</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 flex-shrink-0 text-white/70" aria-hidden="true" />
      </div>

      <div className="mb-3">
        <p className="mb-0.5 text-xs text-white/80">
          {card.meta.holdsOwnBalance ? 'Card Balance' : 'Available Balance'}
        </p>
        {/* The card in view carries the page's heading; the rest are hidden
            from assistive technology, so they must not be headings at all. */}
        {isActive
          ? <h1 className="text-3xl font-black tracking-tight text-white">{balance}</h1>
          : <p className="text-3xl font-black tracking-tight text-white">{balance}</p>}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/70">···· {card.lastFour}</p>
        <div className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white/90">
          {card.frozen
            ? <><Snowflake className="h-3 w-3" aria-hidden="true" />Frozen</>
            : <><TrendingUp className="h-3 w-3" aria-hidden="true" />Active</>}
        </div>
      </div>
    </button>
  );
}
