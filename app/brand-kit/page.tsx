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
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { getCurrentOrg, updateOrg, orgNow} from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import { QrStudio } from '@/components/spine/QrStudio';
import { PaletteFromImage } from '@/components/spine/PaletteFromImage';
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
  numeric,
  useIsPhone,
  Tabs,
  brandTabsFor,
} from '@/components/spine/ui';
import { FontSpecimen } from '@/components/spine/FontSpecimen';
import { BrandSpecimen, Pairings } from '@/components/spine/BrandSpecimen';
import { kitFromOrg, kitFromBrand, type Kit } from '@/lib/spine/brandkit';
import { human } from '@/lib/spine/errors';

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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('brand');

  /*
    Whose identity is on screen.

    Client brands were a tab that left the module: Brand → Client brands → a
    list → click a client → their screens, and no way back up. Four moves to
    look at a colour, and the tab strip stopped rendering once you were in, so
    the module you were inside disappeared behind you.

    An agency holds several identities and swaps between them constantly. That
    is a picker at the top of one screen, not a journey. '' means your own.
  */
  const [viewing, setViewing] = useState('');
  const [clientBrands, setClientBrands] = useState<Array<{ id: string; name: string; kit: unknown }>>([]);

  useEffect(() => {
    if (org?.kind !== 'agency') return;
    let dead = false;
    (async () => {
      const { data } = await supabase.from('brands').select('id, name, kit').order('name');
      if (!dead && data) setClientBrands(data as Array<{ id: string; name: string; kit: unknown }>);
    })();
    return () => { dead = true; };
  }, [org?.id, org?.kind]);

  const [brand, setBrand] = useState<BrandSettings>(EMPTY_BRAND);

  /* Whatever is being looked at, in one shape. */
  const shown: Kit = useMemo(() => {
    if (viewing) {
      const row = clientBrands.find((b) => b.id === viewing);
      if (row) return kitFromBrand(row);
    }
    return kitFromOrg(org?.name ?? 'Your brand', { brand });
  }, [viewing, clientBrands, org?.name, brand]);

  /* Somebody else's identity is read here and edited on its own screens. */
  const mine = !viewing;
  const [sig, setSig] = useState<SignatureFields>(EMPTY_SIGNATURE);
  const [style, setStyle] = useState<SignatureStyle>('stacked');
  const [guideId, setGuideId] = useState('gmail');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingColors, setEditingColors] = useState(false);

  /**
   * Type, as a file you can hand over.
   *
   * This is a content store as much as a dashboard, and a designer asking what
   * fonts a brand uses should get an answer they can keep rather than a screen
   * they screenshot. Plain text on purpose: it opens anywhere, pastes into an
   * email, and does not need this product to read it.
   */
  const downloadType = useCallback(() => {
    const name = org?.name ?? 'brand';
    const body = [
      `${name}, type`,
      new Date().toISOString().slice(0, 10),
      '',
      'TYPE',
      `  Headings   ${brand.fontHeading || 'not set'}`,
      `  Body       ${brand.fontBody || 'not set'}`,
      '',
      'COLORS',
      ...brand.colors.map((c) => `  ${c.hex}  ${c.name}${c.role ? `, ${c.role}` : ''}`),
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-type.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [org, brand]);
  const [siteUrl, setSiteUrl] = useState('');

  // Default the QR target to this business's own site, since that's what a
  // yard sign or truck door almost always points at.
  useEffect(() => {
    (async () => {
      const res = await supabase.from('client_sites').select('url').eq('org_id', await orgNow()).limit(1).maybeSingle();
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
        setError(human((e as Error).message));
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
      setError(
        'Your browser blocked the rich copy. Use "Copy HTML" and paste into an HTML source view instead.'
      );
    }
  };

  return (
    <Page
      tabs={brandTabsFor(org?.kind)}
      title="Brand"
      subtitle={mine ? 'Your logos, colors, type and voice.' : `${shown.name}, held by you, edited on its own screens.`}
      action={
        <>
          {saved && mine && <Pill tone="green">Saved</Pill>}
          {mine ? (
            <Button
              onClick={() => save(tab === 'brand' ? { brand } : { signature: sig })}
              disabled={busy || !org}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <Button onClick={() => router.push(`/brands/${viewing}`)}>Open {shown.name}</Button>
          )}
        </>
      }
    >
      {/*
        The picker, where the identities are.

        Only where there is more than one, a contractor holds their own and
        nothing else, and a dropdown offering one choice is furniture.
      */}
      {clientBrands.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: C.faint }}>Showing</span>
          <select
            value={viewing}
            onChange={(e) => { setViewing(e.target.value); setTab('brand'); }}
            style={{
              fontSize: 14, padding: '7px 11px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.panel, color: C.text,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="">{org?.name ?? 'Your brand'}, yours</option>
            {clientBrands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {/* Was a third style of tab strip: detached pills in blue outline,
          different again from the two above it on the same screen. */}
      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        style={{ marginBottom: 22 }}
        items={[
          { id: 'brand', label: 'Colors & type', icon: 'star' },
          { id: 'logos', label: 'Logos', icon: 'swatches' },
          { id: 'qr', label: 'QR codes', icon: 'card' },
          { id: 'signature', label: 'Email signature', icon: 'mail' },
        ]}
      />

      {!mine ? (
        <BrandSpecimen kit={shown} />
      ) : tab === 'brand' ? (
        <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
          <Card>
            <SectionLabel>Colors</SectionLabel>
            {brand.colors.length === 0 ? (
              <Empty>No colors yet. Add them, or drop a logo below and read them off it.</Empty>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 14,
                }}
              >
                {brand.colors.map((c, i) => (
                  <ColorTile
                    key={i}
                    color={c}
                    copied={copied === c.hex}
                    onCopy={() => copyText(c.hex, c.hex)}
                    editing={editingColors}
                    onChange={(patch) =>
                      setBrand((b) => ({
                        ...b,
                        colors: b.colors.map((x, n) => (n === i ? { ...x, ...patch } : x)),
                      }))
                    }
                    onRemove={() =>
                      setBrand((b) => ({ ...b, colors: b.colors.filter((_, n) => n !== i) }))
                    }
                  />
                ))}
              </div>
            )}

            {/*
              A kit you can read and cannot change is a reference card, not a
              kit. Editing is behind a toggle so the normal state stays a clean
              wall of swatches you click to copy.
            */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 12.5, color: C.faint, flex: 1 }}>
                {editingColors ? 'Nothing saves until you save.' : ''}
              </span>
              {editingColors && (
                <button
                  onClick={() =>
                    setBrand((b) => ({ ...b, colors: [...b.colors, { name: 'New', role: '', hex: '#000000' }] }))
                  }
                  style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Add
                </button>
              )}
              <IconButton
                label={editingColors ? 'Done' : 'Edit'}
                active={editingColors}
                onClick={() => setEditingColors((v) => !v)}
              />
            </div>
          </Card>

          {/*
            The other direction. Colors above are ones you already know; this
            is for the ones that arrived as a picture, a prospect's logo, a
            screenshot of a sign, a PDF somebody exported.
          */}
          {/*
            The rule the grid cannot state.

            Thirteen swatches tell you the brand owns a gold and an ivory. They
            cannot tell you that gold on ivory is unreadable, which is the only
            thing anybody gets wrong. Derived, never typed, so it cannot drift
            from the colors above it.
          */}
          <Pairings kit={shown} />

          <Card>
            <SectionLabel>Colors from a logo</SectionLabel>
            <p style={{ fontSize: 12.5, color: C.faint, margin: '6px 0 12px' }}>
              Drop an image and this reads the exact hexes out of it. Nothing is
              uploaded and nothing is charged, it happens in your browser. What
              you add lands in Colors above and keeps when you save.
            </p>
            <PaletteFromImage
              onAdd={(cols) =>
                setBrand((b) => ({ ...b, colors: [...b.colors, ...cols] }))
              }
            />
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <SectionLabel>Type</SectionLabel>
              <span style={{ flex: 1 }} />
              <button
                onClick={downloadType}
                style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Download
              </button>
            </div>

            {/*
              The face, set in the face.

              Both were a name typed into a grey box, in the interface's own
              font, so the one question this section exists to answer, what
              does it look like, was the one thing it could not show. The
              specimen loads the family and sets a line in it at the size that
              family is actually used at.

              The Platform block is gone. It listed Figtree, Inter and Geist
              Mono, the typefaces this software is built in, identically on
              every brand, so Mammoth's kit was three-quarters a description of
              CALO&CO's tooling. That is reference material about Nautilus and
              has no place on somebody's identity.
            */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Field label="Headings">
                <input
                  value={brand.fontHeading}
                  onChange={(e) => setBrand((b) => ({ ...b, fontHeading: e.target.value }))}
                  style={inputStyle}
                  placeholder="Name a face"
                />
              </Field>
              <Field label="Body">
                <input
                  value={brand.fontBody}
                  onChange={(e) => setBrand((b) => ({ ...b, fontBody: e.target.value }))}
                  style={inputStyle}
                  placeholder="Name a face"
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <FontSpecimen
                family={brand.fontHeading}
                role="Headings"
                sample={org?.name ?? 'Headings'}
                size={34}
                weight={600}
              />
              <FontSpecimen
                family={brand.fontBody}
                role="Body"
                sample="The quick brown fox jumps over the lazy dog, and the invoice goes out on the first."
                size={16}
              />
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

          {/*
            Save is at the bottom as well as the top.
            
            This page is three screens long and the only save was in the header,
            so editing the voice box meant scrolling back past everything to
            keep it. A save you have to go looking for is a save people forget.
          */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button onClick={() => save({ brand })} disabled={busy || !org}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            {saved && <Pill tone="green">Saved</Pill>}
            <span style={{ fontSize: 12.5, color: C.faint }}>
              Colors, type and voice are all saved together.
            </span>
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

/**
 * One color, as a swatch you can actually judge.
 *
 * A circle of the color reads far faster than a hex code in a row — you see
 * the palette as a palette. Read-only on purpose: a brand kit is a reference,
 * and letting anyone retype the brand color is how a brand drifts.
 */

/** The platform's own faces. Not editable: it is software, not brand. */

/**
 * A pencil, not the word "edit colors".
 *
 * A sentence pretending to be a control reads as instructions, and instructions
 * next to a wall of swatches is one more thing to parse. An icon that turns
 * solid when it is on says the same thing in no words.
 */
function IconButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 999,
        border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.accent : 'transparent',
        color: active ? '#fff' : C.dim,
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}
    >
      {active ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.4l3.2 3.2L13 4.8" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.3 2.4a1.7 1.7 0 0 1 2.3 2.3L5.5 12.9l-3.1.8.8-3.1z" />
          <path d="M10.2 3.5l2.3 2.3" />
        </svg>
      )}
    </button>
  );
}

function ColorTile({
  color,
  copied,
  onCopy,
  editing = false,
  onChange,
  onRemove,
}: {
  color: BrandColor;
  copied: boolean;
  onCopy: () => void;
  editing?: boolean;
  onChange?: (patch: Partial<BrandColor>) => void;
  onRemove?: () => void;
}) {
  /**
   * Two tiles, not one with a mode flag threaded through it.
   *
   * A swatch you click to copy and a swatch you type into want different
   * markup: one is a button, the other holds three inputs and a native colour
   * picker. Forcing both through one tree is where a click-to-copy that
   * silently focuses a field comes from.
   */
  if (editing && onChange) {
    return (
      <div style={{ textAlign: 'center' }}>
        <label
          style={{
            display: 'block', width: 76, height: 76, borderRadius: '50%',
            background: color.hex, border: `1px solid ${C.borderStrong}`,
            margin: '0 auto 11px', cursor: 'pointer', position: 'relative',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
          }}
          title="Pick a color"
        >
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : '#000000'}
            onChange={(e) => onChange({ hex: e.target.value.toUpperCase() })}
            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </label>
        <input
          value={color.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Name"
          style={{ ...inputStyle, textAlign: 'center', fontSize: 12.5, padding: '3px 6px', marginBottom: 4 }}
        />
        <input
          value={color.role ?? ''}
          onChange={(e) => onChange({ role: e.target.value })}
          placeholder="What it is for"
          style={{ ...inputStyle, textAlign: 'center', fontSize: 11.5, padding: '3px 6px', marginBottom: 4 }}
        />
        <input
          value={color.hex}
          onChange={(e) => onChange({ hex: e.target.value })}
          style={{
            ...inputStyle, textAlign: 'center', fontSize: 11.5, padding: '3px 6px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            style={{ background: 'transparent', border: 'none', padding: '5px 0 0', color: C.faint, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Remove
          </button>
        )}
      </div>
    );
  }

  /*
    A tile, not a bauble.

    Seventy-six pixels of circle, centred, with the name and the hex in small
    grey underneath. Thirteen of them filled the screen with colour and put the
    one thing anybody comes here for — the hex — at the bottom in 11.5px grey.
    And the only way to learn it copied was the line of help text under the
    whole grid saying "click a color to copy it", which is the product telling
    you what it should be showing you.

    The swatch is a band across the top of a card now, so it reads as a sample
    of a colour rather than a button; the hex sits in the figure face at a size
    you can read across a desk; and Copy is a word you can see.
  */
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        background: C.panel,
      }}
    >
      <div
        style={{
          height: 48,
          background: color.hex,
          borderBottom: `1px solid ${C.border}`,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
        }}
      />
      <div style={{ padding: '9px 11px 10px' }}>
        <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500, lineHeight: 1.3 }}>
          {color.name}
        </div>
        {color.role && (
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>{color.role}</div>
        )}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginTop: 7,
          }}
        >
          <span style={{ ...numeric, fontSize: 12.5, color: C.dim }}>
            {color.hex.toUpperCase()}
          </span>
          <button
            onClick={onCopy}
            style={{
              background: copied ? C.green : 'transparent',
              border: `1px solid ${copied ? C.green : C.border}`,
              color: copied ? '#fff' : C.dim,
              borderRadius: 6, padding: '2px 9px', fontSize: 11.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
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
          {/*
            A kit you can take something out of.

            You could add a logo and never remove one. CALO&CO's kit held the
            site favicon, an ampersand in a black square, which is not the
            mark; the proposal takes the first logo it finds, so every proposal
            went out headed with a favicon and there was no button anywhere
            that would take it back out.

            Remove, and a way to say which one documents should use, because
            "the first one in the list" is not something anybody can see or
            change from here.
          */}
          {variants.map((v) => (
            <LogoCard
              key={v.id}
              variant={v}
              company={company}
              onError={setError}
              isDefault={(brand.logoLight ?? (brand.logos ?? [])[0]) === v.url}
              onUseOnDocuments={() => onChange({ logoLight: v.url })}
              onRemove={() =>
                onChange({
                  logos: (brand.logos ?? []).filter((u) => (u ?? '').trim() !== v.url),
                  ...(brand.logoLight === v.url ? { logoLight: '' } : {}),
                  ...(brand.logoDark === v.url ? { logoDark: '' } : {}),
                })
              }
            />
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
  isDefault,
  onUseOnDocuments,
  onRemove,
}: {
  variant: LogoVariant;
  company: string;
  onError: (msg: string | null) => void;
  isDefault: boolean;
  onUseOnDocuments: () => void;
  onRemove: () => void;
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
      {/*
        Which one goes on a proposal, and a way out.

        The document picks the first logo in the list, which is invisible from
        here, so the only way to change what a client sees at the top of a
        proposal was to get the order right by luck. This says which one is
        being used and lets you say otherwise.
      */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
        }}
      >
        {isDefault ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: C.green }}>
            On your documents
          </span>
        ) : (
          <button
            onClick={onUseOnDocuments}
            style={{ background: 'transparent', border: 'none', padding: 0, color: C.dim, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Use this on documents
          </button>
        )}
        <button
          onClick={onRemove}
          title="Take this out of the kit"
          style={{ background: 'transparent', border: 'none', padding: 0, color: C.red, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Remove
        </button>
      </div>
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
