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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Glyph } from '@/components/spine/icons';
import { brandAssetUrl, getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import { StageBar } from '@/components/spine/StageBar';
import { Tags } from '@/components/spine/Tags';
import { Enrich } from '@/components/spine/Enrich';
import type { Stage } from '@/lib/spine/stage';
import { Links } from '@/components/spine/Links';
import { Photos } from '@/components/spine/Photos';
import { People } from '@/components/spine/People';
import { Discovery } from '@/components/spine/Discovery';
import { ClientDocs } from '@/components/spine/ClientDocs';
import { Brief } from '@/components/spine/Brief';
import { ClientUpdate } from '@/components/spine/ClientUpdate';
import { TheirSite } from '@/components/spine/TheirSite';
import { Waiting } from '@/components/spine/Waiting';
import { ClientBrandFiles } from '@/components/spine/ClientBrandFiles';
import { ClientCatalog } from '@/components/spine/ClientCatalog';
import { SayIt } from '@/components/spine/SayIt';
import { Plan } from '@/components/spine/Plan';
import { ClientWork } from '@/components/spine/ClientWork';
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
  logo_url: string | null;
  notes: string | null;
  stage: Stage;
  tags?: string[] | null;
  stage_why?: string | null;
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
  /**
   * Does this business sell a list of things?
   *
   * Read from the business's own modules rather than the client's, because it
   * is a fact about how the business works. John sells other people's seafood,
   * so every principal on his list has a product list. An agency selling hours
   * has none of them, and should not carry the tab.
   */
  const hasCatalog = useMemo(() => modulesFor(org).has('catalog'), [org]);
  const [stageBusy, setStageBusy] = useState(false);
  /** Every tag already in use here, so the vocabulary converges by itself. */
  const [knownTags, setKnownTags] = useState<string[]>([]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  /** Resolved from the brand kit, or the override. A function, not a column. */
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /**
   * The logging form starts folded.
   *
   * It was five chips, two more chips, a date picker and a textarea, permanently
   * open, and it sat above the history it was for. On a client with nothing
   * logged that is a screen of controls guarding an empty box. Logging is a
   * thing you do occasionally; reading what happened is what you came for.
   */
  const [logging, setLogging] = useState(false);
  /**
   * Folded unless there is nothing else on the page.
   *
   * A client with a brief, work and documents does not need their whole
   * timeline unrolled underneath it. A brand new client has nothing else, so
   * the log is the only thing to show and hiding it would leave a blank page.
   */
  const [showHistory, setShowHistory] = useState(false);
  /**
   * Views of one record, not a scroll.
   *
   * Eight sections stacked meant four screens of scrolling to reach the
   * history, and every section I added made the one below it further away.
   * They are not a sequence, they are four questions you ask at different
   * times: where are we, what is the work, what did they give us, what
   * happened.
   *
   * Local state rather than routes, because switching view on a record is not
   * navigation and should not cost a page load or a history entry.
   */
  /**
   * Openable from a link, so a tile can point at a tab.
   *
   * Still local state rather than routing: switching view on a record is not
   * navigation, and should not cost a page load. The query string is only read
   * once, to honor where somebody was sent.
   */
  const [view, setView] = useState<'now' | 'work' | 'given' | 'history' | 'brand' | 'catalog'>(
    (typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('tab') as
        | 'now' | 'work' | 'given' | 'history' | 'brand' | 'catalog')) || 'now'
  );
  /**
   * Counts on the tabs, from the one view that already has them.
   *
   * A tab that says nothing about what is behind it makes you click every tab
   * to find out where anything is, which is the scroll again with extra steps.
   */
  const [counts, setCounts] = useState<{ given: number }>({ given: 0 });
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
    const [o, c, lg, n, j, tg] = await Promise.all([
      getCurrentOrg(),
      supabase.from('customers').select('*').eq('id', params.id).maybeSingle(),
      supabase.rpc('customer_logo_path', { cust: params.id }),
      supabase
        .from('customer_notes')
        .select('id, kind, body, happened_on, created_at')
        .eq('customer_id', params.id)
        .order('happened_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, name, status').eq('customer_id', params.id),
      // Every tag in use, for the suggestion list. Free text splits into
      // Northeast, northeast and North East unless what already exists is
      // offered, and then the filter finds a third of them.
      supabase.from('customers').select('tags'),
    ]);

    setOrgId(o?.id ?? null);
    if (c.error) throw new Error(c.error.message);
    setCustomer(c.data as Customer | null);
    setDraft((c.data ?? {}) as Partial<Customer>);
    setLogoPath((lg.data as string | null) ?? null);
    if (!n.error) setNotes((n.data ?? []) as Note[]);
    if (!j.error) setJobs((j.data ?? []) as JobRow[]);
    if (!tg.error) {
      const all = new Set<string>();
      ((tg.data ?? []) as Array<{ tags: string[] | null }>).forEach((r) =>
        (r.tags ?? []).forEach((t) => all.add(t))
      );
      setKnownTags(Array.from(all).sort());
    }
  }, [params.id]);

  /**
   * Moving the stage by hand.
   *
   * Clears the reason, because a reason describes the move that put it there
   * and leaving "they replied on 5 September" underneath a stage you set
   * yourself is a caption that lies about who decided.
   */
  const setStage = async (next: Stage) => {
    if (!customer) return;
    setStageBusy(true);
    setCustomer({ ...customer, stage: next, stage_why: null });
    const res = await supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .eq('id', params.id);
    setStageBusy(false);
    if (res.error) { setError(res.error.message); load(); }
  };

  const saveTags = async (next: string[]) => {
    if (!customer) return;
    setCustomer({ ...customer, tags: next });
    const res = await supabase.from('customers').update({ tags: next }).eq('id', params.id);
    if (res.error) { setError(res.error.message); load(); }
    else setKnownTags((k) => Array.from(new Set([...k, ...next])).sort());
  };

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
          logo_url: draft.logo_url?.trim() || null,
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
      back={{ label: vocab.customerPlural, href: '/customers' }}
      title={customer.name}
      subtitle={
        [customer.website?.replace(/^https?:\/\//, '').replace(/\/$/, ''), customer.stage]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/customers')}>All</Button>
          <Button onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</Button>
        </>
      }
    >
      {logoPath && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Avatar src={brandAssetUrl(logoPath)} name={customer.name} size={34} shape="company" />
          <span style={{ fontSize: 12.5, color: C.faint }}>
            {customer.website
              ? customer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
              : 'Their mark'}
          </span>
        </div>
      )}

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
          /**
           * The second column only exists where it has something in it.
           *
           * The contact, the engagements and the brand are the work. On the
           * brief and on the documents they were an empty rail down the right
           * hand side while the reading column was squeezed into two thirds of
           * the width, which is the wasted space: not too little content, the
           * wrong shape for it.
           */
          gridTemplateColumns:
            phone || view === 'given' || view === 'brand' || view === 'catalog'
              ? '1fr'
              : 'minmax(0, 1.25fr) minmax(340px, 1fr)',
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
                {/* No stage here. It is a bar at the top of this record now,
                    and two controls for one field is how they disagree: this
                    panel would happily save "active", a word the lane no
                    longer has. */}
                <Field label="Website">
                  <input value={draft.website ?? ''} onChange={(e) => setDraft({ ...draft, website: e.target.value })} style={inputStyle} placeholder="https://" />
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
              {/* Their mark, not their face. Faces are on the people, in
                  People, because a client is a company and a company does not
                  have a head. */}
              <Field label="Logo URL">
                <input
                  value={draft.logo_url ?? ''}
                  onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
                  style={inputStyle}
                  placeholder={logoPath && !draft.logo_url ? 'Using the brand kit' : 'https://…/logo.svg'}
                />
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
          {/*
            Where this one stands, above the tabs.

            It was a small grey pill in the right rail reading the raw word
            "prospect", and it changed through a dropdown inside an edit panel.
            A stage nobody can see is a stage nobody updates, and a pipeline
            that is not updated is out of date by the second week.
          */}
          <StageBar
            stage={customer.stage}
            why={customer.stage_why}
            busy={stageBusy}
            onChange={setStage}
          />

          {/* Only offered when there is nothing to lose. A company with a
              website on file has already been filled in by somebody. */}
          {!customer.website && (
            <Enrich customerId={params.id} currentName={customer.name} onSaved={load} />
          )}

          {/* Tags under it, because what a company is and where it stands are
              the two things you want before anything else on the page. */}
          <div style={{ marginBottom: 18 }}>
            <Tags
              tags={customer.tags ?? []}
              known={knownTags}
              onChange={saveTags}
            />
          </div>

          {/* Above everything. The first thing you read, and the only
              thing you could hand to somebody else. */}
          {/*
            Four nouns, an icon each, and a count where there is one.
            
            The names were a sentence each and no two were the same shape, so
            none of them told you what was behind it. Nouns are checkable: you
            can be wrong about whether Documents holds documents.
          */}
          <div
            style={{
              display: 'inline-flex',
              gap: 3,
              marginBottom: 20,
              padding: 3,
              borderRadius: 10,
              background: C.panelAlt,
              border: `1px solid ${C.border}`,
              maxWidth: '100%',
              overflowX: 'auto',
            }}
          >
            {([
              ['now', 'Brief', 'brief'],
              ['work', 'Work', 'work'],
              /**
               * Only for businesses that sell a list of things.
               *
               * A tab strip is not free. Every business gets Brief and Work
               * and nobody has to be told what they are; a Catalog tab on a
               * client who sells services is a tab that opens empty forever,
               * which teaches people the strip is full of dead ends. Switched
               * on per business in Access, off everywhere else.
               */
              ...(hasCatalog ? [['catalog', 'Catalog', 'pricing'] as const] : []),
              ['given', 'Documents', 'documents'],
              // A client's brand belongs to that client. The module in the
              // sidebar is your own; this is theirs.
              ['brand', 'Brand', 'swatches'],
              ['history', 'Activity', 'activity'],
            ] as const).map(([id, label, icon]) => {
              const on = view === id;
              const count = id === 'given' ? counts.given : id === 'history' ? notes.length : 0;
              return (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: `1px solid ${on ? C.border : 'transparent'}`,
                    background: on ? C.panel : 'transparent',
                    boxShadow: on ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                    color: on ? C.text : C.dim,
                    fontSize: 13.5,
                    fontWeight: on ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Glyph name={icon} color={on ? C.accent : C.faint} />
                  {label}
                  {count > 0 && (
                    <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {view === 'now' && (
            <>
              <Waiting customerId={params.id} />
              {orgId && (
                <SayIt
                  customerId={params.id}
                  clientName={customer.name}
                  orgId={orgId}
                  onDone={load}
                />
              )}
              <Brief customerId={params.id} clientName={customer.name} />
              <ClientUpdate customerId={params.id} clientName={customer.name} />
            </>
          )}

          {view === 'work' && (
            <>
              <Plan customerId={params.id} clientName={customer.name} />
              <ClientWork customerId={params.id} />
              {orgId && (
                <TheirSite
                  customerId={params.id}
                  clientName={customer.name}
                  orgId={orgId}
                  website={customer.website}
                />
              )}
            </>
          )}

          {view === 'given' && (
            <>
              <Discovery customerId={params.id} />
              <ClientDocs customerId={params.id} />
            </>
          )}

          {view === 'brand' && (
            <>
              <BrandCard customerId={params.id} />
              <ClientBrandFiles customerId={params.id} />
            </>
          )}

          {view === 'catalog' && orgId && (
            <ClientCatalog
              customerId={params.id}
              orgId={orgId}
              clientName={customer.name}
            />
          )}

          {view === 'history' && orgId && <Reminders orgId={orgId} customerId={params.id} />}

          {view === 'history' && (<>
          {/*
            Below the work, and folded.
            
            A timeline answers what happened, which you ask second. The brief
            above answers where we are, which is what you opened the page for.
            Leading with the timeline made every client look like a wall of
            text with the answer buried in it.
          */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 10, color: C.faint }}>{showHistory ? '▼' : '▶'}</span>
              <SectionLabel>History ({notes.length})</SectionLabel>
            </button>
            <Button variant="ghost" onClick={() => { setShowHistory(true); setLogging((v) => !v); }}>
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
            // The one empty state that earns itself: a client with nothing
            // logged is a client nobody has spoken to, which is worth saying.
            <Card>
              <Empty>
                Nothing logged yet. History is for short things that happened: texted Mark, no
                answer. Anything longer than a paragraph belongs in Capture, which files it as a
                document with a summary above it.
              </Empty>
            </Card>
          ) : !showHistory ? (
            /* Folded. The most recent line is enough to know whether to open
               it, and it is the line you would have scrolled to anyway. */
            <button
              onClick={() => setShowHistory(true)}
              style={{
                width: '100%', textAlign: 'left', background: C.panel,
                border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 3 }}>
                {shortDate(notes[0].happened_on ?? notes[0].created_at)}
              </div>
              <div
                style={{
                  fontSize: 13.5, color: C.dim, lineHeight: 1.6,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notes[0].body}
              </div>
            </button>
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
          </>)}
        </div>

        <div style={{ display: view === 'given' || view === 'brand' || view === 'catalog' ? 'none' : undefined }}>
          {/*
            The business, then whoever you talk to there.
            
            An 84px portrait above a name, centered, is a profile card for a
            person. The client is the company, and most companies have more
            than one person in them: this is the main contact, not the client.
          */}
          {/*
            The people, not a person.

            This card led with one name copied off the company row, while the
            real list of people sat behind the Work tab. One truth in two
            places, and the shallow one was the one you saw first. The list
            itself lives here now, where you look when you want to know who to
            write to, and adding a second person is a button rather than a
            schema change somebody has to ask for.
          */}

          {orgId && <People orgId={orgId} customerId={params.id} />}

          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Search for this client, not for you. Only offered when they
                have a site, because search work with nothing to point at is
                not work anybody can start. */}
            {customer.website && (
              <button
                onClick={() => router.push(`/seo?client=${params.id}`)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: 7, marginTop: 6, padding: '6px 11px', borderRadius: 7,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  fontSize: 13.5, fontWeight: 500, color: C.dim,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                Their search setup
              </button>
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

            {/*
              Moved, and shrunk.

              This was an amber card with a heading, two lines of prose and two
              buttons: five lines of screen to say "waiting on John, twelve
              days". It also could not say what the wait was for, so the one
              piece of information worth having was the one it left out.

              It is one line at the top of the record now, in Waiting, which
              holds the reason as well as the clock.
            */}

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
              null
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


          {orgId && <Links orgId={orgId} customerId={params.id} />}

          {orgId && org?.kind === 'contractor' && (
            <Photos orgId={orgId} customerId={params.id} />
          )}
        </div>
      </div>
    </Page>
  );
}
