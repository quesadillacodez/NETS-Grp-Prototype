// Encodes a Wrapped "compare" payload directly into a shareable URL. This app
// is fully client-side (sql.js persisted to IndexedDB, no backend), so there
// is no server to look an ID up against — the entire payload travels in the
// link itself. Only the stats the sharer left visible (via the existing
// eye/EyeOff toggle) are included; biggestDebtor/slowestPayer/mostReminders
// are deliberately never included since they name a real contact in a
// debt/reminder context and aren't meaningful to compare against a stranger.

export interface WrappedShareEnabledFlags {
  personality: boolean;
  totalSpent: boolean;
  transactions: boolean;
  topCategory: boolean;
  biggestPurchase: boolean;
  topMerchant: boolean;
  mostPaid: boolean;
}

export interface WrappedSharePayload {
  v: 1;
  u: string; // sharer's display name
  y: number; // year
  m: number; // month (0-indexed)
  p?: { t: string; d: string }; // personality: title, description
  ts?: number; // totalSpent
  tx?: number; // totalTransactions
  tc?: { n: string; v: number }; // topCategory: name, value
  bp?: { n: string; a: number }; // biggestPurchase: merchant, amount
  tm?: { n: string; c: number }; // topMerchant: name, visit count
  mp?: { n: string; a: number }; // mostPaid: merchant name, amount
}

const SCHEMA_VERSION = 1 as const;

export function buildSharePayload(args: {
  userName: string;
  year: number;
  month: number;
  enabled: WrappedShareEnabledFlags;
  personalityTitle: string;
  personalityDescription: string;
  totalSpent: number;
  totalTransactions: number;
  topCategoryName?: string;
  topCategoryValue?: number;
  biggestPurchaseMerchant?: string;
  biggestPurchaseAmount?: number;
  topMerchantName: string;
  topMerchantCount: number;
  mostPaidName: string;
  mostPaidAmount: number;
}): WrappedSharePayload {
  const payload: WrappedSharePayload = { v: SCHEMA_VERSION, u: args.userName, y: args.year, m: args.month };
  if (args.enabled.personality) payload.p = { t: args.personalityTitle, d: args.personalityDescription };
  if (args.enabled.totalSpent) payload.ts = args.totalSpent;
  if (args.enabled.transactions) payload.tx = args.totalTransactions;
  if (args.enabled.topCategory && args.topCategoryName) payload.tc = { n: args.topCategoryName, v: args.topCategoryValue ?? 0 };
  if (args.enabled.biggestPurchase && args.biggestPurchaseMerchant) payload.bp = { n: args.biggestPurchaseMerchant, a: args.biggestPurchaseAmount ?? 0 };
  if (args.enabled.topMerchant) payload.tm = { n: args.topMerchantName, c: args.topMerchantCount };
  if (args.enabled.mostPaid) payload.mp = { n: args.mostPaidName, a: args.mostPaidAmount };
  return payload;
}

export function encodeWrappedShare(payload: WrappedSharePayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isValidPayload(obj: unknown): obj is WrappedSharePayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return o.v === SCHEMA_VERSION && typeof o.u === "string" && typeof o.y === "number" && typeof o.m === "number";
}

export function decodeWrappedShare(encoded: string | null | undefined): WrappedSharePayload | null {
  if (!encoded) return null;
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return isValidPayload(obj) ? obj : null;
  } catch {
    return null; // Never throw on malformed/garbage input.
  }
}

export function buildCompareUrl(payload: WrappedSharePayload): string {
  return `${window.location.origin}/wrapped/compare?d=${encodeWrappedShare(payload)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
