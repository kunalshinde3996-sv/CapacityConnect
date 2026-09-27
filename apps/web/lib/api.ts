// Small fetch wrapper for the Express API.
//
// Auth model:
//  - The short-lived access token lives only in memory (this module), never in
//    localStorage, so injected scripts cannot steal a long-lived credential.
//  - The refresh token is an HttpOnly cookie set by the API; we never see it.
//    `credentials: 'include'` makes the browser send it to /api/auth/*.
//  - When a request fails with 401, we refresh once and retry.
//  - All URLs are relative (/api/...): Next.js proxies them to the Express API
//    (see next.config.ts), so the cookie belongs to this site.

// Uploads and file downloads go straight to the API (not through the /api proxy), so
// large files are never limited by the web host's proxy. Public, not a secret.
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

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
    public readonly fieldErrors: Record<string, string[]> = {},
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
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed (${res.status})`,
      err?.details?.fieldErrors ?? {},
    );
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
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
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
    fetch(path, {
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

// Sends a multipart form (with a file) directly to the API, with the same one-retry
// refresh behaviour as api().
export async function apiUpload<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  const send = () =>
    fetch(`${API_ORIGIN}${path}`, {
      method,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  let res = await send();
  if (res.status === 401) {
    const user = await refreshSession();
    if (user) res = await send();
  }
  return parse<T>(res);
}

// Opens a protected file in a new tab. The endpoint returns a short-lived signed link.
// The tab is opened first (synchronously) so phone browsers do not block it as a pop-up.
export async function openFile(linkEndpoint: string) {
  const tab = window.open('', '_blank');
  // The file tab gets no handle back to this app (prevents "reverse tabnabbing").
  if (tab) tab.opener = null;
  try {
    const { url } = await api<{ url: string }>(linkEndpoint);
    const full = `${API_ORIGIN}${url}`;
    if (tab) tab.location.href = full;
    else window.open(full, '_self'); // pop-up blocked: open in this tab instead
  } catch (err) {
    tab?.close();
    throw err;
  }
}

// For <video src> and <img src>: fetch a signed link and return the full URL.
export async function fileUrl(linkEndpoint: string) {
  const { url } = await api<{ url: string }>(linkEndpoint);
  return `${API_ORIGIN}${url}`;
}
