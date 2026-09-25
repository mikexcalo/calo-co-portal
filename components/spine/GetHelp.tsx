'use client';

/**
 * Asking the studio for help, and deciding what they may do about it.
 *
 * Built on feedback rather than beside it. That table already carries
 * client-to-studio messages, already has a policy letting the studio read
 * them, and already has a lifecycle - open, building, done - that means
 * exactly "asked, being worked on, finished". A second request system would
 * have been a second inbox to check and a second thing to forget.
 *
 * What is NOT on the message is the permission. A grant has a start and an
 * end and has to be endable without touching the note that created it, so it
 * lives in work_grants. Two booleans on a message would mean the client takes
 * permission back by editing a complaint, and a note left open would be
 * standing consent.
 *
 * THE DEFAULTS ARE THE DESIGN
 *
 * Editing is on, because somebody asking for help is asking for the thing to
 * be fixed, and making them tick a box to allow the fix is ceremony. Sending
 * is off, because the relationship with their customers is theirs and nobody
 * hands that over by accident. The second checkbox says what leaving it off
 * means, rather than only what ticking it does.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { PROVIDER } from '@/lib/brand';
import { Button, C, radius, inputStyle } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';

/**
 * Who the client is asking, by name where there is one.
 *
 * The studio's own name comes from the brand constant, which is one edit away
 * from being right for anybody. The person's first name comes from whoever
 * owns the agency workspace, and when that cannot be resolved the dialog says
 * the studio's name alone rather than inventing somebody.
 */
async function studioPerson(): Promise<string | null> {
  const res = await supabase
    .from('orgs')
    .select('id, kind')
    .eq('kind', 'agency')
    .limit(1)
    .maybeSingle();
  const agencyId = (res.data as { id?: string } | null)?.id;
  if (!agencyId) return null;

  /* Two queries: memberships.user_id points at auth.users, not profiles, so
     there is no relationship for PostgREST to embed through. */
  const m = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', agencyId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  const uid = (m.data as { user_id?: string } | null)?.user_id;
  if (!uid) return null;

  const prof = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle();
  const whole = ((prof.data as { full_name?: string } | null)?.full_name ?? '').trim();
  return whole ? whole.split(/\s+/)[0] : null;
}

