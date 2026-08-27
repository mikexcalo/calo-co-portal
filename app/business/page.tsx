'use client';

/**
 * Business settings — the values that used to be hardcoded.
 *
 * Labor rate, material markup and tax live here, per business. They start at
 * zero deliberately: a zero rate produces an obviously wrong invoice, which is
 * safer than a plausible-looking guessed number nobody chose.
 */

import { useEffect, useState } from 'react';
import { updateOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
} from '@/components/spine/ui';

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <div style={{ fontSize: 12, color: C.faint }}>Not available.</div>;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        style={{ ...inputStyle, fontSize: 11.5, fontFamily: 'ui-monospace, monospace' }}
      />
      <Button
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export default function BusinessPage() {
  const { org, vocab, loading, refresh } = useOrg();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [rate, setRate] = useState('');
  const [markup, setMarkup] = useState('');
  const [tax, setTax] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setRate(String(org.default_labor_rate ?? 0));
    setMarkup(String(org.default_material_markup_pct ?? 0));
    setTax(String(org.tax_rate ?? 0));
  }, [org]);

  const save = async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateOrg(org.id, {
        name: name.trim() || org.name,
        default_labor_rate: parseFloat(rate) || 0,
        default_material_markup_pct: parseFloat(markup) || 0,
        tax_rate: parseFloat(tax) || 0,
      });
      await refresh();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page title="Business"><Card>Loading…</Card></Page>;
  if (!org) {
    return (
      <Page title="Business">
        <Card>No business selected.</Card>
      </Page>
    );
  }

  const unset = (parseFloat(rate) || 0) === 0;

  return (
    <Page
      title={org.name}
      subtitle={`Defaults applied to every new ${vocab.job.toLowerCase()}`}
      action={<Pill tone={org.kind === 'agency' ? 'blue' : 'green'}>
        {org.kind === 'agency' ? 'Agency' : 'Contractor'}
      </Pill>}
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}
      {saved && (
        <Card style={{ borderColor: `${C.green}55`, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 13 }}>Saved.</div>
        </Card>
      )}
      {unset && (
        <Card style={{ borderColor: `${C.amber}55`, marginBottom: 16 }}>
          <div style={{ color: C.amber, fontSize: 13 }}>
            The hourly rate is still $0, so invoices will come out at zero. Set it before
            billing anything real.
          </div>
        </Card>
      )}

      <Card style={{ maxWidth: 560 }}>
        <Field label="Business name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Default hourly rate ($)">
          <input
            type="number"
            step="1"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            style={inputStyle}
            placeholder="85"
          />
        </Field>

        <Field label="Material markup (%)">
          <input
            type="number"
            step="0.5"
            min="0"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            style={inputStyle}
            placeholder="15"
          />
        </Field>
        <div style={{ fontSize: 11.5, color: C.faint, margin: '-8px 0 14px' }}>
          Added to receipts when they're billed. A $100 receipt at 15% bills as $115.
        </div>

        <Field label="Tax rate (%)">
          <input
            type="number"
            step="0.1"
            min="0"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            style={inputStyle}
            placeholder="5.5"
          />
        </Field>

        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </Card>

      <Card style={{ maxWidth: 560, marginTop: 18 }}>
        <SectionLabel>Connect other things to this</SectionLabel>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Calendar</div>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 8px', lineHeight: 1.6 }}>
            Subscribe to this in Google or Apple Calendar and scheduled jobs appear alongside
            everything else. One-way and read-only — jobs with no dates don&apos;t show up.
          </p>
          <CopyRow value={org.calendar_token ? `${origin}/api/calendar/${org.calendar_token}` : ''} />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Price list feed</div>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 8px', lineHeight: 1.6 }}>
            For your website to pull live prices. Returns only items marked both{' '}
            <strong>on site</strong> and <strong>confirmed</strong>, so nothing unverified can
            reach a customer.
          </p>
          <CopyRow value={org.price_feed_token ? `${origin}/api/public/prices/${org.price_feed_token}` : ''} />
        </div>

        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 16, lineHeight: 1.6 }}>
          Treat both links as private. Anyone holding one can read what it exposes — nothing
          more, and neither allows any changes.
        </div>
      </Card>
    </Page>
  );
}
