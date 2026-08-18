import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';

/**
 * The sheet that slides up from the bottom of the phone frame.
 *
 * Shared by the card, Quick Actions and location pickers so they behave the
 * same way: a real dialog as far as assistive technology is concerned, closed
 * by the backdrop or the Escape key, with focus moved into the sheet on open so
 * a keyboard or screen-reader user lands inside it rather than on whatever was
 * behind it.
 */
export function BottomSheet({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end bg-black/45"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="max-h-[85%] w-full overflow-y-auto rounded-t-[28px] bg-white outline-none"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
