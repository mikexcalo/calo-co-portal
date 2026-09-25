'use client';

/**
 * Choosing which business you are working in.
 *
 * It used to be a pill in the top bar that opened a list of names. The plate
 * in the sidebar is the identity now, and this is the panel it opens — so
 * this file is the choosing, and nothing else.
 *
 * Three things it has to do that the old list did not:
 *
 *   Say where you are before it offers to move you. The first section is the
 *   workspace you are standing in, labelled, because the most common reason
 *   to open this is to check rather than to switch.
 *
 *   Say something about each one. A column of names tells you nothing you did
 *   not already know. An overdue invoice is worth crossing the room for; when
 *   there is nothing to report it says when you were last in, and when it
 *   cannot work either out it says only what kind of business it is. It never
 *   invents a status.
 *
 *   Work on a phone. You could not switch at all below 720px, because the
 *   pill lived in a top bar that collapses. On a narrow screen this is a
 *   sheet from the bottom, full width, where a thumb can reach it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { useViewAs } from '@/lib/spine/viewas';
import {
  workspaceColor,
  workspaceKindLabel,
  workspaceInitials,
  workspaceLogo,
  readableOn,
} from '@/lib/spine/workspace-color';
import { C, useIsPhone, radius } from './ui';
import type { Org } from '@/lib/spine/types';

/** What we can say about a workspace without guessing. */
interface Status {
  overdue: number;
  lastIn: string | null;
  /** They have asked the studio for help and nobody has picked it up. */
  asked: boolean;
}

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return 'In today';
  if (days === 1) return 'In yesterday';
  if (days < 30) return `In ${days} days ago`;
  const months = Math.round(days / 30);
  return `In ${months} month${months === 1 ? '' : 's'} ago`;
}

/**
 * One line, and only if it is true.
 *
 * Money first: an overdue invoice is the one thing that would make somebody
 * switch on purpose. Then when they were last in, which answers "have I
 * forgotten about this one". Then nothing, and the row shows the business
 * type alone rather than a sentence invented to fill the space.
 */
function statusLine(s: Status | undefined): string | null {
  if (!s) return null;
  /* Above the money, because an overdue invoice is a fact about their week
     and this is a person waiting on you. */
  if (s.asked) return 'Asked for help';
  if (s.overdue > 0) return `${s.overdue} overdue invoice${s.overdue === 1 ? '' : 's'}`;
  return ago(s.lastIn);
}

