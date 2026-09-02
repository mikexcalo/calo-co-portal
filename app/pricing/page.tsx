'use client';

/**
 * Price list.
 *
 * Every contractor already has one — in a PDF, a spreadsheet, or Mark's head.
 * The job here is to get it in once so nobody retypes a line item again, and
 * so the same number appears on the estimate, the invoice, and the website
 * rather than three slightly different numbers.
 *
 * Importing reuses the document reader: drop the existing price list PDF and
 * it comes back as rows you check before saving. Same one-time cost per
 * document as a receipt, roughly half a cent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { Processing } from '@/components/spine/Processing';
import { getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import {
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
  useIsPhone,
  SETUP_TABS,
} from '@/components/spine/ui';
import { DropZone } from '@/components/spine/DropZone';

interface PriceItem {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  unit_price: number;
  price_high: number | null;
  kind: 'labor' | 'material' | 'subcontractor' | 'other';
  active: boolean;
  public: boolean;
  /** Someone who sets prices has verified this. */
  confirmed: boolean;
  /** No single rate is honest — quote it per job. */
  varies: boolean;
  source_note: string | null;
  position: number;
}

type Draft = Pick<PriceItem, 'name' | 'description' | 'unit' | 'unit_price' | 'kind' | 'category'>;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default function PricingPage() {
  const phone = useIsPhone();
  const { org, vocab } = useOrg();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [imported, setImported] = useState<Draft[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft>({
    name: '', description: '', unit: '', unit_price: 0, kind: 'labor', category: '',
  });

  const load = useCallback(async () => {
    const o = await getCurrentOrg();
    // Filter by the org we're about to DISPLAY, not just whatever RLS allows.
    // Belt and braces: if the label and the database's scope ever disagree,
    // this returns nothing rather than returning another business's prices.
    // Empty is confusing. Wrong is dangerous.
    const res = o
      ? await supabase.from('price_items').select('*').eq('org_id', o.id).order('position').order('name')
      : { data: [], error: null };
    setOrgId(o?.id ?? null);
    if (res.error) throw new Error(res.error.message);
    setItems(
      (res.data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as unknown as PriceItem),
        unit_price: num(r.unit_price),
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
  }, [load, org?.id]);

  const save = async (rows: Draft[]) => {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      const usable = rows.filter((r) => r.name.trim());
      if (!usable.length) throw new Error('Nothing to save.');

      const res = await supabase.from('price_items').insert(
        usable.map((r, i) => ({
          org_id: orgId,
          name: r.name.trim(),
          description: r.description?.trim() || null,
          category: r.category?.trim() || null,
          unit: r.unit?.trim() || null,
          unit_price: num(r.unit_price),
          kind: r.kind,
          position: items.length + i,
        }))
      );
      if (res.error) throw new Error(res.error.message);

      setNotice(`Added ${usable.length} item${usable.length === 1 ? '' : 's'}.`);
      setAdding(false);
      setImported(null);
      setDraft({ name: '', description: '', unit: '', unit_price: 0, kind: 'labor', category: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: PriceItem, patch: Partial<PriceItem>) => {
    setError(null);
    try {
      const res = await supabase.from('price_items').update(patch).eq('id', item.id);
      if (res.error) throw new Error(res.error.message);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Read an existing price list document into draft rows. */
  const importFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const base64 = await toBase64(file);
      const res = await fetch('/api/pricing/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type, fileName: file.name }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not read that file');

      const rows = (payload.items ?? []) as Draft[];
      if (!rows.length) {
        setError('Nothing recognizable as a price list came back. Add items by hand instead.');
      } else {
        setImported(rows);
        setNotice(
          `Read ${rows.length} item${rows.length === 1 ? '' : 's'}. Check them before saving.`
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const grouped = items.reduce<Record<string, PriceItem[]>>((acc, i) => {
    const k = i.category || 'Uncategorized';
    (acc[k] ??= []).push(i);
    return acc;
  }, {});

  return (
    <Page
      tabs={SETUP_TABS}
      title="Price list"
      subtitle={`What you charge, in one place. Estimates and invoices pull from here, so the same number shows up everywhere.`}
      action={
        <>
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            Import from a file
          </Button>
          <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : 'Add item'}</Button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => importFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />

      {busy && (

        <div style={{ marginBottom: 12 }}>

          <Processing stage="reading" />

        </div>

      )}


      <DropZone
        onFiles={(files) => importFile(files[0] ?? null)}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple={false}
        busy={busy}
        label="Drag a price list here"
        hint="PDF or a photo of a printed sheet, or click to browse. Nothing saves until you check it."
      />

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: C.green, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      {!loading && items.some((i) => !i.confirmed) && (
        <Card style={{ marginBottom: 20, borderColor: C.amber, background: C.amberSoft }}>
          <div style={{ fontSize: 14.5, fontWeight: 500, color: C.text, marginBottom: 6 }}>
            {items.filter((i) => !i.confirmed).length} prices need confirming
          </div>
          <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6 }}>
            These were read from a document or worked out from one job&apos;s totals. A rate
            that was right for one house can be wrong for the next. Access, ceiling height and
            wire runs all move it. <strong>Unconfirmed prices are kept out of estimates</strong>{' '}
            until someone who sets prices ticks them off.
          </div>
        </Card>
      )}

      {imported && (
        <Card style={{ marginBottom: 20, borderColor: C.amber }}>
          <SectionLabel>Check these before saving</SectionLabel>
          <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 14 }}>
            Read from your file. Anything wrong here becomes wrong on every estimate, so it&apos;s
            worth a look.
          </div>
          {imported.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 70px 100px 32px',
                gap: 8,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <input
                value={r.name}
                onChange={(e) =>
                  setImported((p) => p!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                style={inputStyle}
              />
              <input
                value={r.unit ?? ''}
                placeholder="unit"
                onChange={(e) =>
                  setImported((p) => p!.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                }
                style={inputStyle}
              />
              <select
                value={r.kind}
                onChange={(e) =>
                  setImported((p) =>
                    p!.map((x, j) => (j === i ? { ...x, kind: e.target.value as Draft['kind'] } : x))
                  )
                }
                style={{ ...inputStyle, padding: '8px 6px', fontSize: 12.5 }}
              >
                <option value="labor">Labor</option>
                <option value="material">Material</option>
                <option value="subcontractor">Sub</option>
                <option value="other">Other</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={r.unit_price}
                onChange={(e) =>
                  setImported((p) =>
                    p!.map((x, j) => (j === i ? { ...x, unit_price: num(e.target.value) } : x))
                  )
                }
                style={inputStyle}
              />
              <button
                onClick={() => setImported((p) => p!.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 17 }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button onClick={() => save(imported)} disabled={busy}>
              Save {imported.length} item{imported.length === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" onClick={() => setImported(null)}>Discard</Button>
          </div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 20, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={inputStyle}
                placeholder="Demo, bathroom"
                autoFocus
              />
            </Field>
            <Field label="Category">
              <input
                value={draft.category ?? ''}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                style={inputStyle}
                placeholder="Bathrooms"
              />
            </Field>
            <Field label="Unit">
              <input
                value={draft.unit ?? ''}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                style={inputStyle}
                placeholder="room / sq ft / hr"
              />
            </Field>
            <Field label="Price">
              <input
                type="number"
                step="0.01"
                value={draft.unit_price}
                onChange={(e) => setDraft({ ...draft, unit_price: num(e.target.value) })}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Type">
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft['kind'] })}
              style={inputStyle}
            >
              <option value="labor">Labor</option>
              <option value="material">Material</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Button onClick={() => save([draft])} disabled={busy || !draft.name.trim()}>
            Save
          </Button>
        </Card>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : items.length === 0 ? (
        <Card>
          <Empty>
            No prices yet. Import the list you already have, or add items one at a time.
          </Empty>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, rows]) => (
          <div key={category} style={{ marginBottom: 22 }}>
            <SectionLabel>{category}</SectionLabel>
            <Table>
              <Row cols="1fr 100px 130px 100px 80px" header>
                <div>Item</div><div>Unit</div><div>Price</div><div>Status</div><div>On site</div>
              </Row>
              {rows.map((i) => (
                <Row key={i.id} cols="1fr 100px 130px 100px 80px">
                  <div style={{ opacity: i.active ? 1 : 0.5 }}>
                    <div>
                      {i.name}
                      <span style={{ marginLeft: 8 }}>
                        <Pill tone={i.kind === 'labor' ? 'blue' : 'neutral'}>{i.kind}</Pill>
                      </span>
                      {i.varies && (
                        <span style={{ marginLeft: 6 }}>
                          <Pill tone="amber">Varies by job</Pill>
                        </span>
                      )}
                    </div>
                    {i.source_note && !i.confirmed && (
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                        {i.source_note}
                      </div>
                    )}
                  </div>
                  <div style={{ color: C.dim }}>{i.unit || '—'}</div>
                  <div style={{ color: i.confirmed ? C.text : C.faint }}>
                    {i.varies && !i.price_high ? (
                      <span title="Quote this per job">
                        {money(i.unit_price)} <span style={{ fontSize: 11.5 }}>ref.</span>
                      </span>
                    ) : i.price_high ? (
                      `${money(i.unit_price)}–${money(i.price_high)}`
                    ) : (
                      money(i.unit_price)
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: i.confirmed ? C.green : C.amber, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={i.confirmed}
                        onChange={(e) =>
                          toggle(i, {
                            confirmed: e.target.checked,
                            // Confirming a price is what makes it usable.
                            active: e.target.checked ? true : i.active,
                          })
                        }
                      />
                      {i.confirmed ? 'Confirmed' : 'Confirm'}
                    </label>
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={i.public}
                      onChange={(e) => toggle(i, { public: e.target.checked })}
                      title="Show on the public price list"
                    />
                  </div>
                </Row>
              ))}
            </Table>
          </div>
        ))
      )}

      {items.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
          <strong>Confirm</strong> means someone who sets prices has stood behind the number.
          Only confirmed items appear when building an{' '}
          {vocab.estimate?.toLowerCase() ?? 'estimate'}. <strong>Varies by job</strong> marks
          work where no single rate is honest. The figure shown is a reference point, not a
          rate to autofill. <strong>On site</strong> publishes to the public price list your
          website can read.
        </div>
      )}
    </Page>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const comma = r.indexOf(',');
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}
