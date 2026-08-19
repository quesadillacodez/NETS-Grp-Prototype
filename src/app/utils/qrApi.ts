import { ApiError } from './serverApi';

export type PaymentIntentStatus = 'created' | 'paid' | 'cancelled' | 'expired';

export interface PaymentIntent {
  paymentId: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  reference?: string;
  itemId?: number;
  itemName?: string;
  status: PaymentIntentStatus;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
}

export interface VoucherClaim {
  redemptionId: number;
  ownerUserId: string;
  title: string;
  merchant: string;
  merchantId?: string;
  refCode: string;
  status: 'active' | 'used' | 'expired' | 'superseded';
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

export interface PaymentIntentCreation extends PaymentIntent {
  openUrl: string;
}

export interface VoucherClaimCreation extends VoucherClaim {
  openUrl: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? 'GET';
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && method !== 'HEAD' ? { 'X-NETS-CSRF': '1' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || 'The QR service is unavailable.', response.status, body.retryAfter);
  }
  return body as T;
}

export function createPaymentIntent(input: {
  merchantId: string;
  merchantName: string;
  amount: number;
  reference?: string;
  itemId?: number;
  itemName?: string;
  expiresInMinutes?: number;
}): Promise<PaymentIntentCreation> {
  return request('/api/payment-intents', { method: 'POST', body: JSON.stringify(input) });
}

export function getPaymentIntent(token: string): Promise<PaymentIntent> {
  return request(`/api/payment-intents/${encodeURIComponent(token)}`);
}

export function confirmPaymentIntent(token: string): Promise<PaymentIntent> {
  return request(`/api/payment-intents/${encodeURIComponent(token)}/confirm`, { method: 'POST' });
}

export function cancelPaymentIntent(token: string): Promise<PaymentIntent> {
  return request(`/api/payment-intents/${encodeURIComponent(token)}/cancel`, { method: 'POST' });
}

export function createVoucherClaim(input: {
  redemptionId: number;
  rewardId: number;
  title: string;
  merchant: string;
  merchantId?: string;
  refCode: string;
  expiresAt: number;
}): Promise<VoucherClaimCreation> {
  return request('/api/voucher-claims', { method: 'POST', body: JSON.stringify(input) });
}

export function getVoucherClaim(token: string): Promise<VoucherClaim> {
  return request(`/api/voucher-claims/${encodeURIComponent(token)}`);
}

export function consumeVoucherClaim(token: string): Promise<VoucherClaim> {
  return request(`/api/voucher-claims/${encodeURIComponent(token)}/redeem`, { method: 'POST' });
}
