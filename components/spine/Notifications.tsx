'use client';

/**
 * The bell.
 *
 * Things you'd otherwise only find out by staring at the app: a lead arrived,
 * an invoice got paid, a client asked for a website change.
 *
 * Polls rather than using a live subscription. A realtime channel is the
 * "right" answer and also a persistent connection, a reconnect story, and a
 * class of bug that only shows up on flaky phone signal. A poll every 60
 * seconds is dull and correct, and this is not a trading floor.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { C, radius } from './ui';

interface Notification {
  id: string;
  kind: 'lead' | 'invoice_paid' | 'invoice_overdue' | 'site_request' | 'document' | 'system';
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

const ICON: Record<Notification['kind'], string> = {
  lead: '◆',
  invoice_paid: '✓',
  invoice_overdue: '!',
  site_request: '✎',
  document: '▤',
  system: '·',
};

const TONE: Record<Notification['kind'], string> = {
  lead: C.accent,
  invoice_paid: C.green,
  invoice_overdue: C.red,
  site_request: C.accent,
  document: C.dim,
  system: C.faint,
};

/** "3m ago" reads better than a timestamp for something that just happened. */
function ago(iso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  /** Set after mount — a clock read during render disagrees with the server. */
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('notifications')
      .select('id, kind, title, body, href, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!res.error) setItems((res.data ?? []) as Notification[]);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    load();
    const t = setInterval(() => {
      setNow(Date.now());
      load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((i) => !i.read_at);

  const markAllRead = async () => {
    if (!unread.length) return;
    const ids = unread.map((i) => i.id);
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
  };

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
    }
    if (n.href) router.push(n.href);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread.length ? `${unread.length} unread` : 'Notifications'}
        style={{
          position: 'relative',
          width: 32,
          height: 32,
          borderRadius: radius.md,
          border: `1px solid ${C.border}`,
          background: 'transparent',
          color: C.dim,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2a4 4 0 0 0-4 4v3l-1 2h10l-1-2V6a4 4 0 0 0-4-4z" />
          <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unread.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: C.red,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 'min(360px, calc(100vw - 32px))',
              maxHeight: 440,
              overflowY: 'auto',
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: radius.lg,
              zIndex: 51,
              boxShadow: '0 12px 32px rgba(0,0,0,.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderBottom: `1px solid ${C.border}`,
                position: 'sticky',
                top: 0,
                background: C.panel,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>Notifications</span>
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: C.accent,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{ padding: 26, textAlign: 'center', color: C.faint, fontSize: 13.5 }}>
                Nothing yet. Leads, payments and client requests show up here.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  style={{
                    display: 'flex',
                    gap: 11,
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: 'none',
                    borderBottom: `1px solid ${C.border}`,
                    background: n.read_at ? 'transparent' : C.accentSoft,
                    cursor: n.href ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      color: TONE[n.kind],
                      fontSize: 14,
                      lineHeight: '18px',
                      width: 16,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {ICON[n.kind]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        color: C.text,
                        fontWeight: n.read_at ? 400 : 500,
                      }}
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span style={{ display: 'block', fontSize: 13, color: C.dim, marginTop: 2 }}>
                        {n.body}
                      </span>
                    )}
                    <span style={{ display: 'block', fontSize: 11.5, color: C.faint, marginTop: 4 }}>
                      {now ? ago(n.created_at, now) : ''}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
