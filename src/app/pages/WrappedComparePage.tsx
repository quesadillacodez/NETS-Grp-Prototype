import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Sparkles, Home, ArrowLeftRight, Trophy, Crown, DollarSign, Calendar, ShoppingBag, Award, Gift,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { getCurrentUser } from "../utils/userStorage";
import { getWrappedTransactions, getFinancialPersonality, getWrappedStats, calculateSpendingByCategory, getFunEquivalent } from "../utils/wrappedData";
import { decodeWrappedShare } from "../utils/wrappedShare";
import { fxCelebrate, fxTick } from "../utils/feedback";
import { FloatingBlobs, SparkleField } from "./WrappedPage";
import { format } from "date-fns";

// Deliberately no blue (that's "You") and no pink specifically paired against
// it — a random friend shouldn't end up coded as "the pink one" opposite blue.
const FRIEND_COLORS = [
  { bg: "bg-emerald-500", bar: "bg-emerald-400" },
  { bg: "bg-amber-500", bar: "bg-amber-400" },
  { bg: "bg-violet-500", bar: "bg-violet-400" },
  { bg: "bg-cyan-500", bar: "bg-cyan-400" },
  { bg: "bg-orange-500", bar: "bg-orange-400" },
];
type FriendColor = (typeof FRIEND_COLORS)[number];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function avatarColor(name: string): FriendColor {
  const sum = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return FRIEND_COLORS[sum % FRIEND_COLORS.length];
}

type CompareStat = {
  key: string;
  label: string;
  icon: React.ReactNode;
  mineDisplay: string | undefined;
  theirsDisplay: string;
  mineValue?: number;
  theirsValue?: number;
  matchable?: boolean;
  // Present only for the celebratory "together" bonus stat — not a head-to-head,
  // so it renders as one centered reveal instead of a You/Them split.
  combined?: { emoji: string; label: string; count: number };
};

function winnerOf(mine?: number, theirs?: number): "mine" | "theirs" | "tie" | undefined {
  if (mine === undefined || theirs === undefined) return undefined;
  if (mine === theirs) return "tie";
  return mine > theirs ? "mine" : "theirs";
}

