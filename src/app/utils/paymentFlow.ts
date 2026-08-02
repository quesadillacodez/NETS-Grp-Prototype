import { categorizeMerchant, type SpendCategory } from './spendingInsights';

export interface PaymentFlowContext {
  paymentId: string;
  hangoutId?: number;
  participantUserIds?: string[];
  reference?: string;
  /** Set when the origin of the payment already knows the category, e.g. a Hangout outing. */
  spendCategory?: SpendCategory;
}

// The category written onto the transaction so Hangout outings, split bills and
// plain QR payments all land in the right bucket on the spending dashboard.
export function resolvePaymentCategory(merchantName: string, context?: Pick<PaymentFlowContext, 'hangoutId' | 'spendCategory'>): SpendCategory {
  if (context?.spendCategory) return context.spendCategory;
  if (context?.hangoutId) return 'Entertainment';
  return categorizeMerchant(merchantName);
}

export interface SplitParticipant {
  userId?: string;
  name: string;
  avatar: string;
  amount: number;
  status: 'host' | 'pending';
}

export function createPaymentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Split money in integer cents so the participant total always equals the bill. */
export function splitAmountExactly(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count < 1) {
    throw new Error('A non-negative total and at least one participant are required.');
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, index) =>
    (baseCents + (index < remainder ? 1 : 0)) / 100,
  );
}
