'use client';

/**
 * First-login setup.
 *
 * Not a tutorial — the app already has guided paths for that. This is the
 * configuration the app genuinely cannot work without, asked once, in the
 * order it matters:
 *
 *   who you are -> what you charge -> how you get paid
 *
 * The rates step exists because an hourly rate of $0 makes every invoice come
 * out at zero, and someone who skips it will not find out until they try to
 * bill a real customer. Payment methods exist because without them an invoice
 * has no instructions on it.
 *
 * Everything is skippable and everything nags from the Manifest afterwards.
 * Blocking someone at a form on their first minute is how you lose them.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg } from '@/lib/spine/db';
import { METHODS, looksLikeAccountNumber, type PaymentMethod } from '@/lib/spine/payments';
import type { Org } from '@/lib/spine/types';

const INK = '#141414';
const BORDER = '#e4e4e0';
const TEXT = '#1a1a1a';
const DIM = '#363634';
const FAINT = '#55554f';
const ACCENT = '#2563eb';
const AMBER = '#b45309';

const field: React.CSSProperties = {
  width: '100%',
  background: '#fbfbfa',
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: '11px 13px',
  fontSize: 14,
  color: TEXT,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const STEPS = ['You', 'Your business', 'What you charge', 'Getting paid'] as const;

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [bizName, setBizName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('');
  const [markup, setMarkup] = useState('');
  const [tax, setTax] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[]>(
    METHODS.map((m) => ({ id: m.id, enabled: false, handle: '' }))
  );

  useEffect(() => {
    (async () => {
      try {
        const [{ data: auth }, o] = await Promise.all([
          supabase.auth.getUser(),
          getCurrentOrg(),
        ]);

        // Already set up? Nothing to do here.
        if (o?.onboarded_at) {
          router.replace('/');
          return;
        }

        if (auth?.user) {
          const p = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', auth.user.id)
            .maybeSingle();
          setFullName(p.data?.full_name ?? '');
        }

        if (o) {
          setOrg(o);
          setBizName(o.name);
          const s = (o.settings ?? {}) as Record<string, string>;
          setAddress(s.address ?? '');
          setPhone(s.phone ?? '');
          setRate(Number(o.default_labor_rate) ? String(o.default_labor_rate) : '');
          setMarkup(Number(o.default_material_markup_pct) ? String(o.default_material_markup_pct) : '');
          setTax(Number(o.tax_rate) ? String(o.tax_rate) : '');
          const existing = (o.payment_methods ?? []) as PaymentMethod[];
          if (Array.isArray(existing) && existing.length) {
            setMethods(
              METHODS.map((spec) => {
                const found = existing.find((m) => m.id === spec.id);
                return found ?? { id: spec.id, enabled: false, handle: '' };
              })
            );
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const finish = useCallback(
    async (skipRest = false) => {
      setBusy(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user && fullName.trim()) {
          await supabase
            .from('profiles')
            .upsert({ id: auth.user.id, full_name: fullName.trim() }, { onConflict: 'id' });
        }

        if (org) {
          const settings = { ...((org.settings ?? {}) as Record<string, unknown>) };
          if (address.trim()) settings.address = address.trim();
          if (phone.trim()) settings.phone = phone.trim();

          await updateOrg(org.id, {
            name: bizName.trim() || org.name,
            settings,
            default_labor_rate: parseFloat(rate) || 0,
            default_material_markup_pct: parseFloat(markup) || 0,
            tax_rate: parseFloat(tax) || 0,
            payment_methods: methods.filter((m) => m.enabled) as unknown as Record<string, unknown>[],
            // Marked done even when skipped — the Manifest picks up whatever
            // is still missing, so nobody gets asked twice.
            onboarded_at: new Date().toISOString(),
          } as Partial<Org>);
        }

        router.replace(skipRest ? '/' : '/?welcome=1');
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    },
    [org, fullName, bizName, address, phone, rate, markup, tax, methods, router]
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', color: FAINT, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const last = step === STEPS.length - 1;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', padding: '32px 20px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: INK, letterSpacing: '-0.3px' }}>
            Nautilus
          </div>
          <div style={{ fontSize: 13, color: FAINT, marginTop: 5 }}>
            A few things and you&apos;re set up. Two minutes.
          </div>
        </div>

        {/* Progress. Four dots reads as short; a percentage bar reads as long. */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= step ? ACCENT : BORDER,
              }}
            />
          ))}
        </div>

        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 26 }}>
          <div style={{ fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: '6px 0 18px' }}>
            {STEPS[step]}
          </div>

          {error && (
            <div style={{ background: '#fbeded', border: '1px solid #b91c1c33', borderRadius: 7, padding: '10px 12px', fontSize: 12.5, color: '#b91c1c', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {step === 0 && (
            <>
              <p style={{ fontSize: 13.5, color: DIM, marginTop: 0, lineHeight: 1.6 }}>
                What should we call you? This shows on the work you log.
              </p>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={field}
                placeholder="Mark Mesedahl"
                autoFocus
              />
            </>
          )}

          {step === 1 && (
            <>
              <p style={{ fontSize: 13.5, color: DIM, marginTop: 0, lineHeight: 1.6 }}>
                This appears on every estimate and invoice you send.
              </p>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Business name</div>
                <input value={bizName} onChange={(e) => setBizName(e.target.value)} style={field} autoFocus />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Address</div>
                <input value={address} onChange={(e) => setAddress(e.target.value)} style={field} placeholder="1018 Cushing Dr #B, Round Rock, TX 78664" />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Phone</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={field} placeholder="714-271-4837" />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ fontSize: 13.5, color: DIM, marginTop: 0, lineHeight: 1.6 }}>
                Your defaults. You can override them on any single job.
              </p>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Hourly rate</div>
                <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} style={field} placeholder="85" autoFocus />
              </label>
              {!parseFloat(rate) && (
                <div style={{ fontSize: 12, color: AMBER, margin: '-6px 0 12px', lineHeight: 1.55 }}>
                  Leave this at zero and every invoice will total zero. You can set it later, but
                  you will have to before you bill anyone.
                </div>
              )}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Material markup %</div>
                <input type="number" value={markup} onChange={(e) => setMarkup(e.target.value)} style={field} placeholder="15" />
              </label>
              <div style={{ fontSize: 11.5, color: FAINT, margin: '-6px 0 12px' }}>
                Added to receipts when you bill them on. A $100 receipt at 15% bills as $115.
              </div>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 6 }}>Sales tax % (leave blank if you don&apos;t charge it)</div>
                <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} style={field} placeholder="0" />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <p style={{ fontSize: 13.5, color: DIM, marginTop: 0, lineHeight: 1.6 }}>
                Tick everything you accept. These appear on your invoices so customers know how
                to pay you.
              </p>
              {methods.map((m, i) => {
                const spec = METHODS.find((x) => x.id === m.id)!;
                const warn = m.handle ? looksLikeAccountNumber(m.handle) : false;
                return (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) =>
                          setMethods((p) => p.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
                        }
                      />
                      <span style={{ fontSize: 13.5 }}>{spec.label}</span>
                      <span style={{ fontSize: 11, color: FAINT, marginLeft: 'auto' }}>{spec.costLabel}</span>
                    </label>
                    {m.enabled && spec.handleLabel && (
                      <div style={{ marginLeft: 26, marginTop: 7 }}>
                        <input
                          value={m.handle ?? ''}
                          onChange={(e) =>
                            setMethods((p) => p.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))
                          }
                          style={{ ...field, borderColor: warn ? '#b91c1c' : BORDER }}
                          placeholder={spec.placeholder}
                        />
                        {warn && (
                          <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 5, lineHeight: 1.5 }}>
                            That looks like an account number — don&apos;t put one here. This text
                            goes on invoices customers can see.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 22, alignItems: 'center' }}>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '11px 16px', fontSize: 14, color: DIM, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              disabled={busy || (step === 0 && !fullName.trim())}
              style={{
                flex: 1,
                background: INK,
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '12px',
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy || (step === 0 && !fullName.trim()) ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              {busy ? 'Saving…' : last ? 'Finish setup' : 'Continue'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => finish(true)}
            disabled={busy}
            style={{ background: 'transparent', border: 'none', color: FAINT, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Skip for now — anything missing will be waiting on the Manifest
          </button>
        </div>
      </div>
    </div>
  );
}
