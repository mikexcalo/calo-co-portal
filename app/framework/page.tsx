'use client';

/**
 * The standard, and where every client sits against it.
 *
 * This is the agency-level view: one framework, applied the same way to
 * everybody. The per-brand screens are where the work happens; this is where
 * you see whether the process is actually being followed, and it is the only
 * place the framework itself can be read without opening somebody's account.
 *
 * Two things are load bearing here. Starting a client applies the ten modules
 * empty, so nobody rebuilds the structure by hand and quietly drops the module
 * they find awkward. And the progress column is the same computation for every
 * client, which is what makes it a standard rather than ten similar projects.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { FRAMEWORK, blankFramework, progress, type BrandModule } from '@/lib/spine/framework';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
} from '@/components/spine/ui';

interface BrandRow {
  id: string;
  name: string;
  customer_id: string | null;
  messaging: BrandModule[] | null;
  customer?: { name: string } | null;
}

interface CustomerRow {
  id: string;
  name: string;
}

export default function FrameworkPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([
      supabase
        .from('brands')
        .select('id, name, customer_id, messaging, customer:customers(name)')
        .neq('status', 'archived')
        .order('name'),
      supabase.from('customers').select('id, name').order('name'),
    ]);
    if (b.data) setBrands(b.data as unknown as BrandRow[]);
    if (c.data) setCustomers(c.data as CustomerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    const org = await supabase.rpc('current_org_id');
    const res = await supabase
      .from('brands')
      .insert({
        org_id: org.data,
        name: name.trim(),
        customer_id: customerId || null,
        messaging: blankFramework(),
        status: 'building',
      })
      .select('id')
      .single();

    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    router.push(`/brands/${res.data.id}/messaging`);
  };

  const rows = useMemo(
    () =>
      brands.map((b) => ({
        ...b,
        p: progress(b.messaging ?? []),
      })),
    [brands]
  );

  return (
    <Page
      title="Brand framework"
      subtitle="One process, ten modules, every client. Each module is an input to the next, so the order is the method."
      action={
        <Button onClick={() => setStarting((s) => !s)}>
          {starting ? 'Cancel' : 'Start a client'}
        </Button>
      }
    >
      {starting && (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="Brand name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Their company or product name"
                style={inputStyle}
                autoFocus
              />
            </Field>
            <Field label="Client (optional)">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={inputStyle}>
                <option value="">Your own brand</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button onClick={start} disabled={busy || !name.trim()}>
              {busy ? 'Starting…' : 'Start with the ten modules'}
            </Button>
            <span style={{ fontSize: 12, color: C.faint }}>
              Starts empty. You fill it by dropping in what they tell you.
            </span>
          </div>
          {error && <div style={{ fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</div>}
        </Card>
      )}

      {/* Where everybody stands. First, because this is the question you open
          the page with. The framework below is reference. */}
      <div style={{ marginTop: starting ? 26 : 0 }}>
        <SectionLabel>Clients on the framework ({rows.length})</SectionLabel>
        {loading ? (
          <Card><Empty>Loading…</Empty></Card>
        ) : rows.length === 0 ? (
          <Card>
            <Empty>
              Nobody yet. Start a client and the ten modules are created empty, ready for you to
              drop a discovery call into.
            </Empty>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((b) => (
              <Card key={b.id}>
                <div
                  onClick={() => router.push(`/brands/${b.id}/messaging`)}
                  style={{ cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <div style={{ minWidth: 160, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                      {b.customer?.name ?? 'Your own brand'}
                    </div>
                  </div>

                  {/* Ten cells, one per module, in framework order. A shape you
                      read in a glance beats a percentage you have to think about. */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    {FRAMEWORK.map((m) => {
                      const held = (b.messaging ?? []).find((x) => x.id === m.id);
                      const tone =
                        held?.state === 'locked' ? C.green
                        : held?.state === 'testing' ? C.amber
                        : held?.content?.trim() ? C.borderStrong
                        : C.panelAlt;
                      return (
                        <span
                          key={m.id}
                          title={`${m.name} · ${held?.state ?? 'open'}`}
                          style={{
                            width: 16,
                            height: 22,
                            borderRadius: 3,
                            background: tone,
                            border: `1px solid ${C.border}`,
                          }}
                        />
                      );
                    })}
                  </div>

                  <div style={{ minWidth: 88, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: C.dim }}>
                    {b.p.locked} / {b.p.total} locked
                  </div>

                  <div style={{ minWidth: 190, fontSize: 12, color: C.faint }}>
                    {b.p.next ? `Next: ${b.p.next.name}` : 'Every module written'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* The standard itself. Reference, and the discovery sheet you work
          from on a call. */}
      <div style={{ marginTop: 30 }}>
        <SectionLabel>The ten modules</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FRAMEWORK.map((m, i) => {
            const open = openModule === m.id;
            return (
              <Card key={m.id}>
                <div
                  onClick={() => setOpenModule(open ? null : m.id)}
                  style={{ cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}
                >
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: C.faint, letterSpacing: '.08em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{m.name}</span>
                  <Pill>{m.note}</Pill>
                  <span style={{ fontSize: 12, color: C.faint, marginLeft: 'auto' }}>
                    {open ? 'Hide' : `${m.asks.length} questions`}
                  </span>
                </div>

                {open && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '0 0 14px', maxWidth: 640 }}>
                      {m.job}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                      <div>
                        <Head tone={C.blue}>What to ask</Head>
                        <List items={m.asks} />
                      </div>
                      <div>
                        <Head tone={C.faint}>How to write it</Head>
                        <List items={m.how} />
                      </div>
                      <div>
                        <Head tone={C.red}>Common failures</Head>
                        <List items={m.failures} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Page>
  );
}

function Head({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: tone, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
      {items.map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}
    </ul>
  );
}
