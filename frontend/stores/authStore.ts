'use client';

import { create } from 'zustand';
import type { PublicUser } from '@/lib/types';
import { clearLegacyTokens, hasSessionHint, logout, refreshAccessToken, setAccessToken } from '@/lib/api-client';

interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  // The refresh token arrives as an httpOnly cookie on the same response.
  setSession: (user: PublicUser, accessToken: string) => void;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setSession: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user });
  },
  clear: async () => {
    set({ user: null });
    await logout();
  },
  hydrate: async () => {
    clearLegacyTokens();
    if (!hasSessionHint()) {
      set({ ready: true });
      return;
    }
    try {
      // No token survives a reload; the session cookie mints a fresh one.
      const token = await refreshAccessToken();
      if (!token) {
        set({ user: null });
        return;
      }
      const res = await fetch('/api/v1/auth/me', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('unauthorized');
      const data = await res.json();
      set({ user: data.user });
    } catch {
      setAccessToken(null);
      set({ user: null });
    } finally {
      set({ ready: true });
    }
  },
}));
