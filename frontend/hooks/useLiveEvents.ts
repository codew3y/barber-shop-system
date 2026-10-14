'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { ShopEvent } from '@barberhouse/backend/lib/events';

const RETRY_MS = 5_000;

// Live updates over SSE (Phase 4.3). Opens one EventSource per mounted
// component; on each in-scope event, invalidates the given query keys so
// React Query refetches. Polling remains as a fallback (see call sites)
// in case the stream drops between reconnects.
//
// EventSource can't send headers, so the stream authenticates with an
// httpOnly cookie minted by POST /api/v1/events/session (never a URL token).
// That credential is the 15-minute access token: when the stream closes —
// including on expiry — re-mint it (apiFetch refreshes as needed) and reopen.
export function useLiveEvents(queryKeys: string[][], enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('EventSource' in window)) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const open = async () => {
      if (stopped) return;
      const res = await apiFetch('/api/v1/events/session', { method: 'POST' }).catch(() => null);
      if (stopped || !res?.ok) return; // signed out: polling still covers updates
      source = new EventSource('/api/v1/events');
      source.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as ShopEvent;
          if (!event?.type) return;
          for (const key of queryKeys) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        } catch {
          // Ignore malformed frames.
        }
      };
      source.onerror = () => {
        // Transient drops are retried by EventSource itself; a CLOSED stream
        // (e.g. 401 once the token expired) needs a fresh credential.
        if (source?.readyState === EventSource.CLOSED && !stopped) {
          source.close();
          retry = setTimeout(() => void open(), RETRY_MS);
        }
      };
    };

    void open();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
    // queryKeys should be stable (literal) at call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