export function GetHelp() {
  const { org } = useOrg();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [canSend, setCanSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => { studioPerson().then(setWho); }, []);

  /** How many of their own requests are still open, for the button's label. */
  const load = useCallback(async () => {
    if (!org?.id) return;
    const res = await supabase
      .from('feedback')
      .select('id')
      .eq('org_id', org.id)
      .eq('kind', 'help')
      .in('status', ['open', 'building']);
    setPending((res.data ?? []).length);
  }, [org?.id]);

  useEffect(() => { load(); }, [load]);

  const person = who ?? PROVIDER;

  const send = async () => {
    if (!org || !body.trim()) return;
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const me = data.session?.user?.id ?? null;

    const res = await saveOrFail(
      supabase.from('feedback').insert({
        org_id: org.id,
        author_id: me,
        kind: 'help',
        body: body.trim(),
        page: pathname,
      }).select().maybeSingle(),
      'Sending your request'
    );
    if (res.error || !res.data) { setBusy(false); return; }

    /*
      The grant is written now, with the request, and not when it is accepted.

      Consent belongs to the moment it was given. Writing it later would mean
      the studio recorded what the client allowed, which is the wrong way round
      for the one record that exists to protect them.
    */
    const request = res.data as { id: string };
    if (canEdit) {
      const agency = await supabase.from('orgs').select('id').eq('kind', 'agency').limit(1).maybeSingle();
      const owner = agency.data
        ? await supabase
            .from('memberships')
            .select('user_id')
            .eq('org_id', (agency.data as { id: string }).id)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle()
        : { data: null };
      const grantedTo = (owner.data as { user_id?: string } | null)?.user_id;
      if (grantedTo) {
        await saveOrFail(
          supabase.from('work_grants').insert({
            org_id: org.id,
            feedback_id: request.id,
            granted_by: me,
            granted_to: grantedTo,
            can_edit: true,
            can_send: canSend,
          }),
          'Recording what you allowed'
        );
      }
    }

    setBusy(false);
    setBody('');
    setSent(true);
    setTimeout(() => { setSent(false); setOpen(false); }, 2200);
    load();
  };

  if (!open) {
    return (
      <div style={{ padding: '0 14px 10px' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: `1px solid ${C.border}`, background: C.panel,
            borderRadius: radius.pill, padding: '9px 12px',
            fontSize: 13.5, fontWeight: 500, color: C.text,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="8" cy="8" r="6.3" />
            <path d="M6.1 6.2a2 2 0 1 1 2.6 2.3c-.5.2-.8.6-.8 1.1v.3" />
            <path d="M8 12.1h.01" />
          </svg>
          Get help from {PROVIDER}
          {pending > 0 && <span style={{ color: C.faint, fontSize: 12 }}>· {pending} open</span>}
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.45)', zIndex: 120 }}
      />
      <div
        role="dialog"
        aria-label={`Get help from ${PROVIDER}`}
        style={{
          position: 'fixed', zIndex: 121,
          left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
          background: C.panel, borderRadius: 18, padding: 26,
          boxShadow: '0 24px 70px rgba(0,0,0,.28)',
        }}
      >
        {sent ? (
          <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6 }}>
            Sent. {person} sees it right away, and you will be told about every change.
          </div>
        ) : (
          <>
            <h2 style={{ ...DISPLAY_TITLE, margin: 0 }}>Get help from {PROVIDER}</h2>
            <p style={{ fontSize: 15, color: C.faint, margin: '6px 0 20px', lineHeight: 1.5 }}>
              {/*
                "they make", for everybody, always.

                Nothing in this product records anybody's pronouns, and a name
                does not supply them. The approved design says "he makes"
                because the studio owner wrote it about himself; a component
                that renders for whoever owns the agency cannot assume that,
                and getting it wrong misgenders a real person on their own
                client's screen. "They" is correct for everyone.
              */}
              {person} sees this right away. You&rsquo;ll be told about every change they make.
            </p>

            <label htmlFor="gethelp-body" style={{ display: 'block', fontSize: 14.5, color: C.text, marginBottom: 7 }}>
              What do you need?
            </label>
            <textarea
              id="gethelp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              autoFocus
              style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: 15, lineHeight: 1.5 }}
            />

            <div style={{ background: C.panelAlt, borderRadius: 12, padding: '14px 16px', margin: '18px 0 22px', display: 'grid', gap: 14 }}>
              <Permission
                checked={canEdit}
                onChange={setCanEdit}
                label={`${person} can make changes until this is solved`}
                hint="You can take this back at any time."
              />
              <Permission
                checked={canSend}
                onChange={setCanSend}
                label={`${person} can also send to my customers`}
                hint="Leave this off and you send everything yourself."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={send} disabled={busy || !body.trim()}>
                {busy ? 'Sending…' : `Send to ${person}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const DISPLAY_TITLE = {
  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
  fontSize: 27,
  fontWeight: 700,
  letterSpacing: '-0.4px',
  color: C.text,
} as const;

/**
 * A permission, said as a sentence with its consequence under it.
 *
 * Not a bare checkbox. What somebody is agreeing to here is that another
 * business may change or send from their account, and the line under each one
 * is the part that makes it a decision rather than a default.
 */
function Permission({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        /* The one place a saturated colour is allowed to mean "on": a
           checkbox is a state, and a grey tick is unreadable at this size. */
        style={{ width: 19, height: 19, marginTop: 2, flexShrink: 0, accentColor: C.viewing, cursor: 'pointer' }}
      />
      <span>
        <span style={{ display: 'block', fontSize: 15, color: C.text, lineHeight: 1.4 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 13.5, color: C.faint, marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );
}
