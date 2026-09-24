'use client';

/**
 * The email signature, with the things you send.
 *
 * It was the fourth tab of the brand kit, behind colors, type and logos — a
 * thing you build once and then install, filed with the reference material
 * you check. But a signature is not a brand asset you keep, it is how you get
 * introduced on every email that leaves. That is the same job as a pitch, a
 * case study and a business card, so it lives with them.
 *
 * The logo falls back to the brand's light logo, which is why the brand
 * settings are still read here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { updateOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import {
  EMPTY_SIGNATURE,
  INSTALL_GUIDES,
  SIGNATURE_STYLES,
  renderSignature,
  type SignatureFields,
  type SignatureStyle,
} from '@/lib/spine/signature';
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
  useIsPhone,
  PITCH_TABS,
} from '@/components/spine/ui';
import { human } from '@/lib/spine/errors';

export default function SignaturePage() {
  const { org, refresh } = useOrg();
  const phone = useIsPhone();

  const [sig, setSig] = useState<SignatureFields>(EMPTY_SIGNATURE);
  /* Only the light logo is needed here, as the placeholder for Logo URL. */
  const [logoLight, setLogoLight] = useState('');
  const [style, setStyle] = useState<SignatureStyle>('stacked');
  const [guideId, setGuideId] = useState('gmail');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    const s = (org.settings ?? {}) as Record<string, unknown>;
    setLogoLight(((s.brand as { logoLight?: string } | undefined)?.logoLight) ?? '');
    setSig({
      ...EMPTY_SIGNATURE,
      company: org.name,
      ...((s.signature as Partial<SignatureFields>) ?? {}),
    });
  }, [org]);

  const save = useCallback(async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    try {
      const current = (org.settings ?? {}) as Record<string, unknown>;
      await updateOrg(org.id, { settings: { ...current, signature: sig } as Record<string, unknown> });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(human((e as Error).message));
    } finally {
      setBusy(false);
    }
  }, [org, refresh, sig]);

  const html = useMemo(() => renderSignature(sig, style), [sig, style]);
  const guide = INSTALL_GUIDES.find((g) => g.id === guideId) ?? INSTALL_GUIDES[0];

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy, your browser blocked clipboard access.');
    }
  };

  /**
   * Copies the RENDERED signature, not the source. Mail clients want rich
   * content on the clipboard; pasting source into Gmail shows the code.
   */
  const copyRendered = async () => {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([sig.name], { type: 'text/plain' }),
        }),
      ]);
      setCopied('signature');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy, your browser blocked clipboard access.');
    }
  };

  return (
    <Page
      tabs={PITCH_TABS}
      title="Email Signature"
      subtitle="How you sign off, on everything that leaves."
      action={
        <>
          {saved && <Pill tone="green">Saved</Pill>}
          <Button onClick={save} disabled={busy || !org}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {!org ? (
        <Empty>Loading…</Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }}>
          <div>
            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Details</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Name">
                  <input value={sig.name} onChange={(e) => setSig({ ...sig, name: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Title">
                  <input value={sig.title} onChange={(e) => setSig({ ...sig, title: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Company">
                  <input value={sig.company} onChange={(e) => setSig({ ...sig, company: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input value={sig.phone} onChange={(e) => setSig({ ...sig, phone: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Email">
                  <input value={sig.email} onChange={(e) => setSig({ ...sig, email: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="Website">
                  <input value={sig.website} onChange={(e) => setSig({ ...sig, website: e.target.value })} style={inputStyle} />
                </Field>
              </div>
              <Field label="Logo URL">
                <input
                  value={sig.logoUrl}
                  onChange={(e) => setSig({ ...sig, logoUrl: e.target.value })}
                  style={inputStyle}
                  placeholder={logoLight || 'https://…'}
                />
              </Field>
              <Field label="Tagline (optional)">
                <input value={sig.tagline} onChange={(e) => setSig({ ...sig, tagline: e.target.value })} style={inputStyle} />
              </Field>
            </Card>

            <Card>
              <SectionLabel>Layout</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SIGNATURE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 999,
                      border: `1px solid ${style === s.id ? C.blue : C.border}`,
                      background: style === s.id ? C.blueSoft : 'transparent',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 14, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>{s.note}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Preview</SectionLabel>
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 7,
                  padding: 20,
                  border: `1px solid ${C.border}`,
                  overflowX: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Button onClick={copyRendered}>
                  {copied === 'signature' ? 'Copied' : 'Copy signature'}
                </Button>
                <Button variant="ghost" onClick={() => copyText(html, 'html')}>
                  {copied === 'html' ? 'Copied' : 'Copy HTML'}
                </Button>
              </div>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10 }}>
                &quot;Copy signature&quot; puts the rendered version on your clipboard, that&apos;s
                what mail clients want. &quot;Copy HTML&quot; gives you the source, for anything with
                a code view.
              </div>
            </Card>

            <Card>
              <SectionLabel>Install it</SectionLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
                {INSTALL_GUIDES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGuideId(g.id)}
                    style={{
                      padding: '5px 10px', borderRadius: 999, fontSize: 12.5,
                      border: `1px solid ${guideId === g.id ? C.blue : C.border}`,
                      background: guideId === g.id ? C.blueSoft : 'transparent',
                      color: guideId === g.id ? C.text : C.dim,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>

              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: C.dim, lineHeight: 1.7 }}>
                {guide.steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ol>

              {guide.gotcha && (
                <div
                  style={{
                    marginTop: 14, padding: 11, borderRadius: 7,
                    background: C.amberSoft, border: `1px solid ${C.amber}44`,
                    fontSize: 13, color: C.amber, lineHeight: 1.55,
                  }}
                >
                  {guide.gotcha}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
