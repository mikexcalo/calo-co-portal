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

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
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
  avatar_url: string | null;
  notes: string | null;
  stage: 'prospect' | 'active' | 'past' | 'lost';
  next_action: string | null;
  next_action_on: string | null;
  last_contacted_on: string | null;
}

interface Note {
  id: string;
  kind: 'note' | 'call' | 'email' | 'meeting' | 'quote' | 'system';
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
  email: 'Email',
  meeting: 'Meeting',
  quote: 'Quote',
  system: 'System',
};

export default function CustomerDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { vocab } = useOrg();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [noteBody, setNoteBody] = useState('');
  const [noteKind, setNoteKind] = useState<Note['kind']>('call');
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
        body: noteBody.trim(),
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
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20 }}>
        <div>
          {customer.next_action && !editing && (
            <Card style={{ marginBottom: 16, borderColor: C.amber, background: C.amberSoft }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <SectionLabel>Next step</SectionLabel>
                  <div style={{ fontSize: 14 }}>{customer.next_action}</div>
                  {customer.next_action_on && (
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
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

          <SectionLabel>History</SectionLabel>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['call', 'email', 'meeting', 'note'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setNoteKind(k)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 20,
                    fontSize: 11.5,
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
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              placeholder="Spoke with Mark — wants to start the Elm St bathroom in March, sending measurements Friday."
            />
            <div style={{ marginTop: 10 }}>
              <Button onClick={addNote} disabled={busy || !noteBody.trim()}>Log it</Button>
            </div>
          </Card>

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
                    <span style={{ fontSize: 11.5, color: C.faint }}>{shortDate(n.happened_on)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
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
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {customer.contact_name || customer.name}
            </div>
            {customer.contact_title && (
              <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{customer.contact_title}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <Pill tone={customer.stage === 'active' ? 'green' : customer.stage === 'prospect' ? 'amber' : 'neutral'}>
                {customer.stage}
              </Pill>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customer.email && (
                <a href={`mailto:${customer.email}`} style={{ fontSize: 12.5, color: C.accent, textDecoration: 'none' }}>
                  {customer.email}
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} style={{ fontSize: 12.5, color: C.dim, textDecoration: 'none' }}>
                  {customer.phone}
                </a>
              )}
              {customer.website && (
                <a href={customer.website} target="_blank" rel="noopener" style={{ fontSize: 12.5, color: C.accent, textDecoration: 'none' }}>
                  {customer.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {customer.address && (
                <div style={{ fontSize: 12, color: C.faint }}>{customer.address}</div>
              )}
            </div>

            {customer.last_contacted_on && (
              <div style={{ fontSize: 11, color: C.faint, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                Last contact {shortDate(customer.last_contacted_on)}
              </div>
            )}
          </Card>

          <SectionLabel>{vocab.jobPlural} ({jobs.length})</SectionLabel>
          {jobs.length === 0 ? (
            <Card><Empty>None yet.</Empty></Card>
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
      </div>
    </Page>
  );
}
