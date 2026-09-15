'use client';

import { apiFetch, apiJson } from '@/lib/api-client';

// Browser push subscription helpers (Phase 4.3). The VAPID public key is
// public by design; the private key never leaves the server.

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub ? 'on' : 'off';
}

export async function subscribePush(): Promise<void> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Push is not configured on this site yet.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const json = sub.toJSON();
  const res = await apiFetch('/api/v1/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent.slice(0, 500),
    }),
  });
  if (!res.ok) {
    await sub.unsubscribe().catch(() => {});
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? 'Could not save subscription');
  }
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub?.endpoint) {
    await apiFetch('/api/v1/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

export interface Prefs {
  emailConfirmations: boolean;
  emailReminders: boolean;
  pushConfirmations: boolean;
  pushReminders: boolean;
}

export async function getPrefs(): Promise<Prefs> {
  const data = await apiJson<{ preferences: Prefs }>('/api/v1/settings/notifications');
  return data.preferences;
}

export async function savePrefs(prefs: Prefs): Promise<Prefs> {
  const data = await apiJson<{ preferences: Prefs }>('/api/v1/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  return data.preferences;
}
