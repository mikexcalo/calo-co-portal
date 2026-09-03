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
import { buildDrops, sortFiles, type DropFile } from '@/lib/spine/intel';
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
  BRAND_TABS,
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
  const [seed, setSeed] = useState('');
  const [files, setFiles] = useState<DropFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [showStandard, setShowStandard] = useState(false);
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

    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }

    const brandId = res.data.id;

    /**
     * Anything you already have goes in with the same click.
     *
     * Making somebody create the client, land on an empty screen, and then go
     * and find the transcript again is three steps where there should be one.
     * Whatever is in your clipboard right now is the reason you are on this
     * screen at all.
     */
    const hasSeed = seed.trim() || files.length;
    if (hasSeed) {
      const { drops, failed } = await buildDrops(supabase, brandId, {
        text: seed,
        kind: 'note',
        files,
      });
      if (drops.length) {
        await supabase.from('brand_intel').insert(
          drops.map((d) => ({ ...d, org_id: org.data, brand_id: brandId }))
        );
      }
      if (failed.length) setRejected(failed);
    }

    setBusy(false);
    // Straight to intel when there is something to read, because the next
    // thing you want is the reader, not an empty framework.
    router.push(hasSeed ? `/brands/${brandId}/intel` : `/brands/${brandId}/messaging`);
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
      tabs={BRAND_TABS}
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
          {/* Whatever you already have, in the same click. */}
          <Field label="Anything you already know (optional)">
            <textarea
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              rows={4}
              placeholder="Paste a call transcript, your notes, the email that started this, or the copy off their current site."
              style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label
              style={{
                fontSize: 13.5,
                color: C.blue,
                cursor: 'pointer',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '7px 12px',
              }}
            >
              Add photos or files
              <input
                type="file"
                multiple
                accept="image/*,text/*,.md,.vtt,.srt,.csv"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  const { usable, rejected: no } = sortFiles(picked);
                  setFiles((f) => [...f, ...usable]);
                  setRejected(no);
                }}
                style={{ display: 'none' }}
              />
            </label>
            <span style={{ fontSize: 13, color: C.faint }}>
              Photograph your handwritten notes. It reads them.
            </span>
          </div>

          {files.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {files.map((f, i) => (
                <span
                  key={`${f.file.name}-${i}`}
                  style={{
                    fontSize: 12.5,
                    color: C.dim,
                    background: C.panelAlt,
                    borderRadius: 6,
                    padding: '4px 9px',
                  }}
                >
                  {f.file.name}
                  <button
                    onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: C.faint,
                      cursor: 'pointer',
                      marginLeft: 6,
                      fontFamily: 'inherit',
                      padding: 0,
                    }}
                    aria-label={`Remove ${f.file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button onClick={start} disabled={busy || !name.trim()}>
              {busy ? 'Starting…' : 'Start with the ten modules'}
            </Button>
            <span style={{ fontSize: 13, color: C.faint }}>
              {seed.trim() || files.length
                ? 'Kept as dropped. You choose what to read next.'
                : 'Starts empty. You can drop things in at any point.'}
            </span>
          </div>

          {rejected.map((r) => (
            <div key={r} style={{ fontSize: 13.5, color: C.amber, marginTop: 8 }}>{r}</div>
          ))}
          {error && <div style={{ fontSize: 13.5, color: C.red, marginTop: 10 }}>{error}</div>}
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
                    <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 13, color: C.faint, marginTop: 2 }}>
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

                  <div style={{ minWidth: 88, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: C.dim }}>
                    {b.p.locked} / {b.p.total} locked
                  </div>

                  <div style={{ minWidth: 190, fontSize: 13, color: C.faint }}>
                    {b.p.next ? `Next: ${b.p.next.name}` : 'Every module written'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/*
        The standard, folded.

        Ten expandable cards sat open beneath the client list on every visit.
        It is reference material: read once, consulted occasionally, and it was
        taking more of the screen than the thing the page is actually for,
        which is which client needs what next.
      */}
      <div style={{ marginTop: 30 }}>
        <button
          onClick={() => setShowStandard((v) => !v)}
          style={{
            width: '100%', textAlign: 'left', background: 'transparent',
            border: `1px dashed ${C.border}`, borderRadius: 9, padding: '10px 13px',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: C.dim,
          }}
        >
          The ten modules, and what each one needs
          <span style={{ float: 'right', color: C.faint }}>{showStandard ? 'Hide' : 'Read'}</span>
        </button>
      </div>

      <div style={{ marginTop: 12, display: showStandard ? undefined : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FRAMEWORK.map((m, i) => {
            const open = openModule === m.id;
            return (
              <Card key={m.id}>
                <div
                  onClick={() => setOpenModule(open ? null : m.id)}
                  style={{ cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}
                >
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: C.faint, letterSpacing: '.08em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{m.name}</span>
                  <Pill>{m.note}</Pill>
                  <span style={{ fontSize: 13, color: C.faint, marginLeft: 'auto' }}>
                    {open ? 'Hide' : `${m.needs.length} inputs`}
                  </span>
                </div>

                {open && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: '0 0 14px', maxWidth: 640 }}>
                      {m.job}
                    </p>

                    {/* What the module cannot be written without. Inputs, not
                        wording: how you get somebody to hand these over is your
                        job, and a script in somebody else's voice is worse than
                        none. */}
                    <div style={{ marginBottom: 18 }}>
                      <Head tone={C.text}>Needs</Head>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: C.dim, lineHeight: 1.7 }}>
                        {m.needs.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
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
    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: tone, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 17, fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>
      {items.map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}
    </ul>
  );
}
