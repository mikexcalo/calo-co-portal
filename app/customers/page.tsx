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
import { brandAssetUrl } from '@/lib/spine/db';
import { createCustomer, getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { STAGE, isClient, daysSince, type Stage } from '@/lib/spine/stage';
import { BulkAction, BulkBar, RecordTable, type Column } from '@/components/spine/RecordTable';
import { SavedViews, type View } from '@/components/spine/SavedViews';
import {
  Avatar,
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  money,
  money0,
  radius,
  shortDate,
  CLIENT_TABS,
} from '@/components/spine/ui';

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
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'won' | 'past'>('all');
  const [view, setView] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState(false);
  const [tagWord, setTagWord] = useState('');
  const [today, setToday] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', contact_name: '', contact_title: '', email: '', phone: '', address: '' });

  // After mount only — a date computed during render disagrees with the server.
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const load = useCallback(async () => {
    const [o, res, tg] = await Promise.all([
      getCurrentOrg(),
      supabase.from('customer_summary').select('*').order('name'),
      // Tags live on customers and the summary view predates them. Replacing a
      // view can only append columns, so they are merged here rather than the
      // view being rebuilt for one field.
      supabase.from('customers').select('id, tags'),
    ]);
    setOrgId(o?.id ?? null);
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
      } catch (e) {
        setError((e as Error).message);
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
      setError((e as Error).message);
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

    return rows.filter((r) => {
      // Anything still being chased belongs to Pipeline, not here. A record
      // does not move between lists when it converts; the window changes.
      if (!isClient(r.stage)) return false;
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
    if (bad?.error) setError(bad.error.message);
    setTagWord('');
    setBulkTag(false);
    setPicked(new Set());
    load();
  };

  const moveStage = async (ids: string[], next: Stage) => {
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, stage: next } : r)));
    setPicked(new Set());
    const res = await supabase
      .from('customers')
      .update({ stage: next, stage_why: null, stage_changed_on: new Date().toISOString().slice(0, 10) })
      .in('id', ids);
    if (res.error) { setError(res.error.message); load(); }
  };

  /**
   * What a client row is for.
   *
   * Different columns from Pipeline on purpose: the question here is not how
   * far along they are, it is whether they owe you anything and whether you
   * owe them a reply. Same table, same grammar, different facts.
   */
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
      render: (r) => (
        <span style={{ fontSize: 12.5, color: r.contact_name ? C.dim : C.amber, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {r.contact_name ?? (r.email ? r.email : 'nobody on file')}
        </span>
      ),
    },
    {
      key: 'next',
      label: 'Next step',
      width: 'minmax(140px, 1.6fr)',
      render: (r) => {
        const overdue = Boolean(today && r.next_action_on && r.next_action_on <= today);
        return (
          <span style={{ fontSize: 12.5, color: overdue ? C.amber : r.next_action ? C.dim : C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {r.next_action ?? '—'}
            {r.next_action_on && ` · ${shortDate(r.next_action_on)}`}
          </span>
        );
      },
    },
    {
      key: 'work',
      label: 'Open',
      width: '64px',
      align: 'right',
      sortBy: (r) => -r.open_jobs,
      render: (r) => (
        <span style={{ fontSize: 12.5, color: r.open_jobs ? C.dim : C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {r.open_jobs || '—'}
        </span>
      ),
    },
    {
      key: 'owed',
      label: 'Owed',
      width: '92px',
      align: 'right',
      sortBy: (r) => -r.owed,
      render: (r) => (
        <span style={{ fontSize: 13, color: r.owed > 0 ? C.amber : C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {r.owed > 0 ? money0(r.owed) : '—'}
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
  const dueNow = today ? rows.filter((r) => r.next_action_on && r.next_action_on <= today) : [];
  const owing = rows.filter((r) => r.owed > 0);
  const noEmail = rows.filter((r) => !r.email);

  return (
    <Page
      tabs={CLIENT_TABS}
      title={vocab.customerPlural}
      subtitle={`Everyone you work with, sorted by who needs you first. Totals come straight from their ${vocab.jobPlural.toLowerCase()}.`}
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/customers/import')}>
            Import a list
          </Button>
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : `New ${vocab.customer.toLowerCase()}`}
          </Button>
        </>
      }
    >
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
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} placeholder="Mark Mesedahl" />
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

      {/* What needs doing, before the list of everyone */}
      {!loading && (dueNow.length > 0 || owing.length > 0 || noEmail.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {dueNow.length > 0 && (
            <Flag tone="amber" label="Follow up due" value={String(dueNow.length)} />
          )}
          {owing.length > 0 && (
            <Flag tone="blue" label="Owing you" value={money0(owing.reduce((s, r) => s + r.owed, 0))} />
          )}
          {noEmail.length > 0 && (
            <Flag tone="neutral" label="No email, can't invoice" value={String(noEmail.length)} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${vocab.customerPlural.toLowerCase()}…`}
          style={{ ...inputStyle, maxWidth: 260, background: C.panel }}
        />
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
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label="Filter by brand"
            style={{ ...inputStyle, maxWidth: 190, background: C.panel, fontSize: 13.5 }}
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          <SavedViews
            screen="clients"
            orgId={orgId}
            current={{ q, stageFilter, brandFilter }}
            active={view}
            onApply={applyView}
          />

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
            empty={rows.length === 0 ? `No ${vocab.customerPlural.toLowerCase()} yet.` : 'Nothing matches.'}
          />

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>
            {filtered.length} of {rows.filter((r) => isClient(r.stage)).length}. Tick rows to work
            several at once; shift-click for a run.
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

function Flag({
  tone,
  label,
  value,
}: {
  tone: 'amber' | 'blue' | 'neutral';
  label: string;
  value: string;
}) {
  const fg = tone === 'amber' ? C.amber : tone === 'blue' ? C.accent : C.dim;
  const bg = tone === 'amber' ? C.amberSoft : tone === 'blue' ? C.accentSoft : C.panelAlt;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${C.border}`,
        borderRadius: radius.md,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: 18, color: fg, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );
}
