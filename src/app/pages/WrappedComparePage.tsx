import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Sparkles, Home, ArrowLeftRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getCurrentUser } from "../utils/userStorage";
import { getWrappedTransactions, getFinancialPersonality, getWrappedStats, calculateSpendingByCategory } from "../utils/wrappedData";
import { decodeWrappedShare } from "../utils/wrappedShare";
import { format } from "date-fns";

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

  const monthName = format(new Date(payload.y, payload.m), "MMMM yyyy");
  const isOwnLink = currentUser.name === payload.u;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-br from-white via-primary/5 to-secondary">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 text-white"
        style={{ background: "linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%)" }}
      >
        <div className="mb-2 inline-flex size-10 items-center justify-center rounded-full bg-white/20">
          <ArrowLeftRight className="size-5" />
        </div>
        <h1 className="text-xl font-black">You vs {payload.u}</h1>
        <p className="text-xs text-white/70">{monthName} · NETS Wrapped Compare</p>
      </motion.div>

      {isOwnLink && (
        <div className="mx-4 mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
          This looks like your own link — share it with a friend to see how their month compares!
        </div>
      )}

      {!receiverHasData && (
        <div className="mx-4 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          You don't have NETS activity for {monthName} yet — showing {payload.u}'s Wrapped only. Make some payments this month to compare!
        </div>
      )}

      <div className="flex-1 space-y-2 p-4">
        {payload.p && (
          <CompareRow label="Personality" mine={receiverHasData ? receiverPersonality?.title : undefined} theirs={payload.p.t} />
        )}
        {payload.ts !== undefined && (
          <CompareRow
            label="Total Spent"
            mine={receiverHasData ? `$${receiverStats!.totalSpent.toFixed(2)}` : undefined}
            theirs={`$${payload.ts.toFixed(2)}`}
          />
        )}
        {payload.tx !== undefined && (
          <CompareRow
            label="Transactions"
            mine={receiverHasData ? String(receiverStats!.totalTransactions) : undefined}
            theirs={String(payload.tx)}
          />
        )}
        {payload.tc && (
          <CompareRow label="Top Category" mine={receiverHasData ? receiverCategories[0]?.name : undefined} theirs={payload.tc.n} />
        )}
        {payload.bp && (
          <CompareRow
            label="Biggest Purchase"
            mine={receiverHasData ? receiverStats!.biggestPurchase?.merchant : undefined}
            theirs={payload.bp.n}
          />
        )}
        {payload.tm && (
          <CompareRow label="Top Merchant" mine={receiverHasData ? receiverStats!.topMerchant.name : undefined} theirs={payload.tm.n} />
        )}
        {payload.mp && (
          <CompareRow label="Most Paid To" mine={receiverHasData ? receiverStats!.mostPaidPerson.name : undefined} theirs={payload.mp.n} />
        )}
      </div>

      <div className="space-y-2 border-t border-border bg-white p-4">
        <Button className="w-full" onClick={() => navigate("/wrapped")}>View My Wrapped</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/")}>
          <Home className="mr-2 size-4" /> Exit to Home
        </Button>
      </div>
    </div>
  );
}

function CompareRow({ label, mine, theirs }: { label: string; mine?: string; theirs: string }) {
  return (
    <Card className="border-0 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground">You</p>
          <p className="truncate text-sm font-bold">{mine ?? "—"}</p>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] text-muted-foreground">Them</p>
          <p className="truncate text-sm font-bold">{theirs}</p>
        </div>
      </div>
    </Card>
  );
}
