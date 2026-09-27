'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 60_000;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

// Bell with an unread badge. No WebSockets: the unread count is polled every minute while
// the tab is visible, and the list is loaded when the panel is opened.
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const refreshCount = useCallback(() => {
    api<{ unread: number }>('/api/me/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refreshCount();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCount]);

  // Close on Escape or a click outside; return focus to the bell.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      api<{ items: Notification[]; unread: number }>('/api/me/notifications')
        .then((d) => {
          setItems(d.items);
          setUnread(d.unread);
        })
        .catch(() => setItems([]));
    }
  }

  async function openItem(n: Notification) {
    if (!n.readAt) {
      await api(`/api/me/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function readAll() {
    await api('/api/me/notifications/read-all', { method: 'POST' }).catch(() => {});
    setUnread(0);
    setItems((list) => list?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex size-9 items-center justify-center rounded-lg text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          ref={panelRef}
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-2 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-96"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
            <p className="font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-sm font-medium text-brand-700 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {!items && <p className="px-4 py-6 text-sm text-slate-600">Loading…</p>}
          {items?.length === 0 && <p className="px-4 py-6 text-sm text-slate-600">No notifications yet.</p>}
          <ul className="divide-y divide-slate-100">
            {items?.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={`block w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none ${n.readAt ? '' : 'bg-brand-50/60'}`}
                >
                  <span className="flex items-start gap-2">
                    {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-700">{n.body}</span>
                      <span className="mt-1 block text-xs text-slate-600">{ago(n.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
