'use client';

/**
 * CRM.
 *
 * The first version was a name, an email and three numbers — a contact list.
 * A CRM's actual job is answering "who do I need to deal with today", so this
 * leads with that: anything overdue for a follow-up, anything owing money,
 * anything gone quiet.
 *
 * Faces matter more than they sound. People recall a photo instantly and a
 * row of text not at all, which is why the avatar is the biggest element.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { brandAssetUrl, hoursByClient, orgNow } from '@/lib/spine/db';
import { createCustomer } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { FirstSteps } from '@/components/spine/FirstSteps';
import { STAGE, isClient, daysSince, type Stage } from '@/lib/spine/stage';
import { BulkAction, BulkBar, RecordTable, type Column } from '@/components/spine/RecordTable';
import { Glyph } from '@/components/spine/icons';
import type { ClientHours } from '@/lib/spine/types';
import { SavedViews, type View } from '@/components/spine/SavedViews';
import { ClientIntake } from '@/components/spine/ClientIntake';
import {
  Tiles,
  hours,
  Select,
  Avatar,
  Button,
  C,
  Card,
  Empty,
  Field,
  Figures,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  money,
  money0,
  radius,
  shortDate,
  clientTabs,
  SearchField,
} from '@/components/spine/ui';
import { human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';

interface Summary {
  /** Same value as customer_id. The shared table keys every list on `id`. */
  id: string;
  customer_id: string;
  name: string;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  phone: string | null;
  logo_path: string | null;
  waiting_on: string | null;
  stage: Stage;
  /**
   * customer, supplier or other.
   *
   * A company you deal with is not necessarily one you sell to — the utility
   * you file permits with, the warehouse whose sheet you watch. They were all
   * customers because that was the only list a company could be in.
   */
  relationship: 'customer' | 'supplier' | 'other';
  /** Merged in from customers; the summary view does not carry it. */
  tags?: string[];
  next_action: string | null;
  next_action_on: string | null;
  last_contacted_on: string | null;
  jobs: number;
  open_jobs: number;
  invoiced: number;
  collected: number;
  owed: number;

  unbilled: number;
  last_note_on: string | null;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/**
 * This list is the people you have, not the people you want.
 *
 * Both used to live here, so a hundred and four companies nobody had spoken to
 * sat in the same list as three paying clients and the word Clients meant
 * neither. Pipeline is the same table read from the other end.
 */
const STAGE_TONE: Record<string, 'amber' | 'green' | 'neutral'> = {
  won: 'green',
  past: 'neutral',
  cold: 'neutral',
};

