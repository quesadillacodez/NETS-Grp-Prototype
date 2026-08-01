import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { BottomNav } from "../components/BottomNav";
import { getCurrentUser } from "../utils/userStorage";
import {
  getWrappedTransactions,
  getFinancialPersonality,
  getWrappedStats,
  calculateSpendingByCategory,
  getAvailableMonths,
  getSplitBillStats,
  getSpendingComparison,
  type WrappedTxn,
} from "../utils/wrappedData";
import { useAppEvents } from "../utils/useAppEvents";
import {
  Sparkles, TrendingUp, TrendingDown, ShoppingBag, Award, Calendar,
  ChevronLeft, ChevronRight, DollarSign, UserX, Clock, Bell, Eye, EyeOff,
  Share2, Users, Play, Pause,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import confetti from "canvas-confetti";

// Literal gradients (this app doesn't define the --gradient-* CSS vars)
const G = {
  blue: "from-[#2563eb] via-[#4f46e5] to-[#0028a8]",
  purple: "from-[#8b5cf6] via-[#d946ef] to-[#ec4899]",
  orange: "from-[#fbbf24] via-[#f97316] to-[#ef4444]",
  red: "from-[#f43f5e] via-[#e11d48] to-[#9f1239]",
  teal: "from-[#06b6d4] via-[#14b8a6] to-[#16a34a]",
};

// Soft drifting blobs that give every slide subtle life in the background.
function FloatingBlobs() {
  const blobs = [
    { size: 140, top: "8%", left: "-12%", delay: 0, dur: 9 },
    { size: 90, top: "62%", left: "72%", delay: 1.5, dur: 11 },
    { size: 60, top: "78%", left: "10%", delay: 0.8, dur: 8 },
    { size: 40, top: "18%", left: "82%", delay: 2.2, dur: 10 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/10 blur-xl"
          style={{ width: b.size, height: b.size, top: b.top, left: b.left }}
          animate={{ y: [0, -18, 0], x: [0, 12, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// Floating sparkle particles for celebratory slides.
function SparkleField({ count = 10 }: { count?: number }) {
  const parts = Array.from({ length: count }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53) % 100}%`,
    delay: (i % 5) * 0.4,
    size: 6 + (i % 3) * 4,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
      {parts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: p.left, top: p.top }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 90, 0] }}
          transition={{ duration: 2.4, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles style={{ width: p.size, height: p.size }} className="text-white/50" />
        </motion.div>
      ))}
    </div>
  );
}

// Animated count-up for the big hero numbers.
function CountUp({ value, prefix = "", decimals = 0, className }: { value: number; prefix?: string; decimals?: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{prefix}{display.toFixed(decimals)}</span>;
}

// Slow-rotating decorative ring behind slide content — very "Wrapped".
function SpinRing({ size = 230, reverse = false, top = "42%" }: { size?: number; reverse?: boolean; top?: string }) {
  return (
    <motion.div
      className="absolute rounded-full border-2 border-dashed border-white/20 pointer-events-none"
      style={{ width: size, height: size, left: "50%", top, marginLeft: -size / 2, marginTop: -size / 2 }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
    />
  );
}

// A diagonal band of light that periodically sweeps across the slide.
function LightSweep() {
  return (
    <motion.div
      className="absolute top-0 bottom-0 w-1/3 pointer-events-none"
      style={{ background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.18), transparent)" }}
      animate={{ x: ["-150%", "420%"] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.6 }}
    />
  );
}

// Headline words pop in one-by-one with a springy bounce.
function StaggerWords({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={i}
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 22, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: delay + i * 0.09, type: "spring", stiffness: 300, damping: 18 }}
        >
          {w}{" "}
        </motion.span>
      ))}
    </span>
  );
}

// Instagram/Spotify-story style progress segments across the top.
function StoryProgress({ total, current, isPlaying }: { total: number; current: number; isPlaying: boolean }) {
  return (
    <div className="flex gap-1 px-4 pt-3 shrink-0">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full bg-black/10 overflow-hidden">
          {i < current && <div className="h-full w-full bg-primary rounded-full" />}
          {i === current && (isPlaying
            ? <motion.div key={`fill-${current}`} className="h-full bg-primary rounded-full" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 4, ease: "linear" }} />
            : <div className="h-full w-full bg-primary rounded-full" />)}
        </div>
      ))}
    </div>
  );
}

// The full slide order. The component builds its actual deck from this,
// skipping any slide whose data is empty (so no blank slides ever show).
const SLIDE_ORDER = [
  "intro", "personality", "total-spent", "transactions", "top-category",
  "biggest-purchase", "top-merchant", "most-paid", "biggest-debtor",
  "slowest-payer", "most-reminders", "summary",
] as const;

type EnabledStats = {
  personality: boolean; totalSpent: boolean; transactions: boolean;
  topCategory: boolean; biggestPurchase: boolean; topMerchant: boolean;
  mostPaid: boolean; biggestDebtor: boolean; slowestPayer: boolean;
  mostReminders: boolean;
};

type WrappedSlideProps = {
  gradient: string;
  statKey?: keyof EnabledStats;
  enabledStats: EnabledStats;
  toggleStat: (key: keyof EnabledStats) => void;
  animationType?: "slide" | "scale";
  padding?: string;
  slideRef?: React.RefObject<HTMLDivElement>;
  onShare?: () => void;
  isCapturing?: boolean;
  showEyeHint?: boolean;
  onDismissEyeHint?: () => void;
  children: React.ReactNode;
};

function WrappedSlide({
  gradient, statKey, enabledStats, toggleStat, animationType = "slide",
  padding = "p-10", slideRef, onShare, isCapturing, showEyeHint, onDismissEyeHint, children,
}: WrappedSlideProps) {
  const anim = animationType === "scale"
    ? { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };

  return (
    <motion.div ref={slideRef} {...anim}
      className={`relative overflow-hidden text-center bg-gradient-to-br ${gradient} text-white ${padding} rounded-3xl shadow-2xl max-w-md w-full`}>
      <FloatingBlobs />
      <SpinRing size={250} top="45%" />
      <SpinRing size={160} reverse top="40%" />
      <LightSweep />
      <button onClick={(e) => { e.stopPropagation(); onShare?.(); }} disabled={isCapturing}
        className="absolute top-4 left-4 z-10 size-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50">
        {isCapturing
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="size-4 border-2 border-white border-t-transparent rounded-full" />
          : <Share2 className="size-5" />}
      </button>

      {statKey && (
        <button onClick={(e) => { e.stopPropagation(); toggleStat(statKey); }}
          className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          {enabledStats[statKey] ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
        </button>
      )}

      <AnimatePresence>
        {statKey && showEyeHint && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ delay: 0.6 }}
            className="absolute top-16 right-4 w-48 bg-white rounded-2xl shadow-xl px-4 py-3 text-left z-10" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-2 right-4 size-4 bg-white rotate-45 rounded-sm" />
            <p className="text-gray-700 text-xs leading-snug">Tap the eye to hide any stat from your shareable summary.</p>
            <button onClick={(e) => { e.stopPropagation(); onDismissEyeHint?.(); }} className="mt-2 text-xs font-semibold text-primary">Got it</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-[1]">{children}</div>
    </motion.div>
  );
}

export function WrappedPage() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasSeenEyeHint, setHasSeenEyeHint] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [txnsData, setTxnsData] = useState<WrappedTxn[]>(() => getWrappedTransactions(getCurrentUser().id));
  const summaryRef = useRef<HTMLDivElement>(null);
  const currentSlideRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const didSwipeRef = useRef(false);

  // Reload from DB when the user switches or data changes.
  useAppEvents(["userSwitched", "transactionsUpdated", "remindersUpdated", "databaseReady", "focus"], () => {
    const u = getCurrentUser();
    setCurrentUser(u);
    setTxnsData(getWrappedTransactions(u.id));
  });

  const txns = txnsData;
  const availableMonths = getAvailableMonths(txns);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const clampedIndex = Math.min(selectedMonthIndex, availableMonths.length - 1);
  const selectedMonth = availableMonths[clampedIndex] || { year: new Date().getFullYear(), month: new Date().getMonth() };

  const [enabledStats, setEnabledStats] = useState<EnabledStats>({
    personality: true, totalSpent: true, transactions: true, topCategory: true,
    biggestPurchase: true, topMerchant: true, mostPaid: true, biggestDebtor: true,
    slowestPayer: true, mostReminders: true,
  });

  const personality = getFinancialPersonality(selectedMonth.year, selectedMonth.month, txns);
  const stats = getWrappedStats(selectedMonth.year, selectedMonth.month, txns);
  const categories = calculateSpendingByCategory(selectedMonth.year, selectedMonth.month, txns);
  const splitBillStats = getSplitBillStats(currentUser.id, selectedMonth.year, selectedMonth.month);
  const comparison = getSpendingComparison(selectedMonth.year, selectedMonth.month, txns);
  const monthName = format(new Date(selectedMonth.year, selectedMonth.month), "MMMM yyyy");

  // Build the actual deck for this user + month — skip any slide with no data
  // so nothing ever renders blank.
  const slides = SLIDE_ORDER.filter((s) => {
    if (s === "top-category") return categories.length > 0;
    if (s === "biggest-purchase") return !!stats.biggestPurchase;
    if (s === "biggest-debtor") return !!splitBillStats?.biggestDebtor;
    if (s === "slowest-payer") return !!splitBillStats?.slowestPayer;
    if (s === "most-reminders") return !!splitBillStats?.mostReminders;
    return true;
  });

  // If the deck shrank (month/user change), keep the index in range.
  useEffect(() => {
    if (currentSlide > slides.length - 1) setCurrentSlide(Math.max(0, slides.length - 1));
  }, [slides.length, currentSlide]);

  const toggleStat = (s: keyof EnabledStats) => setEnabledStats((p) => ({ ...p, [s]: !p[s] }));

  const goToPreviousMonth = () => { if (clampedIndex < availableMonths.length - 1) { setSelectedMonthIndex(clampedIndex + 1); setCurrentSlide(0); } };
  const goToNextMonth = () => { if (clampedIndex > 0) { setSelectedMonthIndex(clampedIndex - 1); setCurrentSlide(0); } };
  const nextSlide = () => { setIsPlaying(false); if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1); };
  const prevSlide = () => { setIsPlaying(false); if (currentSlide > 0) setCurrentSlide(currentSlide - 1); };
  const startWrapped = () => { setHasStarted(true); setCurrentSlide(0); };
  const restart = () => { setHasStarted(false); setCurrentSlide(0); };

  useEffect(() => {
    if (!isPlaying) return;
    if (currentSlide === slides.length - 1) { setIsPlaying(false); return; }
    const timer = setInterval(() => setCurrentSlide((p) => Math.min(p + 1, slides.length - 1)), 4000);
    return () => clearInterval(timer);
  }, [isPlaying, currentSlide]);

  useEffect(() => {
    if (!hasStarted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") nextSlide(); if (e.key === "ArrowLeft") prevSlide(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasStarted, currentSlide]);

  // Celebratory confetti on the personality reveal and the final summary.
  useEffect(() => {
    if (!hasStarted) return;
    const slide = slides[currentSlide];
    if (slide === "personality") {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ["#a855f7", "#ec4899", "#fbbf24", "#38bdf8"] });
    } else if (slide === "summary") {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.35 }, colors: ["#0040ff", "#a855f7", "#ec4899", "#fbbf24", "#22c55e"] });
    }
  }, [currentSlide, hasStarted]);

  const handleSlideAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - left) / width;
    if (ratio >= 0.4) nextSlide(); else prevSlide();
  };
  const handleTouchStart = (e: React.TouchEvent) => { touchStartXRef.current = e.touches[0].clientX; didSwipeRef.current = false; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(delta) >= 50) { didSwipeRef.current = true; if (delta < 0) nextSlide(); else prevSlide(); }
  };
  const handleSlideAreaClickWithSwipeGuard = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didSwipeRef.current) { didSwipeRef.current = false; return; }
    handleSlideAreaClick(e);
  };

  const captureAndShare = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `My ${monthName} NETS Wrapped` });
          return;
        }
      }
      const link = document.createElement("a");
      link.download = filename; link.href = dataUrl; link.click();
      toast.success("Image saved!", { description: "Your Wrapped screenshot has been downloaded." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("cancel") && !msg.includes("abort")) toast.error("Couldn't capture screenshot.");
    } finally { setIsCapturing(false); }
  };

  const handleShare = () => captureAndShare(summaryRef, `nets-wrapped-${monthName.replace(/ /g, "-")}.png`);

  // ── Start / empty screen ──────────────────────────────────────────────────
  if (!hasStarted) {
    const shell = (children: React.ReactNode) => (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white via-primary/5 to-secondary overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            {children}
          </motion.div>
        </div>
        <BottomNav />
      </div>
    );

    if (txns.length === 0) return shell(
      <div className="flex flex-col items-center gap-4 max-w-xs">
        <Sparkles className="size-14 text-muted-foreground/40" />
        <p className="text-lg font-medium text-foreground">No spending yet</p>
        <p className="text-sm text-muted-foreground">
          Make a few payments and they'll show up in your Wrapped. Come back once you have some transactions!
        </p>
      </div>
    );

    return shell(
      <>
        <div className="mb-8">
          <motion.div animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.1, 1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }} className="inline-block">
            <Sparkles className="size-20 text-primary mb-4 mx-auto" />
          </motion.div>
          <motion.h1
            className="text-4xl mb-1 font-black bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #2563eb, #8b5cf6, #ec4899, #f97316, #2563eb)", backgroundSize: "300% 100%" }}
            animate={{ backgroundPosition: ["0% 50%", "300% 50%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          >Your NETS</motion.h1>
          <motion.h1
            className="text-4xl mb-4 font-black bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #2563eb, #8b5cf6, #ec4899, #f97316, #2563eb)", backgroundSize: "300% 100%" }}
            animate={{ backgroundPosition: ["0% 50%", "300% 50%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          >Wrapped</motion.h1>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">Discover your spending story, {currentUser.name.split(" ")[0]}</p>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} disabled={clampedIndex >= availableMonths.length - 1}>
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-[160px] text-center"><p className="text-lg font-medium">{monthName}</p></div>
            <Button variant="outline" size="icon" onClick={goToNextMonth} disabled={clampedIndex <= 0}>
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
        <motion.div
          animate={{ y: [0, -4, 0], boxShadow: ["0 8px 24px -6px rgba(139,92,246,0.45)", "0 14px 34px -6px rgba(236,72,153,0.55)", "0 8px 24px -6px rgba(139,92,246,0.45)"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block rounded-xl"
        >
          <Button size="lg" onClick={startWrapped} className="bg-gradient-to-r from-[#2563eb] via-[#8b5cf6] to-[#ec4899] hover:opacity-90 text-white border-0">
            <Sparkles className="size-5 mr-2" /> See My Wrapped
          </Button>
        </motion.div>
      </>
    );
  }

  const slideFilename = `nets-wrapped-${monthName.replace(/ /g, "-")}-${slides[currentSlide]}.png`;
  const slideProps = { enabledStats, toggleStat, slideRef: currentSlideRef, isCapturing, onShare: () => captureAndShare(currentSlideRef, slideFilename) };

  return (
    <div className="flex flex-col bg-gradient-to-br from-white via-primary/5 to-secondary h-full">
      <StoryProgress total={slides.length} current={currentSlide} isPlaying={isPlaying} />
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto"
        onClick={handleSlideAreaClickWithSwipeGuard} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence mode="wait">

          {slides[currentSlide] === "intro" && (
            <WrappedSlide key="intro" gradient={personality.color} {...slideProps}>
              <SparkleField count={10} />
              <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }} className="inline-block">
                <Sparkles className="size-16 mb-6 mx-auto" />
              </motion.div>
              <h2 className="text-3xl mb-4 font-black"><StaggerWords text="Ready to discover" delay={0.15} /></h2>
              <h2 className="text-3xl mb-6 font-black"><StaggerWords text={`your ${monthName} story?`} delay={0.45} /></h2>
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-white/90 text-lg">Let's dive in...</motion.p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "personality" && (
            <WrappedSlide key="personality" gradient={personality.color} statKey="personality" animationType="scale" showEyeHint={!hasSeenEyeHint} onDismissEyeHint={() => setHasSeenEyeHint(true)} {...slideProps}>
              <SparkleField count={12} />
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="relative inline-block">
                <motion.div className="absolute inset-0 rounded-full bg-white/30 blur-xl" animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }} />
                <Award className="size-20 mb-6 mx-auto relative" />
              </motion.div>
              <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-4xl mb-4 font-black">{personality.title}</motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white/90 text-lg mb-4">{personality.description}</motion.p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "total-spent" && (
            <WrappedSlide key="total-spent" gradient={G.blue} statKey="totalSpent" {...slideProps}>
              <TrendingUp className="size-14 mb-4 mx-auto" />
              <p className="text-white/90 mb-3 text-lg">You spent a total of</p>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ duration: 0.6, times: [0, 0.7, 1] }} className="text-6xl mb-2 font-black drop-shadow-lg">
                <motion.span className="inline-block" animate={{ scale: [1, 1.045, 1] }} transition={{ duration: 1.6, repeat: Infinity, delay: 1.4, ease: "easeInOut" }}>
                  <CountUp value={stats.totalSpent} prefix="$" decimals={0} />
                </motion.span>
              </motion.div>
              <p className="text-white/80 mb-5">${stats.avgPerDay.toFixed(2)} per day on average</p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-2">
                {comparison.lastMonthTotal > 0 && (
                  <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      {comparison.vsLastMonth.amount >= 0 ? <TrendingUp className="size-4 text-red-300" /> : <TrendingDown className="size-4 text-green-300" />}
                      <span>vs last month</span>
                    </div>
                    <span className={`text-sm font-medium ${comparison.vsLastMonth.amount >= 0 ? "text-red-300" : "text-green-300"}`}>
                      {comparison.vsLastMonth.amount >= 0 ? "+" : ""}${Math.abs(comparison.vsLastMonth.amount).toFixed(0)} ({comparison.vsLastMonth.percent >= 0 ? "+" : ""}{comparison.vsLastMonth.percent.toFixed(0)}%)
                    </span>
                  </div>
                )}
                {comparison.personalAverage && (
                  <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-white/80 text-sm"><Users className="size-4" /><span>vs your 3-month avg</span></div>
                    <span className={`text-sm font-medium ${comparison.vsPersonalAverage.amount >= 0 ? "text-red-300" : "text-green-300"}`}>
                      {comparison.vsPersonalAverage.amount >= 0 ? "+" : ""}${Math.abs(comparison.vsPersonalAverage.amount).toFixed(0)} ({comparison.vsPersonalAverage.percent >= 0 ? "+" : ""}{comparison.vsPersonalAverage.percent.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </motion.div>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "transactions" && (
            <WrappedSlide key="transactions" gradient={G.purple} statKey="transactions" {...slideProps}>
              <Calendar className="size-14 mb-4 mx-auto" />
              <p className="text-white/90 mb-3 text-lg">You made</p>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ duration: 0.6, times: [0, 0.7, 1] }} className="text-6xl mb-2 font-black drop-shadow-lg">
                <motion.span className="inline-block" animate={{ scale: [1, 1.045, 1] }} transition={{ duration: 1.6, repeat: Infinity, delay: 1.4, ease: "easeInOut" }}>
                  <CountUp value={stats.totalTransactions} decimals={0} />
                </motion.span>
              </motion.div>
              <p className="text-white/80 mb-5">transactions in {monthName}</p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-2">
                {comparison.personalAverage && (
                  <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-white/80 text-sm"><Users className="size-4" /><span>your 3-month average</span></div>
                    <span className="text-sm font-medium text-white">{comparison.personalAverage.transactions.toFixed(1)} transactions</span>
                  </div>
                )}
              </motion.div>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "top-category" && categories.length > 0 && (
            <WrappedSlide key="top-category" gradient={G.orange} statKey="topCategory" {...slideProps}>
              <ShoppingBag className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">Your top spending category</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-5xl mb-4">{categories[0].name}</motion.h2>
              <p className="text-white/90 text-lg">${categories[0].value.toFixed(2)} spent</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "biggest-purchase" && stats.biggestPurchase && (
            <WrappedSlide key="biggest-purchase" gradient={G.red} statKey="biggestPurchase" {...slideProps}>
              <Award className="size-14 mb-4 mx-auto" />
              <p className="text-white/90 mb-3 text-lg">Your biggest purchase</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-2">{stats.biggestPurchase.merchant}</motion.h2>
              <p className="text-white/80 text-2xl mb-5">${Math.abs(stats.biggestPurchase.amount).toFixed(2)}</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "top-merchant" && (
            <WrappedSlide key="top-merchant" gradient={G.teal} statKey="topMerchant" {...slideProps}>
              <Sparkles className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">You visited</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-4">{stats.topMerchant.name}</motion.h2>
              <p className="text-white/90 text-lg">{stats.topMerchant.count} times in {monthName}</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "most-paid" && (
            <WrappedSlide key="most-paid" gradient={G.blue} statKey="mostPaid" {...slideProps}>
              <DollarSign className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">You paid the most to</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-4">{stats.mostPaidPerson.name}</motion.h2>
              <p className="text-white/90 text-2xl">${stats.mostPaidPerson.amount.toFixed(2)}</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "biggest-debtor" && splitBillStats?.biggestDebtor && (
            <WrappedSlide key="biggest-debtor" gradient={G.red} statKey="biggestDebtor" {...slideProps}>
              <UserX className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">{splitBillStats.biggestDebtor.settled ? "Who owed you the most?" : "Who owes you the most?"}</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-4">{splitBillStats.biggestDebtor.name}</motion.h2>
              <p className="text-white/90 text-2xl">${splitBillStats.biggestDebtor.amount.toFixed(2)}</p>
              <p className="text-white/70 text-sm mt-2">{splitBillStats.biggestDebtor.settled ? "All paid up now 🎉" : "Still waiting on this one..."}</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "slowest-payer" && splitBillStats?.slowestPayer && (
            <WrappedSlide key="slowest-payer" gradient={G.orange} statKey="slowestPayer" {...slideProps}>
              <Clock className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">Slowest to pay you back</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-4">{splitBillStats.slowestPayer.name}</motion.h2>
              <p className="text-white/90 text-2xl">{Math.round(splitBillStats.slowestPayer.avgDays)} days average</p>
              <p className="text-white/70 text-sm mt-2">Patience is a virtue!</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "most-reminders" && splitBillStats?.mostReminders && (
            <WrappedSlide key="most-reminders" gradient={G.purple} statKey="mostReminders" {...slideProps}>
              <Bell className="size-16 mb-6 mx-auto" />
              <p className="text-white/90 mb-4 text-lg">Needs the most reminders</p>
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-4xl mb-4">{splitBillStats.mostReminders.name}</motion.h2>
              <p className="text-white/90 text-2xl">{splitBillStats.mostReminders.totalReminders} reminders sent</p>
              <p className="text-white/70 text-sm mt-2">Ring ring! 🔔</p>
            </WrappedSlide>
          )}

          {slides[currentSlide] === "summary" && (
            <motion.div key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center max-w-md w-full">
              <Card className="border-0 shadow-2xl overflow-hidden">
                <div ref={summaryRef} className="p-8 rounded-t-2xl" style={{ background: "linear-gradient(135deg, #0040ff 0%, #0028a8 100%)" }}>
                  <div className="inline-flex items-center justify-center size-16 rounded-full bg-white/20 mb-4 mx-auto"><Sparkles className="size-8 text-white" /></div>
                  <h2 className="text-3xl mb-1 text-white">Your NETS Wrapped</h2>
                  <p className="text-white/60 mb-6 text-sm">{monthName} · {currentUser.name}</p>
                  <div className="space-y-2 text-left">
                    {enabledStats.personality && <SummaryRow label="Personality" value={personality.title} />}
                    {enabledStats.totalSpent && <SummaryRow label="Total Spent" value={`$${stats.totalSpent.toFixed(2)}`} />}
                    {enabledStats.transactions && <SummaryRow label="Transactions" value={String(stats.totalTransactions)} />}
                    {enabledStats.topCategory && categories.length > 0 && <SummaryRow label="Top Category" value={categories[0].name} />}
                    {enabledStats.biggestPurchase && stats.biggestPurchase && <SummaryRow label="Biggest Purchase" value={stats.biggestPurchase.merchant} />}
                    {enabledStats.topMerchant && <SummaryRow label="Top Merchant" value={stats.topMerchant.name} />}
                    {enabledStats.mostPaid && <SummaryRow label="Most Paid To" value={stats.mostPaidPerson.name} />}
                    {splitBillStats?.biggestDebtor && enabledStats.biggestDebtor && <SummaryRow label="Biggest Debtor" value={splitBillStats.biggestDebtor.name} />}
                    {splitBillStats?.slowestPayer && enabledStats.slowestPayer && <SummaryRow label="Slowest Payer" value={splitBillStats.slowestPayer.name} />}
                    {splitBillStats?.mostReminders && enabledStats.mostReminders && <SummaryRow label="Most Reminders" value={splitBillStats.mostReminders.name} />}
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-1.5">
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-xs font-bold tracking-widest text-white/50">NETS</span>
                    <div className="h-px flex-1 bg-white/20" />
                  </div>
                </div>
                <div className="px-8 pb-8 space-y-3 bg-white">
                  <Button onClick={handleShare} disabled={isCapturing} className="w-full bg-gradient-to-r from-[#0040ff] to-[#0028a8] hover:opacity-90 disabled:opacity-60 text-white">
                    {isCapturing
                      ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="size-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Capturing...</>
                      : <><Share2 className="size-4 mr-2" />Share</>}
                  </Button>
                  <div className="flex gap-3">
                    <Button onClick={restart} variant="outline" className="flex-1">View Again</Button>
                    <Button onClick={() => { setHasStarted(false); setCurrentSlide(0); }} variant="outline" className="flex-1">Change Month</Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <div className="shrink-0 p-4 space-y-3 border-t border-border bg-white">
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground font-medium tabular-nums">{currentSlide + 1} / {slides.length}</span>
          <button onClick={() => setIsPlaying((p) => !p)} className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevSlide} disabled={currentSlide === 0} className="flex-1">Previous</Button>
          <button onClick={nextSlide} disabled={currentSlide === slides.length - 1}
            className="flex-1 rounded-md px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(to right, #0040ff, #0028a8)" }}>Next</button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
      <span className="text-white/80 text-sm">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}
