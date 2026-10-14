'use client';

// Session model: the refresh token is an httpOnly cookie the page can never
// read; the short-lived access token is kept only in memory here. A reload
// starts with no access token and gets a fresh one from /auth/refresh.

const LEGACY_KEYS = ['booking.accessToken', 'booking.refreshToken'];

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Readable flag set beside the httpOnly session cookie (holds no secret).
export function hasSessionHint(): boolean {
  return typeof document !== 'undefined' && /(?:^|;\s*)bh_session=1(?:;|$)/.test(document.cookie);
}

// Tokens used to live in localStorage; drop any left behind.
export function clearLegacyTokens() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode): nothing to clear
  }
}

async function requestRefresh(): Promise<string | null> {
  const attempt = () => fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  let res = await attempt();
  // 403 = the cookie we sent was just rotated by another tab; the browser
  // now holds the newer one, so one retry picks it up.
  if (res.status === 403) res = await attempt();
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken?: string };
  return data.accessToken ?? null;
}

// Single-flight within the tab, and serialised across tabs (Web Locks) so
// two tabs never present the same refresh cookie at once.
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    const run = () => requestRefresh();
    // The lock is held until run() settles, so the next tab sees the cookie
    // this one rotated.
    const locked =
      typeof navigator !== 'undefined' && navigator.locks
        ? new Promise<string | null>((resolve, reject) => {
            void navigator.locks.request('bh-session-refresh', () => run().then(resolve, reject));
          })
        : run();
    refreshing = locked
      .then((token) => {
        accessToken = token;
        return token;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function logout(): Promise<void> {
  accessToken = null;
  clearLegacyTokens();
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Offline: the cookie stays until it expires, but this tab is signed out.
  }
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  // After a reload the page has a session cookie but no token yet: restore
  // it before the first request (shared with the auth store's hydrate), so
  // pages that fetch on mount don't race the session and see a 401.
  if (!accessToken && hasSessionHint()) await refreshAccessToken();
  const headers = new Headers(init.headers);
  const token = accessToken;
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && retry && token) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      headers.set('authorization', `Bearer ${fresh}`);
      return fetch(path, { ...init, headers });
    }
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
