'use client';

/**
 * One customer, everything about them.
 *
 * The thing you read before picking up the phone: who they are, what you owe
 * them next, what was said last time, and what they're worth.
 *
 * The activity log takes both typed notes and system entries, so the history
 * is complete without anyone remembering to write "invoice paid" by hand.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { Links } from '@/components/spine/Links';
import { Photos } from '@/components/spine/Photos';
import { People } from '@/components/spine/People';
import { Reminders } from '@/components/spine/Reminders';
import { BrandCard } from '@/components/spine/BrandCard';
import { JOB_STATUS_LABEL } from '@/lib/spine/types';
import type { JobStatus } from '@/lib/spine/types';
import {
  Avatar,
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  Row,
  SectionLabel,
  Table,
  inputStyle,
  money,
  radius,
  shortDate,
  today as todayStr,
  useIsPhone,
} from '@/components/spine/ui';

interface Customer {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  awaiting_reply_since?: string | null;
  avatar_url: string | null;
  notes: string | null;
  stage: 'prospect' | 'active' | 'past' | 'lost';
  next_action: string | null;
  next_action_on: string | null;
  last_contacted_on: string | null;
}

interface Note {
  id: string;
  kind: 'note' | 'call' | 'text' | 'email' | 'meeting' | 'quote' | 'system';
  /** 'out' = you contacted them. Only an unanswered one means they owe a reply. */
  direction?: 'out' | 'in' | null;
  body: string;
  happened_on: string;
  created_at: string;
}

interface JobRow {
  id: string;
  name: string;
  status: JobStatus;
}

const KIND_LABEL: Record<Note['kind'], string> = {
  note: 'Note',
  call: 'Call',
  text: 'Text',
  email: 'Email',
  meeting: 'Meeting',
  quote: 'Quote',
  system: 'System',
};