export function WrappedComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const payload = useMemo(() => decodeWrappedShare(searchParams.get("d")), [searchParams]);

  const receiverTxns = useMemo(
    () => (payload ? getWrappedTransactions(currentUser.id) : []),
    [payload, currentUser.id]
  );
  const receiverStats = payload ? getWrappedStats(payload.y, payload.m, receiverTxns) : null;
  const receiverPersonality = payload ? getFinancialPersonality(payload.y, payload.m, receiverTxns) : null;
  const receiverCategories = payload ? calculateSpendingByCategory(payload.y, payload.m, receiverTxns) : [];
  const receiverHasData = !!receiverStats && receiverStats.totalTransactions > 0;
  const isOwnLink = !!payload && currentUser.name === payload.u;
  const monthName = payload ? format(new Date(payload.y, payload.m), "MMMM yyyy") : "";
  const friendInitials = payload ? initials(payload.u) : "?";
  const friendColor = payload ? avatarColor(payload.u) : FRIEND_COLORS[0];

  const compareStats: CompareStat[] = [];
  if (payload) {
    if (payload.p) {
      compareStats.push({
        key: "personality", label: "Personality", icon: <Award className="size-4" />,
        mineDisplay: receiverHasData ? receiverPersonality?.title : undefined,
        theirsDisplay: payload.p.t,
        matchable: true,
      });
    }
    if (payload.ts !== undefined) {
      compareStats.push({
        key: "totalSpent", label: "Total Spent", icon: <DollarSign className="size-4" />,
        mineDisplay: receiverHasData ? `$${receiverStats!.totalSpent.toFixed(2)}` : undefined,
        theirsDisplay: `$${payload.ts.toFixed(2)}`,
        mineValue: receiverHasData ? receiverStats!.totalSpent : undefined,
        theirsValue: payload.ts,
      });
      if (receiverHasData && !isOwnLink) {
        const equiv = getFunEquivalent(payload.ts + receiverStats!.totalSpent);
        if (equiv) {
          compareStats.push({
            key: "combinedEquivalent", label: "Together You're Worth", icon: <span className="text-sm leading-none">{equiv.emoji}</span>,
            mineDisplay: undefined,
            theirsDisplay: `${equiv.count} ${equiv.label}`,
            combined: equiv,
          });
        }
      }
    }
    if (payload.tx !== undefined) {
      compareStats.push({
        key: "transactions", label: "Transactions", icon: <Calendar className="size-4" />,
        mineDisplay: receiverHasData ? String(receiverStats!.totalTransactions) : undefined,
        theirsDisplay: String(payload.tx),
        mineValue: receiverHasData ? receiverStats!.totalTransactions : undefined,
        theirsValue: payload.tx,
      });
    }
    if (payload.tc) {
      compareStats.push({
        key: "topCategory", label: "Top Category", icon: <ShoppingBag className="size-4" />,
        mineDisplay: receiverHasData ? receiverCategories[0]?.name : undefined,
        theirsDisplay: payload.tc.n,
        mineValue: receiverHasData ? receiverCategories[0]?.value : undefined,
        theirsValue: payload.tc.v,
      });
    }
    if (payload.bp) {
      compareStats.push({
        key: "biggestPurchase", label: "Biggest Purchase", icon: <Sparkles className="size-4" />,
        mineDisplay: receiverHasData ? receiverStats!.biggestPurchase?.merchant : undefined,
        theirsDisplay: payload.bp.n,
        mineValue: receiverHasData ? Math.abs(receiverStats!.biggestPurchase?.amount ?? 0) : undefined,
        theirsValue: payload.bp.a,
      });
    }
    if (payload.tm) {
      compareStats.push({
        key: "topMerchant", label: "Top Merchant", icon: <Trophy className="size-4" />,
        mineDisplay: receiverHasData ? receiverStats!.topMerchant.name : undefined,
        theirsDisplay: payload.tm.n,
        mineValue: receiverHasData ? receiverStats!.topMerchant.count : undefined,
        theirsValue: payload.tm.c,
      });
    }
    if (payload.mp) {
      compareStats.push({
        key: "mostPaid", label: "Most Paid To", icon: <ArrowLeftRight className="size-4" />,
        mineDisplay: receiverHasData ? receiverStats!.mostPaidPerson.name : undefined,
        theirsDisplay: payload.mp.n,
        mineValue: receiverHasData ? receiverStats!.mostPaidPerson.amount : undefined,
        theirsValue: payload.mp.a,
      });
    }
  }

  const decided = compareStats.filter((s) => !s.matchable && s.mineValue !== undefined && s.theirsValue !== undefined);
  const wins = decided.filter((s) => winnerOf(s.mineValue, s.theirsValue) === "mine").length;
  const losses = decided.filter((s) => winnerOf(s.mineValue, s.theirsValue) === "theirs").length;
  const ties = decided.length - wins - losses;
  // Only worth the "tap to reveal" suspense when there's an actual head-to-head —
  // own links and no-data links just display everything plainly, as before.
  const interactive = receiverHasData && !isOwnLink && compareStats.length > 0;
  const showTally = interactive && decided.length > 0;

  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const nextKey = compareStats.find((s) => !revealedKeys.has(s.key))?.key;
  const allRevealed = interactive && compareStats.every((s) => revealedKeys.has(s.key));

  const revealOne = (key: string) => {
    fxTick();
    setRevealedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  };
  const revealTimeoutsRef = useRef<number[]>([]);
  useEffect(() => () => { revealTimeoutsRef.current.forEach((id) => window.clearTimeout(id)); }, []);
  const revealAll = () => {
    const remaining = compareStats.filter((s) => !revealedKeys.has(s.key));
    remaining.forEach((s, i) => {
      revealTimeoutsRef.current.push(window.setTimeout(() => revealOne(s.key), i * 110));
    });
  };

  // Fire the big celebratory burst once every card has been opened.
  const finaleFiredRef = useRef(false);
  useEffect(() => {
    if (finaleFiredRef.current || !allRevealed) return;
    finaleFiredRef.current = true;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.3 }, colors: ["#0040ff", "#a855f7", "#ec4899", "#fbbf24", "#22c55e"] });
    fxCelebrate();
  }, [allRevealed]);

  if (!payload) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-white p-6 text-center">
        <Sparkles className="size-14 text-muted-foreground/40" />
        <p className="text-lg font-medium">This link looks broken or incomplete</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          The compare link may have been copied incorrectly or is out of date.
        </p>
        <Button onClick={() => navigate("/wrapped")}>Go to My Wrapped</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-br from-white via-primary/5 to-secondary">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative shrink-0 overflow-hidden p-6 text-center text-white"
        style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }}
      >
        <FloatingBlobs />
        <SparkleField count={9} />
        <div className="relative z-[1]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/60">{monthName} · NETS Wrapped Compare</p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex size-16 items-center justify-center rounded-full bg-white/15 text-3xl">{currentUser.avatar}</div>
              <p className="max-w-full truncate text-xs font-semibold text-white/90">You</p>
            </div>
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#0f172a] shadow-lg"
            >
              VS
            </motion.div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className={`flex size-16 items-center justify-center rounded-full text-lg font-black text-white ${friendColor.bg}`}>{friendInitials}</div>
              <p className="max-w-full truncate text-xs font-semibold text-white/90">{payload.u}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {isOwnLink && (
        <div className="mx-4 mt-4 shrink-0 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
          This looks like your own link — share it with a friend to see how their month compares!
        </div>
      )}

      {!receiverHasData && !isOwnLink && (
        <div className="mx-4 mt-4 shrink-0 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          You don't have NETS activity for {monthName} yet — showing {payload.u}'s Wrapped only. Make some payments this month to compare!
        </div>
      )}

      {interactive && !allRevealed && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 flex shrink-0 items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-primary/10 to-secondary px-4 py-3 text-xs text-foreground">
          <span className="flex items-center gap-1.5 font-semibold">
            <Gift className="size-4 text-primary" /> Tap each card to reveal how you compare!
          </span>
          <button onClick={revealAll}
            className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20">
            Reveal All
          </button>
        </motion.div>
      )}

      {showTally && allRevealed && (
        <motion.div initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mx-4 mt-4 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-100 to-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-900">
          <Trophy className="size-4 shrink-0 text-amber-500" />
          {wins > losses && <span>You're leading {wins}-{losses}{ties > 0 ? ` (${ties} tied)` : ""}!</span>}
          {losses > wins && <span>{payload.u} leads {losses}-{wins}{ties > 0 ? ` (${ties} tied)` : ""}</span>}
          {wins === losses && <span>It's a tie, {wins}-{losses}! 🤝</span>}
        </motion.div>
      )}

      <div className="space-y-2.5 p-4">
        {compareStats.map((stat, i) => (
          <StatRow
            key={stat.key}
            stat={stat}
            currentUser={currentUser}
            friendInitials={friendInitials}
            friendColor={friendColor}
            index={i}
            interactive={interactive}
            revealed={!interactive || revealedKeys.has(stat.key)}
            isNext={interactive && stat.key === nextKey}
            onReveal={() => revealOne(stat.key)}
          />
        ))}
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-border bg-white p-4">
        <Button className="w-full bg-gradient-to-r from-[#0040ff] to-[#0028a8] hover:opacity-90 text-white" onClick={() => navigate("/wrapped")}>
          View My Wrapped
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/")}>
          <Home className="mr-2 size-4" /> Exit to Home
        </Button>
      </div>
    </div>
  );
}

