'use client';

/**
 * One brand.
 *
 * The palette with each colour's job, and the type stack shown in the actual
 * faces at the sizes their roles call for.
 *
 * A list of font names is a list of font names. Nobody can tell whether a
 * pairing works by reading "Newsreader 300, tracking -0.03em" — you have to
 * see the headline set as a headline next to the body set as body. So the page
 * loads the real families and renders each one doing its own job.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import {
  Button,
  C,
  Card,
  Empty,
  Page,
  Pill,
  SectionLabel,
} from '@/components/spine/ui';

interface OpenItem { item: string; why?: string; severity?: string }
interface Colour { name: string; hex: string; role?: string; token?: string }
interface Font {
  family: string;
  role?: string;
  weight?: string;
  tracking?: string;
  source?: string;
  /** Where the file lives, for a face we host rather than fetch from Google. */
  web_url?: string;
  files?: Array<{ label: string; url: string }>;
}
interface Asset {
  name?: string;
  path: string;
  group?: string;
  bytes?: number;
  mime?: string;
  url?: string;
  needs_approval?: boolean;
}

interface Brand {
  id: string;
  name: string;
  site_url: string | null;
  status: string;
  kit: {
    colors?: Colour[];
    fonts?: Font[];
    voice?: Record<string, unknown>;
    assets?: Asset[];
    notes?: Record<string, unknown>;
  };
  open_items: OpenItem[];
  customer?: { name: string; id: string } | null;
}

/**
 * What each role should look like, taken from how these faces are actually
 * used rather than from a generic type scale. A display face at 15px tells you
 * nothing; at 42px you can see the tracking is too tight.
 */
