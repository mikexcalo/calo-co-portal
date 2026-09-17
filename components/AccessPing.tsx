'use client';

/**
 * Tells the server a screen was opened.
 *
 * Fires on navigation rather than once per session, because "Marcie signed in"
 * is worth far less than "Marcie signed in and spent her time in Invoices".
 * The row is cheap; the notification it can trigger is rate limited server
 * side to one per person per day.
 *
 * keepalive matters: without it a ping fired as somebody clicks away is
 * cancelled by the navigation it is trying to record.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function AccessPing() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Signed-out screens have nobody to record, and public token pages belong
    // to customers rather than users.
    if (/^\/(login|welcome|trust|c|e|i|p|r|s|new|preview)(\/|$)/.test(pathname)) return;
    if (last.current === pathname) return;
    last.current = pathname;

    fetch('/api/access/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      /* never surface this */
    });
  }, [pathname]);

  return null;
}
