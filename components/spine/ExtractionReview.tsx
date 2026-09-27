'use client';

/**
 * Approve what was read before it becomes data.
 *
 * Every document — receipt, PDF, photograph of a scribbled note — stops here
 * first. The extraction shows exactly what it thinks it found, field by
 * field, and nothing is written until the account owner says yes.
 *
 * The reason this is a hard gate rather than a toast: an unreviewed wrong
 * amount becomes a wrong job cost, which becomes a wrong invoice, which
 * becomes a conversation with a customer about why they were overcharged. The
 * cost of one extra click is nothing against that.
 *
 * Every field is editable here, because "mostly right, one digit off" is the
 * common failure and re-shooting the photo to fix it would be absurd.
 */

import { useEffect, useState } from 'react';
import type { CostKind, DocumentKind, ExtractedReceipt } from '@/lib/spine/types';
import { Button, C, Field, Pill, Select, Sheet, inputStyle, money, radius } from './ui';

export interface ReviewResult {
  kind: DocumentKind;
  vendor: string | null;
  purchased_on: string | null;
  amount: number | null;
  category: CostKind | null;
  summary: string;
}

const KINDS: DocumentKind[] = [
  'receipt', 'invoice', 'estimate', 'permit', 'contract', 'photo', 'other', 'unknown',
];

const CATEGORIES: CostKind[] = ['material', 'subcontractor', 'equipment', 'permit', 'other'];

export function ExtractionReview({
  fileName,
  previewUrl,
  extracted,
  costCents,
  onApprove,
  onReject,
}: {
  fileName: string;
  previewUrl: string | null;
  extracted: (ExtractedReceipt & { kind?: DocumentKind }) | null;
  costCents?: number;
  onApprove: (result: ReviewResult) => void;
  onReject: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(extracted?.kind ?? 'unknown');
  const [vendor, setVendor] = useState(extracted?.vendor ?? '');
  const [date, setDate] = useState(extracted?.purchased_on ?? '');
  const [amount, setAmount] = useState(
    extracted?.amount != null ? String(extracted.amount) : ''
  );
  const [category, setCategory] = useState<CostKind>(
    (extracted?.category as CostKind) ?? 'material'
  );
  const [summary, setSummary] = useState(extracted?.summary ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onReject();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReject]);

  const amountNum = parseFloat(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;

  // A missing field is the extraction being honest, not a failure. Say so, so
  // nobody thinks it's broken when it's actually being careful.
  const missing: string[] = [];
  if (!vendor.trim()) missing.push('vendor');
  if (!date) missing.push('date');
  if (!amountOk) missing.push('amount');

  return (
    <Sheet width={680} label="Check what was read" onClose={onReject}>
      <div>
        {/* Its own header block: the file name sits under the title and a
            rule separates both from the fields, which Sheet's plain title
            does not do. */}
        <div style={{ paddingBottom: 14, marginBottom: 4, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Check what was read</div>
          <div style={{ fontSize: 13, color: C.faint, marginTop: 3 }}>
            {fileName}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, padding: 22, flexWrap: 'wrap' }}>
          {previewUrl && (
            <div
              style={{
                width: 170,
                flexShrink: 0,
                background: C.panelAlt,
                borderRadius: radius.md,
                border: `1px solid ${C.border}`,
                padding: 8,
                alignSelf: 'flex-start',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="The document"
                style={{ width: '100%', borderRadius: 4, display: 'block' }}
              />
              <div style={{ fontSize: 11.5, color: C.faint, textAlign: 'center', marginTop: 6 }}>
                What was read
              </div>
            </div>
          )}

          <div style={{ flex: 1, minWidth: 260 }}>
            {missing.length > 0 && (
              <div
                style={{
                  background: C.amberSoft,
                  border: `1px solid ${C.amber}44`,
                  borderRadius: radius.md,
                  padding: 11,
                  fontSize: 13.5,
                  color: C.amber,
                  marginBottom: 16,
                  lineHeight: 1.55,
                }}
              >
                Couldn&apos;t read the <strong>{missing.join(', ')}</strong> confidently, so
                {missing.length === 1 ? ' it was' : ' they were'} left blank rather than guessed.
                Fill in what you can see.
                {extracted?.review_reason && (
                  <div style={{ marginTop: 6, opacity: 0.9 }}>{extracted.review_reason}</div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="What is it?">
                <Select
                  value={kind}
                  onChange={(v) => setKind(v as DocumentKind)}
                  options={KINDS.map((k) => ({ value: k, label: k }))}
                />
              </Field>
              <Field label="Category">
                <Select
                  value={category}
                  onChange={(v) => setCategory(v as CostKind)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
            </div>

            <Field label="Vendor">
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                style={inputStyle}
                placeholder="Home Depot"
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Amount">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: amountOk ? C.border : C.amber,
                  }}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <Field label="Description">
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                style={inputStyle}
                placeholder="Lumber, framing"
              />
            </Field>

            {extracted?.line_items && extracted.line_items.length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 6 }}>
                  Line items it also picked up
                </div>
                <div
                  style={{
                    background: C.panelAlt,
                    borderRadius: radius.sm,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: C.dim,
                    maxHeight: 110,
                    overflowY: 'auto',
                  }}
                >
                  {extracted.line_items.map((li, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{li.description}</span>
                      <span>{money(li.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 22px',
            borderTop: `1px solid ${C.border}`,
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 12.5, color: C.faint }}>
            {amountOk ? (
              <>Will be saved as <strong style={{ color: C.text }}>{money(amountNum)}</strong></>
            ) : (
              'An amount is needed before this can be saved.'
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={onReject}>Discard</Button>
            <Button
              onClick={() =>
                onApprove({
                  kind,
                  vendor: vendor.trim() || null,
                  purchased_on: date || null,
                  amount: amountNum,
                  category,
                  summary: summary.trim() || vendor.trim() || 'Cost',
                })
              }
              disabled={!amountOk}
            >
              Approve &amp; save
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Small badge for anywhere that needs to say a human signed off. */
export function ApprovedBadge() {
  return <Pill tone="green">Approved by you</Pill>;
}
