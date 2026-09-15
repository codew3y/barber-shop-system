'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getPrefs,
  getPushState,
  isPushSupported,
  savePrefs,
  subscribePush,
  unsubscribePush,
  type Prefs,
  type PushState,
} from '@/lib/pushClient';

const PREF_ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'emailConfirmations', label: 'Booking emails', hint: 'Confirmations, changes, cancellations' },
  { key: 'emailReminders', label: 'Reminder emails', hint: '24 hours and 1 hour before' },
  { key: 'pushConfirmations', label: 'Push on booking changes', hint: 'Needs push enabled below' },
  { key: 'pushReminders', label: 'Push reminders', hint: 'Needs push enabled below' },
];

const PUSH_COPY: Record<PushState, string> = {
  unsupported: 'This browser cannot receive push.',
  denied: 'Blocked — allow notifications in the browser site settings, then reload.',
  off: 'Get booking updates even with the tab closed.',
  on: 'This device will buzz on booking changes and reminders.',
};

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [pushState, setPushState] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPrefs()
      .then((p) => {
        if (!cancelled) setPrefs(p);
      })
      .catch(() => toast.error('Could not load notification settings.'));
    (async () => {
      const state = !isPushSupported()
        ? ('unsupported' as const)
        : await getPushState().catch((): PushState => 'off');
      if (!cancelled) setPushState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePref(key: keyof Prefs) {
    if (!prefs || busy) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    try {
      setBusy(true);
      await savePrefs(next);
    } catch {
      setPrefs(prefs);
      toast.error('Could not save preference.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePush() {
    if (busy || pushState === 'unsupported' || pushState === 'denied') return;
    setBusy(true);
    try {
      if (pushState === 'on') {
        await unsubscribePush();
        setPushState('off');
        toast.success('Push off for this device.');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushState('denied');
          return;
        }
        await subscribePush();
        setPushState('on');
        toast.success('Push on — we will buzz you on booking changes.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Push toggle failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-display text-xl">Notifications</h2>
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      </div>
      <div className="inset rounded-2xl px-5 py-5">
        {!prefs ? (
          <div className="skeleton h-24 rounded-xl" aria-label="Loading notification settings" />
        ) : (
          <ul className="grid gap-1">
            {PREF_ROWS.map((row) => (
              <li key={row.key}>
                <button
                  onClick={() => togglePref(row.key)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                  role="switch"
                  aria-checked={prefs[row.key]}
                >
                  <span>
                    <span className="block text-sm font-medium">{row.label}</span>
                    <span className="muted block text-xs">{row.hint}</span>
                  </span>
                  <span
                    aria-hidden
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                    style={{ background: prefs[row.key] ? 'rgb(196 160 72 / 0.85)' : 'rgb(247 242 233 / 0.14)' }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-ivory transition-all"
                      style={{ left: prefs[row.key] ? '1.375rem' : '0.125rem' }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="muted text-xs">{PUSH_COPY[pushState]}</p>
          <button
            onClick={togglePush}
            disabled={busy || pushState === 'unsupported' || pushState === 'denied'}
            className="btn-quiet disabled:opacity-40"
          >
            {pushState === 'on' ? 'Turn push off' : 'Turn push on'}
          </button>
        </div>
      </div>
    </section>
  );
}
