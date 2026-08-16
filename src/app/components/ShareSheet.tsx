import { type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface ShareSheetAction {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  actions: ShareSheetAction[];
  title?: string;
}

// Instagram-Reels-style share sheet: a bottom sheet with a row of circular
// icon actions. Follows this app's existing hand-rolled bottom-sheet
// convention (see RewardsPage/HangoutsPage's OverlaySheet) rather than the
// unused vaul Drawer primitive, for visual consistency.
export function ShareSheet({ open, onClose, actions, title = "Share" }: ShareSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-end bg-black/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full rounded-t-[28px] bg-white pb-8"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>
            <p className="px-5 pt-2 pb-4 text-center text-sm font-semibold text-muted-foreground">{title}</p>
            <div className="flex gap-5 overflow-x-auto px-6">
              {actions.map((a) => (
                <button
                  key={a.key}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className="flex w-16 shrink-0 flex-col items-center gap-2 disabled:opacity-40"
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#8b5cf6] text-white shadow-md">
                    {a.icon}
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-foreground">{a.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
