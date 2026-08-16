import type { User } from './userStorage';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

interface SessionResponse {
  authenticated: boolean;
  user?: User;
}

export interface RecoveryStartResponse {
  challengeId: string;
  destination: string;
  expiresIn: number;
  demoCode?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? 'GET';
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && method !== 'HEAD' ? { 'X-NETS-CSRF': '1' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || 'The secure service is unavailable.', response.status, body.retryAfter);
  return body as T;
}

export function getServerSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/api/session');
}

export async function serverLogin(loginId: string, pin: string): Promise<User> {
  const response = await request<{ user: User }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ loginId, pin }),
  });
  return response.user;
}

export function serverLogout(): Promise<{ ok: true }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function startPinRecovery(loginId: string, phone: string): Promise<RecoveryStartResponse> {
  return request('/api/auth/recovery/start', {
    method: 'POST', body: JSON.stringify({ loginId, phone }),
  });
}

export function verifyPinRecovery(challengeId: string, code: string): Promise<{ resetToken: string; expiresIn: number }> {
  return request('/api/auth/recovery/verify', {
    method: 'POST', body: JSON.stringify({ challengeId, code }),
  });
}

export function resetPinWithToken(resetToken: string, newPin: string): Promise<{ ok: true }> {
  return request('/api/auth/recovery/reset', {
    method: 'POST', body: JSON.stringify({ resetToken, newPin }),
  });
}

export function changeServerPin(currentPin: string, newPin: string): Promise<{ ok: true }> {
  return request('/api/auth/change-pin', {
    method: 'POST', body: JSON.stringify({ currentPin, newPin }),
  });
}