export default function CustomerDetail({ params }: { params: { id: string } }) {
  const phone = useIsPhone();
  const router = useRouter();
  const { vocab, org } = useOrg();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quickEmail, setQuickEmail] = useState('');
  /**
   * The logging form starts folded.
   *
   * It was five chips, two more chips, a date picker and a textarea, permanently
   * open, and it sat above the history it was for. On a client with nothing
   * logged that is a screen of controls guarding an empty box. Logging is a
   * thing you do occasionally; reading what happened is what you came for.
   */
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [noteBody, setNoteBody] = useState('');
  const [noteKind, setNoteKind] = useState<Note['kind']>('call');
  /**
   * Who reached out. A note saying "texted Mark" reads identically whether he
   * replied within the hour or has been silent a fortnight, and only one of
   * those needs chasing. Logging anything inbound clears the flag on its own,
   * so nobody has to remember to tidy up after a reply.
   */
  const [noteDirection, setNoteDirection] = useState<'out' | 'in'>('out');
  /**
   * When it actually happened.
   *
   * Defaults to today because most logging happens straight after the call.
   * But people write these up in a batch on Friday, and stamping Friday on a
   * Tuesday conversation makes the whole history a record of when somebody
   * did their admin rather than of what happened.
   *
   * It also drives the "no reply" clock, which was reading four days of
   * silence as zero because the note was dated the day it was typed.
   */
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<Partial<Customer>>({});

  const load = useCallback(async () => {
    const [o, c, n, j] = await Promise.all([
      getCurrentOrg(),
      supabase.from('customers').select('*').eq('id', params.id).maybeSingle(),
      supabase
        .from('customer_notes')
        .select('id, kind, body, happened_on, created_at')
        .eq('customer_id', params.id)
        .order('happened_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, name, status').eq('customer_id', params.id),
    ]);

    setOrgId(o?.id ?? null);
    if (c.error) throw new Error(c.error.message);
    setCustomer(c.data as Customer | null);
    setDraft((c.data ?? {}) as Partial<Customer>);
    if (!n.error) setNotes((n.data ?? []) as Note[]);
    if (!j.error) setJobs((j.data ?? []) as JobRow[]);
  }, [params.id]);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  /**
   * Give up on a reply, honestly.
   *
   * Not every unanswered message deserves chasing forever: plans change, the
   * job goes elsewhere, you speak in person instead. Without this the warning
   * sits there going stale, and a warning nobody can clear is one people learn
   * to ignore — along with the ones that matter.
   *
   * Deliberately does not log an inbound message. Recording a reply that never
   * came would be putting a lie in the record to silence a banner.
   */
  const stopWaiting = async () => {
    setBusy(true);
    setError(null);
    const res = await supabase
      .from('customers')
      .update({ awaiting_reply_since: null })
      .eq('id', params.id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    await load();
  };

  const addNote = async () => {
    if (!orgId || !noteBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const res = await supabase.from('customer_notes').insert({
        org_id: orgId,
        customer_id: params.id,
        kind: noteKind,
        direction: noteDirection,
        body: noteBody.trim(),
        happened_on: noteDate,
        author_id: auth?.user?.id ?? null,
      });
      if (res.error) throw new Error(res.error.message);

      // Logging contact IS contact — no reason to make someone update a date
      // field they'll forget.
      await supabase
        .from('customers')
        .update({ last_contacted_on: todayStr() })
        .eq('id', params.id);

      setNoteBody('');
      // Folded away again. The reason you opened it is now in the list below.
      setLogging(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCustomer = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await supabase
        .from('customers')
        .update({
          name: draft.name?.trim(),
          contact_name: draft.contact_name?.trim() || null,
          contact_title: draft.contact_title?.trim() || null,
          email: draft.email?.trim() || null,
          phone: draft.phone?.trim() || null,
          address: draft.address?.trim() || null,
          website: draft.website?.trim() || null,
          avatar_url: draft.avatar_url?.trim() || null,
          stage: draft.stage,
          next_action: draft.next_action?.trim() || null,
          next_action_on: draft.next_action_on || null,
        })
        .eq('id', params.id);
      if (res.error) throw new Error(res.error.message);
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clearNextAction = async () => {
    setBusy(true);
    try {
      await supabase
        .from('customers')
        .update({ next_action: null, next_action_on: null })
        .eq('id', params.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveQuickEmail = async () => {
    const email = quickEmail.trim();
    if (!email || !customer) return;
    setBusy(true);
    const res = await supabase.from('customers').update({ email }).eq('id', customer.id);
    setBusy(false);
    if (!res.error) {
      setCustomer({ ...customer, email });
      setQuickEmail('');
    }
  };

  if (loading) return <Page title="Loading…"><Empty>Loading…</Empty></Page>;
  if (!customer) {
    return (
      <Page title="Not found">
        <Card><Empty>That record doesn&apos;t exist, or you don&apos;t have access.</Empty></Card>
      </Page>
    );
  }

  return (
    <Page
      back={{ label: vocab.customerPlural, href: '/customers' }}
      title={customer.name}
      subtitle={
        [customer.contact_name, customer.contact_title].filter(Boolean).join(' · ') || undefined
      }
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/customers')}>All</Button>
          <Button onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {/*
        Both columns carry weight now.
        
        The right rail was a fixed 320px holding six sections in a queue, so
        you scrolled a narrow strip for a minute while the left half of the
        screen sat empty below the history form. Widening it and moving half
        the sections across uses the space that was already there.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.25fr) minmax(360px, 1fr)',
          gap: 22,
          alignItems: 'start',
        }}
      >
        <div>
          {customer.next_action && !editing && (
            <Card style={{ marginBottom: 16, borderColor: C.amber, background: C.amberSoft }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <SectionLabel>Next step</SectionLabel>
                  <div style={{ fontSize: 15 }}>{customer.next_action}</div>
                  {customer.next_action_on && (
                    <div style={{ fontSize: 13, color: C.dim, marginTop: 3 }}>
                      Due {shortDate(customer.next_action_on)}
                    </div>
                  )}
                </div>
                <Button variant="ghost" onClick={clearNextAction} disabled={busy}>
                  Done
                </Button>
              </div>
            </Card>
          )}

          {editing ? (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={vocab.customer === 'Client' ? 'Company' : 'Name'}>
                  <input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Stage">
                  <select
                    value={draft.stage ?? 'active'}
                    onChange={(e) => setDraft({ ...draft, stage: e.target.value as Customer['stage'] })}
                    style={inputStyle}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="past">Past</option>
                    <option value="lost">Lost</option>
                  </select>
                </Field>
                <Field label="Contact person">
                  <input value={draft.contact_name ?? ''} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Their title">
                  <input value={draft.contact_title ?? ''} onChange={(e) => setDraft({ ...draft, contact_title: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Email">
                  <input value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} style={inputStyle} />
                </Field>
              </div>
              <Field label="Address">
                <input value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Website">
                <input value={draft.website ?? ''} onChange={(e) => setDraft({ ...draft, website: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Photo URL">
                <input value={draft.avatar_url ?? ''} onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value })} style={inputStyle} placeholder="https://…" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Next step">
                  <input
                    value={draft.next_action ?? ''}
                    onChange={(e) => setDraft({ ...draft, next_action: e.target.value })}
                    style={inputStyle}
                    placeholder="Follow up on the bathroom quote"
                  />
                </Field>
                <Field label="By when">
                  <input
                    type="date"
                    value={draft.next_action_on ?? ''}
                    onChange={(e) => setDraft({ ...draft, next_action_on: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Button onClick={saveCustomer} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </Card>
          ) : null}

          {/*
            History leads, because the question this page answers is "where are
            we with these people". Photos led before, which meant an agency
            opened a client record and was shown an empty picture gallery
            instead of the last thing that was said.
          */}
          {orgId && <Reminders orgId={orgId} customerId={params.id} />}

          {orgId && <People orgId={orgId} customerId={params.id} />}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <SectionLabel>History</SectionLabel>
            <Button variant="ghost" onClick={() => setLogging((v) => !v)}>
              {logging ? 'Cancel' : 'Log something'}
            </Button>
          </div>

          {logging && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['call', 'text', 'email', 'meeting', 'note'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setNoteKind(k)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    border: `1px solid ${noteKind === k ? C.accent : C.border}`,
                    background: noteKind === k ? C.accentSoft : 'transparent',
                    color: noteKind === k ? C.text : C.dim,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {([['out', 'I reached out'], ['in', 'They got in touch']] as const).map(([d, label]) => (
                <button
                  key={d}
                  onClick={() => setNoteDirection(d)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    border: `1px solid ${noteDirection === d ? C.accent : C.border}`,
                    background: noteDirection === d ? C.accentSoft : 'transparent',
                    color: noteDirection === d ? C.text : C.dim,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              ))}

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontSize: 12.5, color: C.faint }}>When</span>
                <input
                  type="date"
                  value={noteDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNoteDate(e.target.value)}
                  style={{ ...inputStyle, width: 150, fontSize: 13, padding: '5px 8px' }}
                />
              </label>
            </div>

            <textarea
              ref={noteRef}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder={`What was said, and what happens next. "${customer.contact_name?.split(" ")[0] ?? "They"} wants to start in March, sending measurements Friday."`}
            />
            <div style={{ marginTop: 10 }}>
              <Button onClick={addNote} disabled={busy || !noteBody.trim()}>Log it</Button>
            </div>
          </Card>
          )}

          {notes.length === 0 ? (
            <Card><Empty>Nothing logged yet.</Empty></Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${n.kind === 'system' ? C.border : C.accent}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 5 }}>
                    <Pill tone={n.kind === 'system' ? 'neutral' : 'blue'}>{KIND_LABEL[n.kind]}</Pill>
                    <span style={{ fontSize: 12.5, color: C.faint }}>{shortDate(n.happened_on)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {n.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card style={{ marginBottom: 14, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Avatar src={customer.avatar_url} name={customer.contact_name || customer.name} size={84} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              {customer.contact_name || customer.name}
            </div>
            {customer.contact_title && (
              <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>{customer.contact_title}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <Pill tone={customer.stage === 'active' ? 'green' : customer.stage === 'prospect' ? 'amber' : 'neutral'}>
                {customer.stage}
              </Pill>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customer.email ? (
                <a href={`mailto:${customer.email}`} style={{ fontSize: 13.5, color: C.accent, textDecoration: 'none' }}>
                  {customer.email}
                </a>
              ) : (
                /**
                 * Fixable where you notice it.
                 *
                 * The list said "no email, so you can't invoice them" and then
                 * this page said nothing at all, with the actual field buried
                 * behind a button labelled Edit. Being told about a gap in one
                 * place and having to hunt for the fix in another is how a
                 * warning becomes wallpaper.
                 */
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={quickEmail}
                    onChange={(e) => setQuickEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveQuickEmail(); }}
                    type="email"
                    placeholder="Add their email"
                    style={{ ...inputStyle, fontSize: 13.5, padding: '6px 9px' }}
                  />
                  {quickEmail.trim() && (
                    <Button onClick={saveQuickEmail} disabled={busy}>Save</Button>
                  )}
                </div>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} style={{ fontSize: 13.5, color: C.dim, textDecoration: 'none' }}>
                  {customer.phone}
                </a>
              )}
              {customer.website && (
                /* A button rather than a line of small blue text. Opening a
                   client's site is something you do constantly while working
                   on it, and it should not look like a footnote. */
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    marginTop: 6,
                    padding: '6px 11px',
                    borderRadius: 7,
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: C.dim,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="8" cy="8" r="6.3" />
                    <path d="M1.7 8h12.6" />
                    <path d="M8 1.7a10 10 0 0 1 0 12.6 10 10 0 0 1 0-12.6" />
                  </svg>
                  Open {customer.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              )}
              {customer.address && (
                <div style={{ fontSize: 13, color: C.faint }}>{customer.address}</div>
              )}
            </div>

            {customer.awaiting_reply_since && (() => {
              /**
               * Say how long, then say what to do.
               *
               * "No reply since Aug 31" was a fact with no next step attached,
               * and a date is harder to feel than a number of days. What
               * somebody wants here is: how long has this been, and what are
               * my options.
               *
               * Two buttons because there are exactly two honest answers.
               * Chase them again, or accept that you are no longer waiting —
               * which happens constantly and had no way to be recorded, so the
               * warning would have sat there forever going stale.
               */
              const days = Math.max(
                0,
                Math.round(
                  (Date.now() - new Date(customer.awaiting_reply_since).getTime()) / 86_400_000
                )
              );
              return (
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 13px',
                    borderRadius: 8,
                    background: C.amberSoft,
                    border: `1px solid ${C.amber}44`,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                    Waiting on {customer.contact_name?.split(' ')[0] ?? 'them'}
                    {days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.55, marginBottom: 10 }}>
                    You reached out on {shortDate(customer.awaiting_reply_since)} and
                    haven&apos;t heard back. Logging anything they send clears this on its own.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      onClick={() => {
                        setNoteDirection('out');
                        setNoteKind('text');
                        setNoteDate(new Date().toISOString().slice(0, 10));
                        noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        noteRef.current?.focus();
                      }}
                    >
                      Chase them
                    </Button>
                    <Button variant="ghost" onClick={stopWaiting} disabled={busy}>
                      Stop waiting
                    </Button>
                  </div>
                </div>
              );
            })()}

            {customer.last_contacted_on && (
              <div style={{ fontSize: 12, color: C.faint, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                Last contact {shortDate(customer.last_contacted_on)}
              </div>
            )}
          </Card>

          {/*
            The work comes before the filing.
            
            Jobs sat last, under two sections that are usually empty, so the
            money was below the fold on a record whose whole purpose is the
            money. Nobody scrolls to a tile they cannot see, which makes a
            buried action the same as an unbuilt one.
          */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <SectionLabel>{vocab.jobPlural} ({jobs.length})</SectionLabel>
              <Button variant="ghost" onClick={() => router.push('/jobs/new')}>
                New {vocab.job.toLowerCase()}
              </Button>
            </div>
            {jobs.length === 0 ? (
              <Card><Empty>Nothing on the books for them yet.</Empty></Card>
            ) : (
              <Table>
                {jobs.map((j) => (
                  <Row key={j.id} cols="1fr 90px" onClick={() => router.push(`/jobs/${j.id}`)}>
                    <div>{j.name}</div>
                    <div><Pill tone="neutral">{JOB_STATUS_LABEL[j.status]}</Pill></div>
                  </Row>
                ))}
              </Table>
            )}
          </div>

          <BrandCard customerId={params.id} />

          {orgId && <Links orgId={orgId} customerId={params.id} />}

          {orgId && org?.kind === 'contractor' && (
            <Photos orgId={orgId} customerId={params.id} />
          )}
        </div>
      </div>
    </Page>
  );
}
