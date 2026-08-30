'use client';

/**
 * Business settings.
 *
 * Three unrelated things used to sit stacked on one scrolling page: what you
 * charge, how you get paid, and links out to other tools. Changing a payment
 * handle meant scrolling past tax rates to find it, and the Save button that
 * applied to it sat above the section rather than inside it — so people saved
 * their work, saw nothing move, and assumed it had not taken.
 *
 * Tabs now, and each tab owns its own Save with its own confirmation directly
 * underneath the thing being saved.
 */

import { useCallback, useEffect, useState } from 'react';
import { updateOrg } from '@/lib/spine/db';
import {
  METHODS,
  looksLikeAccountNumber,
  specFor,
  type PaymentMethod,
} from '@/lib/spine/payments';
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

type Tab = 'rates' | 'payments' | 'connections';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'rates', label: 'What you charge' },
  { id: 'payments', label: 'How you get paid' },
  { id: 'connections', label: 'Connections' },
];

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

/** Save button plus its own confirmation, directly under what it saves. */
function SaveBar({
  onSave,
  busy,
  saved,
  label = 'Save',
}: {
  onSave: () => void;
  busy: boolean;
  saved: boolean;
  label?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <Button onClick={onSave} disabled={busy}>
        {busy ? 'Saving…' : label}
      </Button>
      {saved && (
        <span style={{ fontSize: 12.5, color: C.green, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span aria-hidden>✓</span> Saved
        </span>
      )}
    </div>
  );
}

export default function BusinessPage() {
  const { org, vocab, loading, refresh } = useOrg();
  const [tab, setTab] = useState<Tab>('rates');
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const [rate, setRate] = useState('');
  const [markup, setMarkup] = useState('');
  const [tax, setTax] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  /**
   * Saved methods show as a summary until you ask to change them. Leaving the
   * form permanently open made settled work look unsaved — every visit
   * presented the same empty-looking boxes and invited you to type it all in
   * again.
   */
  const [editingPayments, setEditingPayments] = useState(false);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/config/payments')
      .then((r) => r.json())
      .then((d) => setStripeReady(!!d.stripe))
      .catch(() => setStripeReady(false));
  }, []);

  const hydrate = useCallback(() => {
    if (!org) return;
    setName(org.name);
    setRate(String(org.default_labor_rate ?? 0));
    setMarkup(String(org.default_material_markup_pct ?? 0));
    setTax(String(org.tax_rate ?? 0));
    const existing = (org.payment_methods ?? []) as PaymentMethod[];
    setMethods(
      METHODS.map((spec) => {
        const found = Array.isArray(existing) ? existing.find((m) => m.id === spec.id) : null;
        return found ?? { id: spec.id, enabled: false, handle: '', note: '' };
      })
    );
  }, [org]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const save = async (which: Tab) => {
    if (!org) return;
    setBusy(true);
    setError(null);
    setSavedTab(null);
    try {
      await updateOrg(org.id, {
        name: name.trim() || org.name,
        default_labor_rate: parseFloat(rate) || 0,
        default_material_markup_pct: parseFloat(markup) || 0,
        tax_rate: parseFloat(tax) || 0,
        payment_methods: methods.filter((m) => m.enabled) as unknown as Record<string, unknown>[],
      });
      await refresh();
      setSavedTab(which);
      if (which === 'payments') setEditingPayments(false);
      setTimeout(() => setSavedTab(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page title="Business"><Card>Loading…</Card></Page>;
  if (!org) return <Page title="Business"><Card>No business selected.</Card></Page>;

  const unset = (parseFloat(rate) || 0) === 0;
  const active = methods.filter((m) => m.enabled);

  return (
    <Page
      title={org.name}
      subtitle="Your rates, how customers pay you, and what connects to this."
      action={
        <Pill tone={org.kind === 'agency' ? 'blue' : 'green'}>
          {org.kind === 'agency' ? 'Agency' : 'Contractor'}
        </Pill>
      }
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${on ? C.blue : 'transparent'}`,
                color: on ? C.text : C.faint,
                fontWeight: on ? 600 : 500,
                fontSize: 13.5,
                padding: '8px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {tab === 'rates' && (
        <>
          {unset && (
            <Card style={{ borderColor: `${C.amber}55`, marginBottom: 16, maxWidth: 560 }}>
              <div style={{ color: C.amber, fontSize: 13, lineHeight: 1.6 }}>
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
              Added to receipts when they&apos;re billed. A $100 receipt at 15% bills as $115.
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

            <SaveBar onSave={() => save('rates')} busy={busy} saved={savedTab === 'rates'} />
          </Card>

          <div style={{ fontSize: 12, color: C.faint, marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>
            These are starting points applied to every new {vocab.job.toLowerCase()}. You can
            change any of them on an individual {vocab.job.toLowerCase()} without affecting these.
          </div>
        </>
      )}

      {tab === 'payments' && (
        <Card style={{ maxWidth: 620 }}>
          <SectionLabel>How you get paid</SectionLabel>

          {/* The page title already names the business, and that was not
              enough — one person's Venmo handle got saved against another
              business's account, which would have told their customers to
              pay the wrong person. Anything that ends up in front of someone
              else's customers says whose it is, right where you type it. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: C.blueSoft,
              border: `1px solid ${C.blue}33`,
              borderRadius: 8,
              padding: '10px 13px',
              margin: '10px 0 16px',
              fontSize: 12.5,
              color: C.text,
              lineHeight: 1.5,
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>↳</span>
            <span>
              These are <strong>{org.name}</strong>&apos;s payment details. They appear on
              invoices {org.name} sends, so their customers pay {org.name}.
            </span>
          </div>

          <p style={{ fontSize: 13, color: C.dim, margin: '0 0 18px', lineHeight: 1.7 }}>
            Everything you turn on appears on your invoices, cheapest first, so a customer can
            choose. Card is the convenient option rather than the only one — on a $19,000 invoice
            it costs about $564 to receive money that a bank transfer moves for $5.
          </p>

          {!editingPayments && active.length > 0 ? (
            /* Settled state. What is saved, plainly, with one way to change it. */
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {active.map((m) => {
                  const spec = specFor(m.id)!;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '12px 14px',
                        background: C.panelAlt,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                          {spec.label}
                        </div>
                        {m.handle ? (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: C.dim,
                              marginTop: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.handle}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                            Nothing for the customer to copy — you&apos;ll arrange it directly.
                          </div>
                        )}
                      </div>
                      <Pill tone="green">On</Pill>
                    </div>
                  );
                })}
              </div>

              <Button variant="ghost" onClick={() => setEditingPayments(true)}>
                Edit payment methods
              </Button>
              {savedTab === 'payments' && (
                <span style={{ fontSize: 12.5, color: C.green, marginLeft: 12 }}>✓ Saved</span>
              )}
            </>
          ) : (
            <>
              {methods.map((m, i) => {
                const spec = METHODS.find((x) => x.id === m.id)!;
                const warn = m.handle ? looksLikeAccountNumber(m.handle) : false;
                // Not connected yet, so offering it would put a dead option in
                // front of a customer.
                const blocked = !!spec.needsStripe && stripeReady === false;

                return (
                  <div
                    key={m.id}
                    style={{
                      paddingBottom: 12,
                      marginBottom: 12,
                      borderBottom: i < methods.length - 1 ? `1px solid ${C.border}` : 'none',
                      opacity: blocked ? 0.55 : 1,
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        cursor: blocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={m.enabled && !blocked}
                        disabled={blocked}
                        onChange={(e) =>
                          setMethods((p) =>
                            p.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x))
                          )
                        }
                      />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{spec.label}</span>
                      <span style={{ fontSize: 11, color: C.faint, marginLeft: 'auto' }}>
                        {spec.costLabel}
                      </span>
                    </label>

                    {blocked && (
                      <div style={{ fontSize: 11.5, color: C.amber, marginTop: 6, marginLeft: 26, lineHeight: 1.55 }}>
                        Needs a Stripe account connected first. Until then this would show a
                        customer a payment option that goes nowhere, so it stays off.
                      </div>
                    )}

                    {m.enabled && !blocked && spec.handleLabel && (
                      <div style={{ marginTop: 10, marginLeft: 26 }}>
                        <div style={{ fontSize: 12, color: C.dim, marginBottom: 5, fontWeight: 500 }}>
                          {spec.handleLabel}
                        </div>
                        <input
                          value={m.handle ?? ''}
                          onChange={(e) =>
                            setMethods((p) =>
                              p.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x))
                            )
                          }
                          style={{ ...inputStyle, borderColor: warn ? C.red : C.border }}
                          placeholder={spec.placeholder}
                        />
                        {warn && (
                          <div style={{ fontSize: 11.5, color: C.red, marginTop: 5, lineHeight: 1.5 }}>
                            That looks like an account number. Don&apos;t put one here — this text
                            goes on every invoice a customer sees. Write how to request the
                            details instead.
                          </div>
                        )}
                        {spec.sensitive && !warn && (
                          <div style={{ fontSize: 11, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>
                            Never put account or routing numbers here. This appears on
                            customer-facing invoices.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SaveBar
                  onSave={() => save('payments')}
                  busy={busy}
                  saved={savedTab === 'payments'}
                  label="Save payment methods"
                />
                {active.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      hydrate();
                      setEditingPayments(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'connections' && (
        <Card style={{ maxWidth: 620 }}>
          <SectionLabel>Connect other things to this</SectionLabel>

          <div style={{ margin: '14px 0 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Calendar</div>
            <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 8px', lineHeight: 1.65 }}>
              Subscribe to this in Google or Apple Calendar and scheduled {vocab.jobPlural.toLowerCase()}{' '}
              appear alongside everything else. One-way and read-only — {vocab.jobPlural.toLowerCase()}{' '}
              with no dates don&apos;t show up.
            </p>
            <CopyRow value={org.calendar_token ? `${origin}/api/calendar/${org.calendar_token}` : ''} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Price list feed</div>
            <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 8px', lineHeight: 1.65 }}>
              For your website to pull live prices. Returns only items marked both{' '}
              <strong>on site</strong> and <strong>confirmed</strong>, so nothing unverified can
              reach a customer.
            </p>
            <CopyRow value={org.price_feed_token ? `${origin}/api/public/prices/${org.price_feed_token}` : ''} />
          </div>

          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 16, lineHeight: 1.65 }}>
            Treat both links as private. Anyone holding one can read what it exposes — nothing
            more, and neither allows any changes.
          </div>
        </Card>
      )}
    </Page>
  );
}