export function OrgSwitcher({ onClose }: { onClose?: () => void }) {
  const { org, orgs, switchOrg } = useOrg();
  const { viewAs } = useViewAs();
  const phone = useIsPhone();

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  /*
    Two small reads, once, when the panel opens. Both are scoped by row-level
    security to workspaces this person belongs to, so neither can report on a
    business they cannot see.
  */
  useEffect(() => {
    let dead = false;
    (async () => {
      const [inv, seen, help] = await Promise.all([
        supabase
          .from('job_invoices')
          .select('org_id, status, due_on')
          .in('status', ['sent', 'overdue']),
        supabase
          .from('access_events')
          .select('org_id, at')
          .order('at', { ascending: false })
          .limit(400),
        /* Open requests across every workspace you belong to, which is the
           same row filter the inbox on Home reads through. */
        supabase
          .from('feedback')
          .select('org_id')
          .eq('kind', 'help')
          .in('status', ['open', 'building']),
      ]);
      if (dead) return;

      const out: Record<string, Status> = {};
      const today = new Date().toISOString().slice(0, 10);
      const asked = new Set(
        ((help.data ?? []) as Array<{ org_id: string }>).map((r) => r.org_id)
      );

      for (const r of (inv.data ?? []) as Array<{ org_id: string; status: string; due_on: string | null }>) {
        const late = r.status === 'overdue' || (r.status === 'sent' && !!r.due_on && r.due_on < today);
        if (!late) continue;
        out[r.org_id] = {
          overdue: (out[r.org_id]?.overdue ?? 0) + 1,
          lastIn: out[r.org_id]?.lastIn ?? null,
          asked: asked.has(r.org_id),
        };
      }
      for (const r of (seen.data ?? []) as Array<{ org_id: string; at: string }>) {
        const cur = out[r.org_id];
        if (cur?.lastIn) continue;                       // ordered desc, so the first is newest
        out[r.org_id] = { overdue: cur?.overdue ?? 0, lastIn: r.at, asked: asked.has(r.org_id) };
      }
      /* A workspace with a request and nothing else has no row yet. */
      for (const orgId of asked) {
        out[orgId] = { overdue: out[orgId]?.overdue ?? 0, lastIn: out[orgId]?.lastIn ?? null, asked: true };
      }
      setStatus(out);
    })();
    return () => { dead = true; };
  }, []);

  /*
    Where you are, then your studio, then everybody else.

    A preview collapses this to the one workspace being previewed: somebody
    looking at what a client sees should not be offered a menu of every other
    client, which is the most alarming thing this panel could draw.
  */
  const { here, rest } = useMemo(() => {
    const visible = viewAs ? orgs.filter((o) => o.id === org?.id) : orgs;
    const q = query.trim().toLowerCase();
    const current = visible.find((o) => o.id === org?.id) ?? null;

    const others = visible
      .filter((o) => o.id !== org?.id)
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // The studio first, then alphabetical.
        if (a.kind === 'agency' && b.kind !== 'agency') return -1;
        if (b.kind === 'agency' && a.kind !== 'agency') return 1;
        return a.name.localeCompare(b.name);
      });

    return { here: q ? null : current, rest: others };
  }, [orgs, org?.id, query, viewAs]);

  /* Arrow keys walk the switchable rows. The one you are in is not one. */
  useEffect(() => { setCursor(0); }, [query]);

  const go = useCallback(
    (id: string) => {
      onClose?.();
      if (id !== org?.id) switchOrg(id);
    },
    [onClose, org?.id, switchOrg]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rest.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const pick = rest[cursor]; if (pick) go(pick.id); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  };

  const Row = ({ o, active, label }: { o: Org; active?: boolean; label?: boolean }) => {
    const color = workspaceColor(o);
    const logo = workspaceLogo(o);
    const line = statusLine(status[o.id]);
    return (
      <button
        onClick={() => go(o.id)}
        onMouseEnter={() => { const i = rest.findIndex((r) => r.id === o.id); if (i >= 0) setCursor(i); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%',
          padding: phone ? '12px 16px' : '9px 10px',
          borderRadius: radius.md, border: 'none',
          background: active ? C.panelAlt : 'transparent',
          cursor: label ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span
          style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                fontSize: 13, fontWeight: 700, color: readableOn(color),
              }}
            >
              {workspaceInitials(o.name)}
            </span>
          )}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 14, color: C.text, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {o.name}
            </span>
            {o.is_demo && (
              <span
                style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: C.amber, border: `1px solid ${C.amber}55`, borderRadius: 4,
                  padding: '1px 4px', flexShrink: 0,
                }}
              >
                Demo
              </span>
            )}
          </span>
          <span
            style={{
              display: 'block', fontSize: 11, color: C.faint, marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {workspaceKindLabel(o.kind)}
            {line ? ` · ${line}` : ''}
          </span>
        </span>
      </button>
    );
  };

  const body = (
    <div
      ref={listRef}
      onKeyDown={onKey}
      style={{
        background: C.panel,
        border: phone ? 'none' : `1px solid ${C.border}`,
        borderRadius: phone ? '14px 14px 0 0' : radius.lg,
        boxShadow: phone ? '0 -12px 40px rgba(0,0,0,.18)' : '0 14px 40px rgba(0,0,0,.14)',
        width: phone ? '100%' : 292,
        maxHeight: phone ? '76vh' : '70vh',
        overflowY: 'auto',
        padding: phone ? '8px 0 18px' : 8,
      }}
    >
      {/* Type to narrow. Focused on open, so you can start typing immediately. */}
      <div style={{ padding: phone ? '8px 16px 10px' : '4px 6px 8px' }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a workspace"
          aria-label="Find a workspace"
          style={{
            width: '100%', padding: '9px 11px', fontSize: 14, fontFamily: 'inherit',
            color: C.text, background: C.panelAlt,
            border: `1px solid ${C.border}`, borderRadius: radius.md, outline: 'none',
          }}
        />
      </div>

      {here && (
        <>
          <div
            style={{
              fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase',
              color: C.faint, padding: phone ? '4px 16px 4px' : '2px 10px 4px',
            }}
          >
            You are here
          </div>
          <Row o={here} label />
          <div style={{ height: 1, background: C.border, margin: phone ? '8px 16px' : '8px 6px' }} />
        </>
      )}

      {rest.length === 0 ? (
        <div style={{ padding: phone ? '10px 16px 4px' : '6px 10px', fontSize: 13, color: C.faint }}>
          {query ? 'Nothing matches that.' : 'No other workspaces.'}
        </div>
      ) : (
        rest.map((o, i) => <Row key={o.id} o={o} active={i === cursor} />)
      )}
    </div>
  );

  /* A phone gets a sheet from the bottom, because the sidebar it used to hang
     off is a drawer and the top bar it used to live in collapses. */
  if (phone) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
          {body}
        </div>
      </div>
    );
  }

  return body;
}
