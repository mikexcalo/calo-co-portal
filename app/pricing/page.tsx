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
} from '@/components/spine/ui';

interface PriceItem {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  unit_price: number;
  kind: 'labor' | 'material' | 'subcontractor' | 'other';
  active: boolean;
  public: boolean;
  position: number;
}

type Draft = Pick<PriceItem, 'name' | 'description' | 'unit' | 'unit_price' | 'kind' | 'category'>;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export default function PricingPage() {
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
    const [o, res] = await Promise.all([
      getCurrentOrg(),
      supabase.from('price_items').select('*').order('position').order('name'),
    ]);
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
          `Read ${rows.length} item${rows.length === 1 ? '' : 's'} — cost ${payload.meta?.cost_cents?.toFixed(2) ?? '?'}¢. Check them before saving.`
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
      title="Price list"
      subtitle={`Standard prices for ${org?.name ?? 'this business'}. Used on estimates and invoices so the same number appears everywhere.`}
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

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: C.green, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 13 }}>{notice}</div>
        </Card>
      )}

      {imported && (
        <Card style={{ marginBottom: 20, borderColor: C.amber }}>
          <SectionLabel>Check these before saving</SectionLabel>
          <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 14 }}>
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
                style={{ ...inputStyle, padding: '8px 6px', fontSize: 11.5 }}
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
                style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 16 }}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={inputStyle}
                placeholder="Demo — bathroom"
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
              <Row cols="1fr 100px 110px 90px 90px" header>
                <div>Item</div><div>Unit</div><div>Price</div><div>On site</div><div>Active</div>
              </Row>
              {rows.map((i) => (
                <Row key={i.id} cols="1fr 100px 110px 90px 90px">
                  <div style={{ opacity: i.active ? 1 : 0.5 }}>
                    {i.name}
                    <span style={{ marginLeft: 8 }}>
                      <Pill tone={i.kind === 'labor' ? 'blue' : 'neutral'}>{i.kind}</Pill>
                    </span>
                  </div>
                  <div style={{ color: C.dim }}>{i.unit || '—'}</div>
                  <div>{money(i.unit_price)}</div>
                  <div>
                    <input
                      type="checkbox"
                      checked={i.public}
                      onChange={(e) => toggle(i, { public: e.target.checked })}
                      title="Show on the public price list"
                    />
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={i.active}
                      onChange={(e) => toggle(i, { active: e.target.checked })}
                      title="Available when building an estimate"
                    />
                  </div>
                </Row>
              ))}
            </Table>
          </div>
        ))
      )}

      {items.length > 0 && (
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
          <strong>On site</strong> publishes an item to the public price list your website can
          read. <strong>Active</strong> controls whether it shows when building an{' '}
          {vocab.estimate?.toLowerCase() ?? 'estimate'} — uncheck rather than delete, so old
          estimates still show what was actually quoted.
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