export default function CustomersPage() {
  const router = useRouter();
  const { vocab, org } = useOrg();
  const [rows, setRows] = useState<Summary[]>([]);
  /* Time per client, so the screen says something before you click into one. */
  const [clientHours, setClientHours] = useState<ClientHours[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /*
    A search term that means "the ones with no email".

    The tile counted them and the list gave no way to find them, so this is
    what pressing it types into the filter — the same list, narrowed, rather
    than a second mode with its own rules.
  */
  const NO_EMAIL = '\u0000no-email';
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'won' | 'past'>('all');
  const [kindFilter, setKindFilter] = useState<'customer' | 'supplier' | 'other'>('customer');
  const [view, setView] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState(false);
  const [tagWord, setTagWord] = useState('');
  const [today, setToday] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', contact_name: '', contact_title: '', email: '', phone: '', address: '' });

  // After mount only — a date computed during render disagrees with the server.
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const load = useCallback(async () => {
    /*
      Three round trips that did not need to happen.

      The await on orgNow() sat INSIDE the Promise.all array, so it resolved
      before the array was even built — nothing ran in parallel, the two
      queries simply queued behind it. And getCurrentOrg() was there to supply
      an org id that orgNow() already had: it calls auth.getUser(), which
      revalidates the token against the auth server on every call. The comment
      on orgNow says as much, and calls it the whole reason the app got slow
      one afternoon.

      So opening Clients was a token revalidation, then a profile read, then
      the two queries it actually wanted — in series. That is the wait before
      the screen fills in, and the empty "Customers" heading sitting there
      while it happens.

      The org is resolved once, off the cached value, and the queries go
      together.
    */
    const org = await orgNow();
    const [res, tg] = await Promise.all([
      supabase.from('customer_summary').select('*').eq('org_id', org).order('name'),
      // Tags live on customers and the summary view predates them. Replacing a
      // view can only append columns, so they are merged here rather than the
      // view being rebuilt for one field.
      supabase.from('customers').select('id, tags'),
    ]);
    setOrgId(org);
    if (res.error) throw new Error(res.error.message);
    const tagsById = new Map(
      ((tg.data ?? []) as Array<{ id: string; tags: string[] | null }>).map((t) => [t.id, t.tags ?? []])
    );
    setRows(
      (res.data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as unknown as Summary),
        // The table keys on id; this view names it customer_id.
        id: String(r.customer_id),
        tags: tagsById.get(String(r.customer_id)) ?? [],
        jobs: num(r.jobs),
        open_jobs: num(r.open_jobs),
        invoiced: num(r.invoiced),
        collected: num(r.collected),
        owed: num(r.owed),
        unbilled: num(r.unbilled),
      }))
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
        const orgId = await orgNow();
        if (orgId) {
          const now = new Date();
          const since = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          setClientHours(await hoursByClient(orgId, since));
        }
      } catch (e) {
        setError(human((e as Error).message));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!orgId) throw new Error('No business selected.');
      await createCustomer(orgId, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ...(form.contact_name.trim() ? { contact_name: form.contact_name.trim() } : {}),
        ...(form.contact_title.trim() ? { contact_title: form.contact_title.trim() } : {}),
      } as never);
      setForm({ name: '', contact_name: '', contact_title: '', email: '', phone: '', address: '' });
      setAdding(false);
      await load();
    } catch (e) {
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Brands a client owns, for the agency view.
   *
   * A client and a brand are not the same thing and searching by contact name
   * only finds one of them. A parent company can hold several identities, and
   * the one you carry in your head is usually the brand, not the legal entity
   * that pays the invoice.
   *
   * Contractors never see this: they have no brands, so the row never renders.
   */
  const [brands, setBrands] = useState<Array<{ id: string; name: string; customer_id: string | null }>>([]);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    if (!org) return;
    supabase
      .from('brands')
      .select('id, name, customer_id')
      .eq('org_id', org.id)
      .neq('status', 'archived')
      .order('name')
      .then(({ data }) => setBrands(data ?? []));
  }, [org]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const brandClient =
      brandFilter === 'all' ? null : brands.find((b) => b.id === brandFilter)?.customer_id ?? null;

    if (term === NO_EMAIL) {
      return rows.filter(
        (r) => isClient(r.stage) && (r.relationship ?? 'customer') === kindFilter && !r.email
      );
    }

    return rows.filter((r) => {
      // Anything still being chased belongs to Pipeline, not here. A record
      // does not move between lists when it converts; the window changes.
      if (!isClient(r.stage)) return false;
      // A supplier or a utility is not somebody you sell to, so it is not
      // counted here and never offered an invoice.
      if ((r.relationship ?? 'customer') !== kindFilter) return false;
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (brandFilter !== 'all' && r.customer_id !== brandClient) return false;
      if (!term) return true;
      // Brand names are searchable too, so typing "Colette" finds the client
      // even when the record is filed under a different legal name.
      const brandNames = brands.filter((b) => b.customer_id === r.customer_id).map((b) => b.name);
      return [r.name, r.contact_name, r.email, r.phone, ...brandNames].some((v) =>
        v?.toLowerCase().includes(term)
      );
    });
  }, [rows, q, stageFilter, brandFilter, brands]);

  const applyView = (v: View | null) => {
    setView(v?.id ?? null);
    const f = (v?.filters ?? {}) as { q?: string; stageFilter?: 'all' | 'won' | 'past'; brandFilter?: string };
    setQ(f.q ?? '');
    setStageFilter(f.stageFilter ?? 'all');
    setBrandFilter(f.brandFilter ?? 'all');
  };

  /** Adds a tag to many without wiping the ones each already had. */
  const addTag = async (ids: string[], word: string) => {
    const w = word.trim();
    if (!w) return;
    const out = await Promise.all(
      rows
        .filter((r) => ids.includes(r.id) && !(r.tags ?? []).includes(w))
        .map((r) => supabase.from('customers').update({ tags: [...(r.tags ?? []), w] }).eq('id', r.id))
    );
    const bad = out.find((o) => o.error);
    if (bad?.error) setError(human(bad.error.message));
    setTagWord('');
    setBulkTag(false);
    setPicked(new Set());
    load();
  };

  const moveStage = async (ids: string[], next: Stage) => {
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, stage: next } : r)));
    setPicked(new Set());
    const res = await saveOrFail(supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .in('id', ids));
    if (res.error) { setError(human(res.error.message)); load(); }
  };

  /**
   * What a client row is for.
   *
   * Different columns from Pipeline on purpose: the question here is not how
   * far along they are, it is whether they owe you anything and whether you
   * owe them a reply. Same table, same grammar, different facts.
   */
  /*
    Worst first, and only things that are actually yours to do.

    Owed money outranks unbilled work outranks silence, because that is the
    order they cost you. A client with nothing outstanding gets a dash rather
    than a cheerful sentence — the row is a scan, not a conversation.
  */
  const needsYou = (r: Summary): { text: string; tone?: string; rank: number } => {
    if (r.owed > 0) return { text: `${money0(r.owed)} owed`, tone: C.red, rank: 5 };
    if (!r.email && !r.contact_name) return { text: 'No way to reach them', tone: C.amber, rank: 4 };
    if (r.waiting_on) return { text: `Waiting: ${r.waiting_on}`, tone: C.amber, rank: 3 };
    if (r.next_action) return { text: r.next_action, tone: C.dim, rank: 2 };
    if (r.unbilled > 0) return { text: `${money0(r.unbilled)} to bill`, tone: C.amber, rank: 2 };
    const quiet = daysSince(r.last_contacted_on);
    if (quiet != null && quiet >= 21) return { text: `Quiet ${quiet} days`, tone: C.amber, rank: 1 };
    return { text: '–', rank: 0 };
  };
  const needsRank = (r: Summary) => needsYou(r).rank;

  const columns: Column<Summary>[] = [
    {
      key: 'name',
      label: vocab.customer,
      width: 'minmax(170px, 1.8fr)',
      sortBy: (r) => r.name.toLowerCase(),
      render: (r) => (
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <Avatar src={brandAssetUrl(r.logo_path)} name={r.name} size={19} shape="company" />
          <span style={{ fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name}
          </span>
          {r.stage === 'past' && <Pill tone="neutral">past</Pill>}
        </span>
      ),
    },
    {
      key: 'who',
      label: 'Who',
      width: 'minmax(120px, 1.2fr)',
      /*
        Who, rather than the same name twice.

        A residential customer IS a person, so the company and the contact are
        the same words — Mammoth's list read "Nikhail / Nikhail" across two
        columns. Where the contact adds nothing, the column says what it does
        know instead: the email, or that nobody is on file.

        And the client with no email is marked here. Home says "1 client with
        no email" and sends you to this screen, which then showed a count in a
        tile and gave no way at all to tell which row it meant. Four rows is
        guessable; forty is not.
      */
      render: (r) => {
        const same =
          r.contact_name &&
          r.contact_name.trim().toLowerCase() === r.name.trim().toLowerCase();
        const who = same ? null : r.contact_name;
        return (
          <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            <span style={{ color: who ? C.dim : C.faint }}>
              {who ?? (r.email ? r.email : 'nobody on file')}
            </span>
            {!r.email && (
              <span style={{ color: C.red, marginLeft: who ? 8 : 0 }}>· no email</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'next',
      label: 'Next step',
      width: 'minmax(140px, 1.6fr)',
      /* Nobody has named one yet, so this was a column of dashes. */
      hasValue: (r) => Boolean(r.next_action),
      render: (r) => {
        const overdue = Boolean(today && r.next_action_on && r.next_action_on <= today);
        return (
          <span style={{ fontSize: 12.5, color: overdue ? C.amber : r.next_action ? C.dim : C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {r.next_action ?? '–'}
            {r.next_action_on && ` · ${shortDate(r.next_action_on)}`}
          </span>
        );
      },
    },
    /*
      The reason you were about to click.

      This column counted open jobs, which is a number you cannot act on: "1"
      tells you there is something without telling you whether it needs you or
      is simply under way. Every visit to this screen started by clicking a
      client to find out what was going on with them.

      One phrase, worst first. Nothing to do says so, which is also an answer.
    */
    {
      key: 'needs',
      label: 'Needs you',
      width: 'minmax(150px, 1fr)',
      sortBy: (r) => -needsRank(r),
      render: (r) => {
        const n = needsYou(r);
        return (
          <span style={{ fontSize: 12.5, color: n.tone ?? C.faint }}>
            {n.text}
          </span>
        );
      },
    },
    {
      key: 'month',
      label: 'This month',
      width: '110px',
      align: 'right',
      sortBy: (r) => -(byClient.get(r.id)?.hours ?? 0),
      /* Nobody has logged against them, so the column stays out of the way
         until somebody does. */
      hasValue: (r) => (byClient.get(r.id)?.hours ?? 0) > 0,
      render: (r) => {
        const h = byClient.get(r.id);
        if (!h?.hours) return <span style={{ fontSize: 13, color: C.faint }}>–</span>;
        return (
          <span style={{ fontSize: 13, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
            {hours(h.hours)}
            {h.unbilled_value > 0 && (
              <span style={{ color: C.amber }}> · {money0(h.unbilled_value)}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'owed',
      label: 'Owed',
      width: '92px',
      align: 'right',
      sortBy: (r) => -r.owed,
      render: (r) => (
        /*
          Red, and to the cent.

          Amber means "needs you"; money already invoiced and not paid is past
          that. And the Invoices table prints $80.00 for the same row this one
          printed as $80 — so the rule is now explicit: tiles round, because a
          headline number is for scale, and table rows are exact, because a
          row is something you reconcile against.
        */
        <span style={{ fontSize: 13, color: r.owed > 0 ? C.red : C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {r.owed > 0 ? money(r.owed) : '–'}
        </span>
      ),
    },
    {
      key: 'last',
      label: 'Last',
      width: '70px',
      align: 'right',
      sortBy: (r) => daysSince(r.last_contacted_on) ?? 99_999,
      render: (r) => {
        const d = daysSince(r.last_contacted_on);
        return (
          <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
            {d === null ? 'never' : d === 0 ? 'today' : `${d}d`}
          </span>
        );
      },
    },
  ];

  // The three things a CRM should shout about.
  /**
   * Counted over clients, not over everybody.
   *
   * These read `rows`, which since the merge holds the whole pipeline too. So
   * John's screen announced "104 No email, can't invoice" — a hundred and four
   * distributors he has never contacted, who are not clients, and who nobody
   * would invoice. A number that large and that red on an otherwise empty
   * screen reads as a fault in the product rather than a fact about the data.
   */
  const clients = useMemo(
    () => rows.filter((r) => isClient(r.stage) && (r.relationship ?? 'customer') === 'customer'),
    [rows]
  );
  /** How many sit under each of the three, so a tab with nothing in it is not offered. */
  const kindCounts = useMemo(() => {
    const m = { customer: 0, supplier: 0, other: 0 } as Record<string, number>;
    for (const r of rows) if (isClient(r.stage)) m[r.relationship ?? 'customer'] += 1;
    return m;
  }, [rows]);
  const monthHours = clientHours.reduce((a, r) => a + r.hours, 0);
  const byClient = new Map(clientHours.filter((h) => h.customer_id).map((h) => [h.customer_id as string, h]));
  const dueNow = today ? clients.filter((r) => r.next_action_on && r.next_action_on <= today) : [];
  const owing = clients.filter((r) => r.owed > 0);
  const noEmail = clients.filter((r) => !r.email);

  return (
    <Page
      tabs={clientTabs(org?.kind)}
      title={vocab.customerPlural}
      subtitle={`Everyone you work with.`}
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/customers/import')}>
            Import a list
          </Button>
          {/*
            The other way in. Most of what you know about a new client arrives
            as a photograph of a page, not as typing.
          */}
          <Button variant="ghost" onClick={() => { setDropping((v) => !v); setAdding(false); }}>
            {dropping ? 'Cancel' : 'Drop what you have'}
          </Button>
          <Button onClick={() => { setAdding((v) => !v); setDropping(false); }}>
            {adding ? 'Cancel' : `New ${vocab.customer.toLowerCase()}`}
          </Button>
        </>
      }
    >
      {dropping && orgId && (
        <ClientIntake orgId={orgId} onSaved={load} onClose={() => setDropping(false)} />
      )}

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 20, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            <Field label={vocab.customer === 'Client' ? 'Company' : 'Name'}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} autoFocus />
            </Field>
            <Field label="Contact person">
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} placeholder="Their name" />
            </Field>
            <Field label="Their title">
              <input value={form.contact_title} onChange={(e) => setForm({ ...form, contact_title: e.target.value })} style={inputStyle} placeholder="Owner" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </Card>
      )}

      {/*
        The same four tiles as Home, scoped to clients.

        This was three figures on one line, every one of them hideAtZero, so
        on a book where nobody is overdue and nobody owes anything the strip
        vanished and the screen opened straight onto a table of dashes. It told
        you nothing until you clicked into somebody.

        The shapes match Home deliberately. Two screens that show the state of
        the same business should not teach two different ways of reading it,
        and a number you can act on should be the thing you press.
      */}
      {/*
        Four tiles used to sit here, and they pushed the list below the fold.

        Owed to you, Unbilled, Time this month, Need a nudge — three of those
        four are on Home, one screen away, and summed across every client they
        answer nothing you act on. On a list of three you scrolled past $0, $0
        and 0 to reach the only content on the page.

        The money that matters is per client, and it is on their row.
      */}

      {/*
        Tools appear when there is something to search.
        
        A search box, three stage filters and a brand dropdown sat above four
        rows, which is more chrome than list. They earn their place at forty
        clients and are noise at four, so they arrive when the list does.
      */}
      {/*
        The search box stays; the filters are what wait.

        This whole strip was hidden below eight rows, on the reasoning that a
        search box above four clients is more chrome than list. That is true of
        three stage filters and a brand dropdown. It is not true of the search
        box, which People shows from the first row, so the same act worked on
        one screen and the control was simply absent on the other, with nothing
        saying why.
      */}
      {/*
        Who they are to you, before anything else about them.

        Only shown once there is more than one kind on file. Until Mark files a
        permit or John saves a warehouse sheet, every company here is somebody
        he sells to and three tabs would be two lies.
      */}
      {(kindCounts.supplier > 0 || kindCounts.other > 0) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {([
            { id: 'customer' as const, label: `${vocab.customerPlural} (${kindCounts.customer})`, hint: 'People you sell to.' },
            { id: 'supplier' as const, label: `Suppliers (${kindCounts.supplier})`, hint: 'People you buy from.' },
            { id: 'other' as const, label: `Other (${kindCounts.other})`, hint: 'Companies you deal with where no money moves either way.' },
          ]).map((o) => (
            <button
              key={o.id}
              onClick={() => setKindFilter(o.id)}
              title={o.hint}
              style={{
                padding: '6px 13px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1px solid ${kindFilter === o.id ? C.ink : C.border}`,
                background: kindFilter === o.id ? C.panelAlt : 'transparent',
                color: kindFilter === o.id ? C.text : C.dim,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* The sentinel is a filter, not something anybody typed. */}
        <SearchField
          value={q === NO_EMAIL ? '' : q}
          onChange={setQ}
          placeholder={`Search ${vocab.customerPlural.toLowerCase()}`}
          style={{ flex: '0 1 280px' }}
        />
        {(rows.length > 7 || stageFilter !== 'all' || brandFilter !== 'all') && (
        <>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'won', 'past'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 13,
                border: `1px solid ${stageFilter === s ? C.accent : C.border}`,
                background: stageFilter === s ? C.accentSoft : 'transparent',
                color: stageFilter === s ? C.text : C.dim,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Only appears once there is more than one brand to choose between.
            A filter with a single option is furniture. */}
        {brands.length > 1 && (
          <Select
            value={brandFilter}
            onChange={setBrandFilter}
            style={{ maxWidth: 190 }}
            options={[
              { value: 'all', label: 'All brands' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        )}
        </>
        )}
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <FirstSteps
          copy={{
            title: `No ${vocab.customerPlural.toLowerCase()} yet`,
            blurb: `Everyone you work with lives here, the ones paying you now and the ones you are still talking to, in one list rather than two.`,
            steps: [
              'Add one by hand. A name is genuinely enough; the email, phone and address can be filled in as you learn them.',
              'Or import a spreadsheet if you already keep the list somewhere else, the columns get matched up for you.',
              `Once somebody is in here you can start a ${vocab.job.toLowerCase()} against them, and everything they owe you follows from that.`,
            ],
            action: { label: 'Import a list', href: '/customers/import' },
          }}
        />
      ) : (
        <>
          {rows.length > 7 && (
            <SavedViews
              screen="clients"
              orgId={orgId}
              current={{ q, stageFilter, brandFilter }}
              active={view}
              onApply={applyView}
            />
          )}

          {/*
            The same table Pipeline uses.

            This was a stack of cards: 120px a row, a 17px bold name, email and
            phone as links, a Next box. Readable at three clients, unusable at
            thirty, and it silently said a client matters seven times more than
            a prospect, which stops being true the moment a prospect is worth
            more than a client.
          */}
          <RecordTable
            rows={filtered}
            columns={columns}
            selected={picked}
            onSelect={setPicked}
            onOpen={(r) => router.push(`/customers/${r.id}`)}
            empty={
              /*
                Say which of the two reasons it actually is.

                An empty list here had one explanation — "nobody has been
                marked won yet, so everyone is still in Pipeline" — and used it
                for both reasons a row can be missing. Mammoth's screen showed
                it while holding Austin Energy, which IS won; it is filed as a
                utility, so it sits under Other. The message named the wrong
                cause and pointed at Pipeline, which a contractor's sidebar
                does not have — their leads are in Jobs.

                Two causes, two sentences, and neither names a screen that is
                not there.
              */
              clients.length > 0
                ? 'Nothing matches.'
                : kindCounts.supplier + kindCounts.other > 0
                  ? `Nothing filed as somebody you sell to. ${kindCounts.supplier + kindCounts.other} under the other tabs.`
                  : rows.length > 0
                    ? `Nobody marked won yet, ${rows.length} still being chased in ${vocab.jobPlural}.`
                    : `No ${vocab.customerPlural.toLowerCase()} yet.`
            }
          />

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>
            {filtered.length} of {clients.length}. Tick rows to work several at once; shift-click
            for a run.
          </div>

          <BulkBar count={picked.size} onClear={() => setPicked(new Set())}>
            {bulkTag ? (
              <input
                value={tagWord}
                onChange={(e) => setTagWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag(Array.from(picked), tagWord);
                  if (e.key === 'Escape') { setBulkTag(false); setTagWord(''); }
                }}
                placeholder="Tag them…"
                autoFocus
                style={{
                  border: '1px solid rgba(255,255,255,.3)', background: 'transparent',
                  borderRadius: 999, padding: '4px 12px', fontSize: 12.5,
                  color: C.panel, fontFamily: 'inherit', width: 150, outline: 'none',
                }}
              />
            ) : (
              <BulkAction onClick={() => setBulkTag(true)}>Tag</BulkAction>
            )}
            <BulkAction onClick={() => moveStage(Array.from(picked), 'past')}>Mark past</BulkAction>
            <BulkAction onClick={() => moveStage(Array.from(picked), 'talking')}>Back to pipeline</BulkAction>
          </BulkBar>
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 72 }}>
      <div
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: C.faint,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, marginTop: 3, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

