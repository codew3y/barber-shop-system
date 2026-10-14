'use client';

import { create } from 'zustand';
import type { PublicUser } from '@/lib/types';
import { clearTokens, setTokens } from '@/lib/api-client';

interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  setSession: (user: PublicUser, accessToken: string, refreshToken: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setSession: (user, accessToken, refreshToken) => {
    setTokens(accessToken, refreshToken);
    set({ user });
  },
  clear: () => {
    clearTokens();
    set({ user: null });
  },
  hydrate: async () => {
    const token = localStorage.getItem('booking.accessToken');
    if (!token) {
      set({ ready: true });
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('unauthorized');
      const data = await res.json();
      set({ user: data.user });
    } catch {
      clearTokens();
      set({ user: null });
    } finally {
      set({ ready: true });
    }
  },
}));
