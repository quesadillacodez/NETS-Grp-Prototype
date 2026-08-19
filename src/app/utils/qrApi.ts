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

export interface PaymentIntentCreation extends PaymentIntent {
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
