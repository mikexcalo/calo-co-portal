'use client';

/**
 * Build an estimate.
 *
 * For T&M this is a forecast — the invoice will come from actuals regardless.
 * For fixed price it's the number that gets billed. The UI says which, because
 * the difference matters to the person typing it.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimate, getCurrentOrg, getJob } from '@/lib/spine/db';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { planAllows } from '@/lib/spine/modules';
import type { JobWithCustomer, LineKind } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Field,
  Page,
  inputStyle,
  money,
} from '@/components/spine/ui';

interface DraftLine {
  kind: LineKind;
  description: string;
  qty: string;
  unit: string;
  unit_price: string;
  /**
   * Priced but not included. The customer ticks it or ignores it, and the
   * total on the estimate is the base until they do.
   */
  optional: boolean;
}

const blank = (kind: LineKind = 'labor'): DraftLine => ({
  kind,
  description: '',
  qty: '1',
  unit: kind === 'labor' ? 'hr' : '',
  unit_price: '',
  optional: false,
});

export default function EstimatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { vocab, org } = useOrg();
  const canOptional = planAllows(org, 'optional_lines');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [job, setJob] = useState<JobWithCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blank('labor')]);
  const [notes, setNotes] = useState('');
  const [scopeIn, setScopeIn] = useState('');
  const [scopeOut, setScopeOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The price list, so nobody retypes a line item they already priced. */
  const [catalog, setCatalog] = useState<
    Array<{ id: string; name: string; unit: string | null; unit_price: number; kind: LineKind; category: string | null }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const [org, j] = await Promise.all([getCurrentOrg(), getJob(params.id)]);
        setOrgId(org?.id ?? null);
        setJob(j);
        if (j && org) {
          setLines([
            {
              ...blank('labor'),
              unit_price: String(j.labor_rate ?? org.default_labor_rate ?? ''),
            },
          ]);
        }
        const cat = await supabase
          .from('price_items')
          .select('id, name, unit, unit_price, kind, category')
          .eq('active', true)
          // Unconfirmed prices stay out. A number nobody has stood behind is
          // worse than no number, because no number makes you think.
          .eq('confirmed', true)
          .order('category')
          .order('name');
        if (!cat.error) {
          setCatalog(
            (cat.data ?? []).map((r: Record<string, unknown>) => ({
              ...(r as { id: string; name: string; unit: string | null; kind: LineKind; category: string | null }),
              unit_price: Number(r.unit_price) || 0,
            }))
          );
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [params.id]);

  /** Drop a catalog item onto the estimate at its standard price. */
  const addFromCatalog = (id: string) => {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      {
        kind: item.kind,
        description: item.name,
        qty: '1',
        optional: false,
        unit: item.unit ?? '',
        unit_price: String(item.unit_price),
      },
    ]);
  };

  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const lineTotal = (l: DraftLine) =>
    (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0);

  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const valid = lines.some((l) => l.description.trim() && lineTotal(l) > 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!orgId) throw new Error('No business selected.');
      const usable = lines.filter((l) => l.description.trim() && lineTotal(l) > 0);

      await createEstimate(
        orgId,
        params.id,
        usable.map((l, i) => ({
          kind: l.kind,
          description: l.description.trim(),
          qty: parseFloat(l.qty) || 0,
          unit: l.unit || null,
          unit_price: parseFloat(l.unit_price) || 0,
          total: Math.round(lineTotal(l) * 100) / 100,
          optional: l.optional,
          position: i,
        })),
        {
          notes,
          // Blank lines dropped rather than stored. An empty bullet on a
          // document a client is about to accept reads as carelessness.
          scopeIn: scopeIn.split('\n').map((x) => x.trim()).filter(Boolean),
          scopeOut: scopeOut.split('\n').map((x) => x.trim()).filter(Boolean),
        }
      );

      router.push(`/jobs/${params.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const isTM = job?.billing_type === 'tm';

  return (
    <Page
      title={`New ${vocab.estimate.toLowerCase()}`}
      subtitle={job?.name}
      action={
        <Button variant="ghost" onClick={() => router.push(`/jobs/${params.id}`)}>
          Cancel
        </Button>
      }
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {job && (
        <Card style={{ marginBottom: 16, borderColor: isTM ? `${C.blue}44` : C.border }}>
          <div style={{ fontSize: 13.5, color: C.dim }}>
            {isTM ? (
              <>
                This job is <strong style={{ color: C.text }}>time &amp; materials</strong> —
                this is a forecast. The invoice will be built from hours actually logged and
                receipts actually filed, not from this number.
              </>
            ) : (
              <>
                This job is <strong style={{ color: C.text }}>fixed price</strong> — once
                accepted, this is the number that gets billed. Actual costs affect your
                margin, not the customer&apos;s bill.
              </>
            )}
          </div>
        </Card>
      )}

      <Card>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,2fr) 70px 60px 90px 80px 32px',
              gap: 8,
              alignItems: 'end',
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: i < lines.length - 1 ? `1px solid ${C.border}` : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>
                <select
                  value={line.kind}
                  onChange={(e) => update(i, { kind: e.target.value as LineKind })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: C.faint,
                    fontSize: 11.5,
                    fontFamily: 'inherit',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <option value="labor">LABOR</option>
                  <option value="material">MATERIAL</option>
                  <option value="subcontractor">SUB</option>
                  <option value="other">OTHER</option>
                </select>
                {/* Beside the kind rather than in its own column: it is a
                    property of the line, and a whole column for a checkbox
                    would push the grid past a phone's width. */}
                {canOptional && (
                <label style={{ marginLeft: 12, cursor: 'pointer', color: line.optional ? C.blue : C.faint }}>
                  <input
                    type="checkbox"
                    checked={line.optional}
                    onChange={(e) => update(i, { optional: e.target.checked })}
                    style={{ width: 12, height: 12, marginRight: 4, accentColor: C.accent, cursor: 'pointer' }}
                  />
                  OPTIONAL
                </label>
                )}
              </div>
              <input
                value={line.description}
                onChange={(e) => update(i, { description: e.target.value })}
                style={inputStyle}
                placeholder="Demo and haul away"
              />
            </div>

            <div>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>QTY</div>
              <input
                type="number"
                step="0.25"
                value={line.qty}
                onChange={(e) => update(i, { qty: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>UNIT</div>
              <input
                value={line.unit}
                onChange={(e) => update(i, { unit: e.target.value })}
                style={inputStyle}
                placeholder="hr"
              />
            </div>

            <div>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>PRICE</div>
              <input
                type="number"
                step="0.01"
                value={line.unit_price}
                onChange={(e) => update(i, { unit_price: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ fontSize: 14, paddingBottom: 9, textAlign: 'right' }}>
              {money(lineTotal(line))}
            </div>

            <button
              onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
              disabled={lines.length === 1}
              style={{
                background: 'none',
                border: 'none',
                color: C.faint,
                cursor: lines.length === 1 ? 'default' : 'pointer',
                fontSize: 17,
                paddingBottom: 6,
                opacity: lines.length === 1 ? 0.3 : 1,
              }}
              title="Remove line"
            >
              ×
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {catalog.length > 0 && (
            <select
              value=""
              onChange={(e) => { addFromCatalog(e.target.value); e.target.value = ''; }}
              style={{ ...inputStyle, width: 'auto', minWidth: 200, padding: '8px 10px' }}
            >
              <option value="">Add from price list…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.unit_price.toFixed(2)}{c.unit ? `/${c.unit}` : ''}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" onClick={() => setLines((p) => [...p, blank('labor')])}>
            + Labor
          </Button>
          <Button variant="ghost" onClick={() => setLines((p) => [...p, blank('material')])}>
            + Material
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'baseline',
            gap: 12,
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: 13, color: C.faint }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 500 }}>{money(total)}</span>
        </div>
      </Card>

      {/*
        What the price covers, and what it does not.
        
        On the estimate rather than on the engagement, because this is the
        document the client actually reads and accepts by name. A scope they
        never saw settles no argument in week six.
        
        One line each, because a paragraph gets skimmed and a list gets read.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
          marginTop: 16,
        }}
      >
        <Field label="What this covers">
          <textarea
            value={scopeIn}
            onChange={(e) => setScopeIn(e.target.value)}
            style={{ ...inputStyle, minHeight: 96, resize: 'vertical', lineHeight: 1.6 }}
            placeholder={'One per line.\nBrand and messaging framework\nFour page website\nTwo rounds of revisions'}
          />
        </Field>
        <Field label="What it does not">
          <textarea
            value={scopeOut}
            onChange={(e) => setScopeOut(e.target.value)}
            style={{ ...inputStyle, minHeight: 96, resize: 'vertical', lineHeight: 1.6 }}
            placeholder={'One per line.\nPhotography\nOngoing content after launch\nPages beyond the four listed'}
          />
        </Field>
      </div>
      <p style={{ fontSize: 13, color: C.faint, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.6 }}>
        The second list is the one that matters and the one nobody writes without being asked.
        Both appear on the copy the client accepts.
      </p>

      <div style={{ marginTop: 16, maxWidth: 620 }}>
        <Field label="Notes for the customer">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            placeholder="Excludes permit fees. Tile allowance $8/sq ft."
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button onClick={save} disabled={busy || !valid}>
          {busy ? 'Saving…' : `Save ${vocab.estimate.toLowerCase()}`}
        </Button>
      </div>
    </Page>
  );
}
