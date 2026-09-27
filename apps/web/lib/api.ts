// Small fetch wrapper for the Express API.
//
// Auth model:
//  - The short-lived access token lives only in memory (this module), never in
//    localStorage, so injected scripts cannot steal a long-lived credential.
//  - The refresh token is an HttpOnly cookie set by the API; we never see it.
//    `credentials: 'include'` makes the browser send it to /api/auth/*.
//  - When a request fails with 401, we refresh once and retry.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Role = 'TRAINEE' | 'TRAINER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  designation: string | null;
  role: Role;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
  createdAt: string;
  institute: { id: string; code: string; name: string } | null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<User | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

// Exchanges the refresh cookie for a new access token. Returns null if not logged in.
//
// Refresh tokens are single-use, so two refreshes racing with the same cookie would
// look like token theft to the server (and log the user out everywhere). To avoid that:
//  - within a tab, concurrent callers share one in-flight request;
//  - across tabs, the Web Locks API makes tabs take turns, so the second tab
//    sends the already-rotated cookie.
export function refreshSession(): Promise<User | null> {
  refreshInFlight ??= withRefreshLock(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      const data = await parse<{ accessToken: string; user: User }>(res);
      accessToken = data.accessToken;
      return data.user;
    } catch {
      accessToken = null;
      return null;
    }
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('cc-refresh', fn);
  }
  return fn();
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await send();
  // Access token missing or expired: try one refresh, then retry the request once.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const user = await refreshSession();
    if (user) res = await send();
  }
  return parse<T>(res);
}