function StatRow({
  stat, currentUser, friendInitials, friendColor, index, interactive, revealed, isNext, onReveal,
}: {
  stat: CompareStat;
  currentUser: { avatar: string };
  friendInitials: string;
  friendColor: FriendColor;
  index: number;
  interactive: boolean;
  revealed: boolean;
  isNext: boolean;
  onReveal: () => void;
}) {
  const closed = interactive && !revealed;
  const winner = stat.matchable ? undefined : winnerOf(stat.mineValue, stat.theirsValue);
  const isMatch = stat.matchable && stat.mineDisplay !== undefined && stat.mineDisplay === stat.theirsDisplay;
  const total = (stat.mineValue ?? 0) + (stat.theirsValue ?? 0);
  const mineRatio = total > 0 ? (stat.mineValue ?? 0) / total : 0.5;
  // Interactive rows get a short "hold" beat after the tap before the snap
  // plays; rows that were never closed (own-link / no-data) just pop on mount.
  const snapDelay = interactive ? 0.15 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => { if (closed) onReveal(); }}
      onKeyDown={(e) => { if (closed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onReveal(); } }}
      role={closed ? "button" : undefined}
      tabIndex={closed ? 0 : undefined}
      className={`rounded-2xl border p-3.5 shadow-sm transition-colors ${
        closed ? `cursor-pointer bg-secondary/40 ${isNext ? "border-primary/50 ring-2 ring-primary/30" : "border-border"}` : "border-border bg-white"
      }`}
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-muted-foreground">
        {stat.icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{stat.label}</span>
        {closed && (
          <motion.span
            animate={isNext ? { opacity: [0.55, 1, 0.55] } : undefined}
            transition={isNext ? { duration: 1.3, repeat: Infinity } : undefined}
            className={`ml-auto flex items-center gap-1 text-[10px] font-semibold ${isNext ? "text-primary" : "text-muted-foreground"}`}
          >
            <Gift className="size-3" /> Tap to reveal
          </motion.span>
        )}
      </div>

      {stat.combined ? (
        closed ? (
          <p className="py-1 text-center text-lg font-bold text-muted-foreground/40">?</p>
        ) : (
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: snapDelay, type: "spring", stiffness: 260, damping: 16 }}
              className="mb-1 text-3xl">
              {stat.combined.emoji}
            </motion.div>
            <p className="text-sm font-bold">
              You two are worth <span className="font-black text-primary">{stat.combined.count}</span> {stat.combined.label}
              {" "}together! 🎉
            </p>
          </div>
        )
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">{currentUser.avatar}</div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">You</p>
                <p className={`truncate text-sm ${!closed && winner === "mine" ? "font-black text-primary" : "font-bold"}`}>
                  {stat.mineDisplay ?? "—"}
                </p>
              </div>
              {!closed && winner === "mine" && (
                <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: snapDelay, type: "spring", stiffness: 300, damping: 15 }}>
                  <Crown className="size-4 shrink-0 fill-amber-400 text-amber-500" />
                </motion.span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 text-right">
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${friendColor.bg}`}>{friendInitials}</div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Them</p>
                <p className={closed ? "text-lg font-bold text-muted-foreground/40" : `truncate text-sm ${winner === "theirs" ? "font-black text-primary" : "font-bold"}`}>
                  {closed ? "?" : stat.theirsDisplay}
                </p>
              </div>
              {!closed && winner === "theirs" && (
                <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: snapDelay, type: "spring", stiffness: 300, damping: 15 }}>
                  <Crown className="size-4 shrink-0 fill-amber-400 text-amber-500" />
                </motion.span>
              )}
            </div>
          </div>

          {!closed && isMatch && (
            <p className="mt-2 text-center text-[11px] font-semibold text-primary">🎉 Match!</p>
          )}

          {!closed && !stat.matchable && stat.mineValue !== undefined && stat.theirsValue !== undefined && (
            <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="absolute inset-y-0 left-0 bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${mineRatio * 100}%` }}
                transition={{ delay: snapDelay, type: "spring", stiffness: 260, damping: 20 }}
              />
              <motion.div
                className={`absolute inset-y-0 right-0 ${friendColor.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${(1 - mineRatio) * 100}%` }}
                transition={{ delay: snapDelay, type: "spring", stiffness: 260, damping: 20 }}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