function specimenStyle(role: string | undefined): React.CSSProperties {
  const r = (role ?? '').toLowerCase();
  if (/display|headline|wordmark/.test(r)) {
    return { fontSize: 'clamp(30px, 4.4vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 300 };
  }
  if (/eyebrow|label/.test(r)) {
    return { fontSize: 13, letterSpacing: '0.17em', textTransform: 'uppercase', fontWeight: 600 };
  }
  return { fontSize: 17, lineHeight: 1.65, fontWeight: 400 };
}

/** What to set in each face so the specimen shows the face, not the words. */
function specimenText(role: string | undefined, family: string): string {
  const r = (role ?? '').toLowerCase();
  if (/wordmark/.test(r)) return family.split(' ')[0];
  if (/display|headline/.test(r)) return 'The work, in their own words';
  if (/eyebrow|label/.test(r)) return 'How it works';
  return 'Set at the size it runs on the page, so the line length and the colour of the paragraph are the thing you are judging.';
}

const kb = (n?: number) =>
  !n ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)}MB` : `${Math.round(n / 1000)}KB`;

export default function BrandDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [assetGroup, setAssetGroup] = useState('All');

  const load = useCallback(async () => {
    const res = await supabase
      .from('brands')
      .select('id, name, site_url, status, kit, open_items, customer:customers(id, name)')
      .eq('id', params.id)
      .maybeSingle();
    if (res.data) {
      setBrand({
        ...(res.data as unknown as Brand),
        customer: Array.isArray(res.data.customer) ? res.data.customer[0] : res.data.customer,
      });
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Page title="Brand"><Card><Empty>Loading…</Empty></Card></Page>;
  if (!brand) return <Page title="Brand"><Card><Empty>Not found.</Empty></Card></Page>;

  const { colors = [], fonts = [], assets = [] } = brand.kit ?? {};
  const grouped = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    const g = a.group || 'other';
    (acc[g] ??= []).push(a);
    return acc;
  }, {});

  /**
   * Only the families this brand actually uses, requested by name.
   *
   * Loading a fixed list would mean fetching faces nobody here needs and still
   * missing the one the next client turns up with. Anything not on Google
   * Fonts simply will not resolve, which is correct: a licensed face we have
   * no rights to should not silently render.
   */
  const webFonts = fonts
    .filter((f) => /google/i.test(f.source ?? ''))
    .map((f) => `family=${f.family.trim().replace(/\s+/g, '+')}:wght@300;400;600;700`)
    .join('&');

  /**
   * Faces we host, declared properly.
   *
   * Roundo is not on Google Fonts, so it used to render in a substitute with
   * an apology. The file is in storage now, which means the wordmark can be
   * shown in the wordmark's actual face — which is the entire point of a
   * brand kit.
   */
  const hostedFaces = fonts
    .filter((f) => f.web_url)
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';src:url('${f.web_url}') format('opentype');font-display:swap;}`
    )
    .join('');

  const shown = assetGroup === 'All' ? assets : (grouped[assetGroup] ?? []);

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Page
      back={{ label: 'Brands', href: '/brands' }}
      title={brand.name}
      subtitle={brand.customer ? `Held for ${brand.customer.name}` : 'Your own brand'}
      action={
        <>
          {brand.customer && (
            <Button variant="ghost" onClick={() => router.push(`/customers/${brand.customer!.id}`)}>
              Open client
            </Button>
          )}
        </>
      }
    >
      {webFonts && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?${webFonts}&display=swap`}
        />
      )}

      {hostedFaces && <style>{hostedFaces}</style>}

      {colors.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Colour ({colors.length})</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            {colors.map((c) => (
              <button
                key={c.hex + c.name}
                onClick={() => copy(c.hex)}
                title="Copy hex"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 10,
                  background: C.panel,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    background: c.hex,
                    border: `1px solid ${C.border}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>
                    {copied === c.hex ? 'Copied' : c.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: C.faint,
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {c.hex}{c.token ? ` · ${c.token}` : ''}
                  </span>
                  {c.role && (
                    <span style={{ display: 'block', fontSize: 11, color: C.faint, marginTop: 2 }}>
                      {c.role}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {fonts.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Type</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fonts.map((f) => {
              const loadable = /google/i.test(f.source ?? '') || !!f.web_url;
              return (
                <div
                  key={f.family}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: '16px 18px',
                    background: C.panel,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                        {f.family}
                      </span>
                      <span style={{ fontSize: 12, color: C.faint, marginLeft: 8 }}>
                        {[f.role, f.weight, f.tracking].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    {!loadable && f.source && (
                      <Pill tone="amber">{f.source}</Pill>
                    )}
                  </div>

                  <div
                    style={{
                      ...specimenStyle(f.role),
                      // Falls back to a system serif or sans of roughly the
                      // right shape, so an unloadable face still reads at the
                      // right weight rather than collapsing to the UI font.
                      fontFamily: loadable
                        ? `'${f.family}', ${/newsreader|serif/i.test(f.family) ? 'Georgia, serif' : 'system-ui, sans-serif'}`
                        : 'system-ui, sans-serif',
                      color: C.text,
                      opacity: loadable ? 1 : 0.55,
                    }}
                  >
                    {specimenText(f.role, f.family)}
                  </div>

                  {f.files && f.files.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      {f.files.map((file) => (
                        <a
                          key={file.url}
                          href={file.url}
                          download
                          style={{
                            fontSize: 11.5,
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: `1px solid ${C.border}`,
                            color: C.dim,
                            textDecoration: 'none',
                          }}
                        >
                          ↓ {file.label}
                        </a>
                      ))}
                    </div>
                  )}

                  {!loadable && (
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
                      Shown in a substitute. The file is not hosted here.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {assets.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <SectionLabel>Assets ({assets.length})</SectionLabel>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['All', ...Object.keys(grouped)].map((g) => {
                const on = assetGroup === g;
                return (
                  <button
                    key={g}
                    onClick={() => setAssetGroup(g)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 20,
                      fontSize: 11.5,
                      border: `1px solid ${on ? C.accent : C.border}`,
                      background: on ? C.accentSoft : 'transparent',
                      color: on ? C.text : C.dim,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/*
            A grid of what the files look like, not a list of what they are
            called. Nobody recognises a logo by its filename, and a column of
            chips in stacked cards was several screens of scrolling to see
            forty items that fit on one.
          */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))',
              gap: 8,
            }}
          >
            {shown.map((a) => {
              const isImage = (a.mime ?? '').startsWith('image/');
              const isVideo = (a.mime ?? '').startsWith('video/');
              return (
                <a
                  key={a.path}
                  href={a.url}
                  download
                  title={`${a.name ?? a.path}${a.bytes ? ` · ${kb(a.bytes)}` : ''}`}
                  style={{
                    border: `1px solid ${a.needs_approval ? `${C.amber}66` : C.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: C.panel,
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      background: C.panelAlt,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={a.name ?? a.path}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                      />
                    ) : isVideo ? (
                      <video
                        src={a.url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: C.faint, textAlign: 'center', padding: 8 }}>
                        {(a.name ?? '').split('.').pop()?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '7px 8px' }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.name ?? a.path.split('/').pop()}
                    </div>
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>
                      {kb(a.bytes)}
                      {a.needs_approval ? ' · not cleared' : ''}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

    </Page>
  );
}
