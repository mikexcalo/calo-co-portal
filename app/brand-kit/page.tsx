'use client';

/**
 * Brand Kit — the brand, and the things people actually need to DO with it.
 *
 * The old one was a viewer: here are your colors, admire them. Nobody opens
 * a brand kit to admire colors. They open it because they need a hex code, a
 * logo file, or an email signature that doesn't look broken in Outlook.
 *
 * So this is: the assets, plus tools that consume them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import { BrandMessage } from '@/components/spine/BrandMessage';
import { QrStudio } from '@/components/spine/QrStudio';
import {
  EMPTY_SIGNATURE,
  INSTALL_GUIDES,
  SIGNATURE_STYLES,
  renderSignature,
  type SignatureFields,
  type SignatureStyle,
} from '@/lib/spine/signature';
import {
  FORMAT_NOTES,
  LOGO_SIZES,
  convertLogo,
  describeFromFilename,
  downloadBlob,
  fileNameFor,
  type LogoFormat,
  type LogoVariant,
} from '@/lib/spine/logos';
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
  BRAND_TABS,
} from '@/components/spine/ui';

type Tab = 'brand' | 'logos' | 'qr' | 'signature';

interface BrandColor {
  name: string;
  hex: string;
  /** What the color is for, e.g. "Primary". Optional. */
  role?: string;
}

interface BrandSettings {
  colors: BrandColor[];
  fontHeading: string;
  fontBody: string;
  logoLight: string;
  logoDark: string;
  /** Every logo file, beyond the two headline ones. */
  logos: string[];
  voice: string;
}

const EMPTY_BRAND: BrandSettings = {
  colors: [],
  fontHeading: '',
  fontBody: '',
  logoLight: '',
  logoDark: '',
  logos: [],
  voice: '',
};

export default function BrandKitPage() {
  const phone = useIsPhone();
  const { org, refresh } = useOrg();
  const mods = modulesFor(org);
  const [tab, setTab] = useState<Tab>('brand');
  const [brand, setBrand] = useState<BrandSettings>(EMPTY_BRAND);
  const [sig, setSig] = useState<SignatureFields>(EMPTY_SIGNATURE);
  const [style, setStyle] = useState<SignatureStyle>('stacked');
  const [guideId, setGuideId] = useState('gmail');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState('');

  // Default the QR target to this business's own site, since that's what a
  // yard sign or truck door almost always points at.
  useEffect(() => {
    (async () => {
      const res = await supabase.from('client_sites').select('url').limit(1).maybeSingle();
      if (!res.error && res.data?.url) setSiteUrl(res.data.url);
    })();
  }, [org?.id]);

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

  return (
    <Page
      tabs={BRAND_TABS}
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
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {(['brand', 'logos', 'qr', 'signature'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${tab === tb ? C.blue : C.border}`,
              background: tab === tb ? C.blueSoft : 'transparent',
              color: tab === tb ? C.text : C.dim,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tb === 'brand' ? 'Colors & type'
              : tb === 'logos' ? 'Logos'
              : tb === 'qr' ? 'QR codes'
              : 'Email signature'}
          </button>
        ))}
      </div>

      {tab === 'brand' ? (
        <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
          <Card>
            <SectionLabel>Colors</SectionLabel>
            {brand.colors.length === 0 ? (
              <Empty>No colors set for this brand.</Empty>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
                  gap: 14,
                }}
              >
                {brand.colors.map((c, i) => (
                  <ColorTile
                    key={i}
                    color={c}
                    copied={copied === c.hex}
                    onCopy={() => copyText(c.hex, c.hex)}
                  />
                ))}
              </div>
            )}
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 16 }}>
              Click any color to copy its hex code.
            </div>
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
            <SectionLabel>Voice</SectionLabel>
            <textarea
              value={brand.voice}
              onChange={(e) => setBrand((b) => ({ ...b, voice: e.target.value }))}
              style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              placeholder="How this brand sounds. Plain, direct, no jargon…"
            />
          </Card>

          {/* Voice is how you sound. This is what you claim, which nothing in
              the kit held, and which every pitch and home page is written out
              of. */}
          <div style={{ marginTop: 18 }}>
            <BrandMessage orgId={org?.id ?? null} orgName={org?.name ?? 'your brand'} />
          </div>
        </div>
      ) : tab === 'qr' ? (
        <QrStudio
          orgId={org?.id}
          colors={brand.colors}
          company={org?.name ?? 'brand'}
          defaultUrl={siteUrl}
        />
      ) : tab === 'logos' ? (
        <LogosTab
          brand={brand}
          company={org?.name ?? 'brand'}
          onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))}
        />
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

/**
 * One color, as a swatch you can actually judge.
 *
 * A circle of the color reads far faster than a hex code in a row — you see
 * the palette as a palette. Read-only on purpose: a brand kit is a reference,
 * and letting anyone retype the brand color is how a brand drifts.
 */
function ColorTile({
  color,
  copied,
  onCopy,
}: {
  color: BrandColor;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      onClick={onCopy}
      title={`Copy ${color.hex}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          background: color.hex,
          border: `1px solid ${C.borderStrong}`,
          margin: '0 auto 11px',
          position: 'relative',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
        }}
      >
        {copied && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(0,0,0,.6)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Copied
          </span>
        )}
      </div>

      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{color.name}</div>
      {color.role && (
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>{color.role}</div>
      )}
      <div
        style={{
          fontSize: 11.5,
          color: C.faint,
          marginTop: 3,
          fontVariantNumeric: 'tabular-nums',
          textTransform: 'uppercase',
        }}
      >
        {color.hex}
      </div>
    </button>
  );
}

