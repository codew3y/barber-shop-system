'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/api-client';
import type { ShopEvent } from '@/lib/events';

// Live updates over SSE (Phase 4.3). Opens one EventSource per mounted
// component; on each in-scope event, invalidates the given query keys so
// React Query refetches. Polling remains as a fallback (see call sites)
// in case the stream drops between EventSource auto-reconnects.
export function useLiveEvents(queryKeys: string[][], enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('EventSource' in window)) return;
    const token = getAccessToken();
    if (!token) return;
    const source = new EventSource(`/api/v1/events?token=${encodeURIComponent(token)}`);
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
    return () => source.close();
    // queryKeys should be stable (literal) at call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
