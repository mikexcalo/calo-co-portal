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
  inputStyle,
} from '@/components/spine/ui';

export default function BusinessPage() {
  const { org, vocab, loading, refresh } = useOrg();
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
    </Page>
  );
}