/**
 * Logos — see what you're getting before you download it.
 *
 * Each variant previews on the background it's built for, so a white logo
 * shows on dark rather than vanishing into the page.
 */
function LogosTab({
  brand,
  company,
  onChange,
}: {
  brand: BrandSettings;
  company: string;
  onChange: (patch: Partial<BrandSettings>) => void;
}) {
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The two headline slots plus any extras, de-duplicated.
  const urls = useMemo(() => {
    const all = [brand.logoLight, brand.logoDark, ...(brand.logos ?? [])]
      .map((u) => (u ?? '').trim())
      .filter(Boolean);
    return Array.from(new Set(all));
  }, [brand.logoLight, brand.logoDark, brand.logos]);

  const variants: LogoVariant[] = urls.map((url, i) => ({
    id: `${i}-${url}`,
    url,
    ...describeFromFilename(url),
  }));

  const addLogo = () => {
    const url = adding.trim();
    if (!url) return;
    onChange({ logos: [...(brand.logos ?? []), url] });
    setAdding('');
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {variants.length === 0 ? (
        <Card><Empty>No logos yet. Add a public image URL below.</Empty></Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {variants.map((v) => (
            <LogoCard key={v.id} variant={v} company={company} onError={setError} />
          ))}
        </div>
      )}

      <Card style={{ marginTop: 18 }}>
        <SectionLabel>Add a logo</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLogo()}
            style={inputStyle}
            placeholder="https://…/logo.png"
          />
          <Button onClick={addLogo} disabled={!adding.trim()}>Add</Button>
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
          The file has to be publicly reachable and allow cross-origin reads, or the browser
          can&apos;t redraw it into other formats. Files served from your own sites work.
        </div>
      </Card>
    </div>
  );
}

function LogoCard({
  variant,
  company,
  onError,
}: {
  variant: LogoVariant;
  company: string;
  onError: (msg: string | null) => void;
}) {
  const [format, setFormat] = useState<LogoFormat>('png');
  const [size, setSize] = useState(0);
  const [busy, setBusy] = useState(false);

  // Preview on the background the file is actually built for, so a reversed
  // logo doesn't disappear into a white card.
  const previewBg =
    variant.preview === 'dark' ? '#1F2D48' : variant.preview === 'brand' ? '#F4EFE3' : '#FFFFFF';

  const download = async () => {
    setBusy(true);
    onError(null);
    try {
      const blob = await convertLogo(variant.url, format, size, previewBg);
      downloadBlob(blob, fileNameFor(company, variant, format, size));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          background: previewBg,
          padding: variant.shape === 'icon' ? '26px 20px' : '30px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 130,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={variant.url}
          alt={variant.name}
          style={{
            maxWidth: variant.shape === 'icon' ? 68 : '85%',
            maxHeight: variant.shape === 'icon' ? 68 : 78,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>{variant.name}</span>
          <Pill tone="neutral">{variant.shape === 'icon' ? 'Mark only' : 'Full lockup'}</Pill>
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5, marginBottom: 12 }}>
          {variant.use}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 9 }}>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as LogoFormat)}
            style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WebP</option>
          </select>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
          >
            {LOGO_SIZES.map((s) => (
              <option key={s.label} value={s.px}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 10, lineHeight: 1.5 }}>
          {FORMAT_NOTES[format]}
        </div>

        <Button onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download'}
        </Button>
      </div>
    </Card>
  );
}
