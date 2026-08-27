'use client';

/**
 * Brand Kit — the brand, and the things people actually need to DO with it.
 *
 * The old one was a viewer: here are your colours, admire them. Nobody opens
 * a brand kit to admire colours. They open it because they need a hex code, a
 * logo file, or an email signature that doesn't look broken in Outlook.
 *
 * So this is: the assets, plus tools that consume them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg } from '@/lib/spine/db';
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
} from '@/components/spine/ui';

type Tab = 'brand' | 'signature';

interface BrandColor {
  name: string;
  hex: string;
}

interface BrandSettings {
  colors: BrandColor[];
  fontHeading: string;
  fontBody: string;
  logoLight: string;
  logoDark: string;
  voice: string;
}

const EMPTY_BRAND: BrandSettings = {
  colors: [],
  fontHeading: '',
  fontBody: '',
  logoLight: '',
  logoDark: '',
  voice: '',
};

export default function BrandKitPage() {
  const { org, refresh } = useOrg();
  const [tab, setTab] = useState<Tab>('brand');
  const [brand, setBrand] = useState<BrandSettings>(EMPTY_BRAND);
  const [sig, setSig] = useState<SignatureFields>(EMPTY_SIGNATURE);
  const [style, setStyle] = useState<SignatureStyle>('stacked');
  const [guideId, setGuideId] = useState('gmail');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Brand lives in orgs.settings — one row per business, so switching
  // businesses switches brands without any extra plumbing.
  useEffect(() => {
    if (!org) return;
    const s = (org.settings ?? {}) as Record<string, unknown>;
    setBrand({ ...EMPTY_BRAND, ...((s.brand as Partial<BrandSettings>) ?? {}) });
    setSig({
      ...EMPTY_SIGNATURE,
      company: org.name,
      ...((s.signature as Partial<SignatureFields>) ?? {}),
    });
  }, [org]);

  const save = useCallback(
    async (next: { brand?: BrandSettings; signature?: SignatureFields }) => {
      if (!org) return;
      setBusy(true);
      setError(null);
      try {
        const current = (org.settings ?? {}) as Record<string, unknown>;
        await updateOrg(org.id, {
          settings: { ...current, ...next } as Record<string, unknown>,
        });
        await refresh();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [org, refresh]
  );

  const html = useMemo(() => renderSignature(sig, style), [sig, style]);
  const guide = INSTALL_GUIDES.find((g) => g.id === guideId) ?? INSTALL_GUIDES[0];

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy — your browser blocked clipboard access.');
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
      setError(
        'Your browser blocked the rich copy. Use "Copy HTML" and paste into an HTML source view instead.'
      );
    }
  };

  const addColor = () =>
    setBrand((b) => ({ ...b, colors: [...b.colors, { name: '', hex: '#000000' }] }));

  return (
    <Page
      title="Brand Kit"
      subtitle={org ? `${org.name} — assets, and the tools that use them.` : undefined}
      action={
        <>
          {saved && <Pill tone="green">Saved</Pill>}
          <Button
            onClick={() => save(tab === 'brand' ? { brand } : { signature: sig })}
            disabled={busy || !org}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {(['brand', 'signature'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              padding: '8px 14px',
              borderRadius: 7,
              border: `1px solid ${tab === tb ? C.blue : C.border}`,
              background: tab === tb ? C.blueSoft : 'transparent',
              color: tab === tb ? C.text : C.dim,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tb === 'brand' ? 'Brand' : 'Email signature'}
          </button>
        ))}
      </div>

      {tab === 'brand' ? (
        <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>Colours</SectionLabel>
              <Button variant="ghost" onClick={addColor}>Add colour</Button>
            </div>
            {brand.colors.length === 0 ? (
              <Empty>No colours yet.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {brand.colors.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={c.hex}
                      onChange={(e) =>
                        setBrand((b) => ({
                          ...b,
                          colors: b.colors.map((x, j) =>
                            j === i ? { ...x, hex: e.target.value } : x
                          ),
                        }))
                      }
                      style={{
                        width: 42, height: 34, padding: 2, borderRadius: 6,
                        border: `1px solid ${C.border}`, background: C.panelAlt, cursor: 'pointer',
                      }}
                    />
                    <input
                      value={c.name}
                      placeholder="Name, e.g. Hull"
                      onChange={(e) =>
                        setBrand((b) => ({
                          ...b,
                          colors: b.colors.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x
                          ),
                        }))
                      }
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => copyText(c.hex, c.hex)}
                      style={{
                        ...inputStyle, width: 100, cursor: 'pointer',
                        textAlign: 'center', color: copied === c.hex ? C.green : C.dim,
                      }}
                    >
                      {copied === c.hex ? 'Copied' : c.hex}
                    </button>
                    <button
                      onClick={() =>
                        setBrand((b) => ({ ...b, colors: b.colors.filter((_, j) => j !== i) }))
                      }
                      style={{
                        background: 'none', border: 'none', color: C.faint,
                        cursor: 'pointer', fontSize: 16,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionLabel>Typography</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Headings">
                <input
                  value={brand.fontHeading}
                  onChange={(e) => setBrand((b) => ({ ...b, fontHeading: e.target.value }))}
                  style={inputStyle}
                  placeholder="Nib Pro"
                />
              </Field>
              <Field label="Body">
                <input
                  value={brand.fontBody}
                  onChange={(e) => setBrand((b) => ({ ...b, fontBody: e.target.value }))}
                  style={inputStyle}
                  placeholder="Geist"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionLabel>Logos</SectionLabel>
            <Field label="Logo URL — light backgrounds">
              <input
                value={brand.logoLight}
                onChange={(e) => setBrand((b) => ({ ...b, logoLight: e.target.value }))}
                style={inputStyle}
                placeholder="https://…"
              />
            </Field>
            <Field label="Logo URL — dark backgrounds">
              <input
                value={brand.logoDark}
                onChange={(e) => setBrand((b) => ({ ...b, logoDark: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <div style={{ fontSize: 11.5, color: C.faint }}>
              These need to be public URLs. An email signature can&apos;t load a file from
              someone&apos;s laptop.
            </div>
          </Card>

          <Card>
            <SectionLabel>Voice</SectionLabel>
            <textarea
              value={brand.voice}
              onChange={(e) => setBrand((b) => ({ ...b, voice: e.target.value }))}
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              placeholder="How this brand sounds. Plain, direct, no jargon…"
            />
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }}>
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
                  placeholder={brand.logoLight || 'https://…'}
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
                      textAlign: 'left', padding: '10px 12px', borderRadius: 7,
                      border: `1px solid ${style === s.id ? C.blue : C.border}`,
                      background: style === s.id ? C.blueSoft : 'transparent',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>{s.note}</div>
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
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10 }}>
                &quot;Copy signature&quot; puts the rendered version on your clipboard — that&apos;s
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
                      padding: '5px 10px', borderRadius: 20, fontSize: 11.5,
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

              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: C.dim, lineHeight: 1.7 }}>
                {guide.steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ol>

              {guide.gotcha && (
                <div
                  style={{
                    marginTop: 14, padding: 11, borderRadius: 7,
                    background: C.amberSoft, border: `1px solid ${C.amber}44`,
                    fontSize: 12, color: C.amber, lineHeight: 1.55,
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
