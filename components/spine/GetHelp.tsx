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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { studioFor, type Studio } from '@/lib/spine/workin';
import { Button, C, Sheet, radius, inputStyle } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';

export function GetHelp() {
  const { org, vocab } = useOrg();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [canSend, setCanSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(0);
  const line = useRef<HTMLParagraphElement>(null);
  /*
    The subtitle is sized to fit, not guessed at.

    It has to be one line at every width, and half of it is a name we do not
    choose: "Northwind Studio" overflows a 390px dialog at any readable size,
    and a clamp tuned until this one name fitted would be a fit for this data
    rather than a design. So it is measured, once per open and on resize, and
    stepped down to the smallest size that still holds.

    The floor matters more than the ceiling. Below 11px it stops shrinking and
    wraps instead, because two readable lines beat one line with somebody's
    company name cut off mid-word - an ellipsis through a business's name is
    the kind of detail a client notices and nobody can explain.
  */
  const [fit, setFit] = useState<{ size: number; wrap: boolean }>({ size: 15, wrap: false });
  /*
    Undefined while the lookup is in flight, so the button does not flash in
    and out on every page load. Null once we know there is nobody to ask.
  */
  const [studio, setStudio] = useState<Studio | null | undefined>(undefined);

  useEffect(() => {
    let off = false;
    setStudio(undefined);
    if (!org?.id) return;
    (async () => {
      const found = await studioFor(org.id);
      if (!off) setStudio(found.studio);
    })();
    return () => { off = true; };
  }, [org?.id]);

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

  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;

    const measure = () => {
      const was = el.style.cssText;
      el.style.whiteSpace = 'nowrap';
      for (let size = 15; size >= 11; size -= 0.25) {
        el.style.fontSize = `${size}px`;
        if (el.scrollWidth <= el.clientWidth) {
          el.style.cssText = was;
          setFit({ size, wrap: false });
          return;
        }
      }
      el.style.cssText = was;
      setFit({ size: 11, wrap: true });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, studio?.name]);

  /* The person where the studio has one, the studio itself where it does not.
     Never a stand-in word: every sentence here is read by somebody deciding
     what another business may do inside theirs. */
  const person = studio?.person ?? studio?.name ?? '';

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
      /* Whoever owns the studio that set this workspace up, named by
         studio_for. The client cannot read that themselves and should not
         have to: it is the studio's own record, not theirs. */
      const grantedTo = studio?.ownerId;
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

  /*
    No button where there is nobody to ask.

    A workspace with no studio linking to it is a business running the product
    on its own, and "Get help from" with a blank after it is worse than no
    button. Two studios linking to it is a data problem, and picking one of
    them would put a client's request, and a standing permission to edit their
    business, in front of a company they never chose.
  */
  if (!studio) return null;

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
          Get help from {studio.name}
          {pending > 0 && <span style={{ color: C.faint, fontSize: 12 }}>· {pending} open</span>}
        </button>
      </div>
    );
  }

  return (
    <Sheet
      width={560}
      label={`Get help from ${studio.name}`}
      onClose={() => setOpen(false)}
      /* A half-written request for help is exactly the thing not to lose to a
         stray tap: somebody stopped what they were doing to write it. */
      unsaved={!sent && Boolean(body.trim())}
      unsavedPrompt="Your message has not been sent."
    >
      {/* The heading stays here rather than becoming Sheet's, because it is
          measured against the studio's name - see the note on the line below
          it. Sheet's `label` carries the accessible name instead. */}
      <div>
        {sent ? (
          <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6 }}>
            Sent. {person} sees it right away, and you will be told about every change.
          </div>
        ) : (
          <>
            <h2 style={{ ...DISPLAY_TITLE, margin: 0 }}>Get help from {studio.name}</h2>
            {/*
              One line, and it stays one line.

              The studio's name is in it, so its length is not ours to
              choose, which is why the size is measured rather than picked. A
              subtitle that breaks into two lines on a phone pushes down the
              box everything else is measured from, and this one sits directly
              above the question.
            */}
            <p
              ref={line}
              style={{
                fontSize: fit.size,
                color: C.faint,
                margin: '6px 0 20px',
                lineHeight: 1.5,
                whiteSpace: fit.wrap ? 'normal' : 'nowrap',
              }}
            >
              You&rsquo;ll be told about every change {studio.name} makes.
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
                label={`${person} can also send to my ${vocab.customerPlural.toLowerCase()}`}
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
    </Sheet>
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
