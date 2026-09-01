'use client';

/**
 * One brand.
 *
 * The palette with each color's job, and the type stack shown in the actual
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
interface Color { name: string; hex: string; role?: string; token?: string }
interface Font {
  family: string;
  role?: string;
  weight?: string;
  tracking?: string;
  source?: string;
  /** Where the file lives, for a face we host rather than fetch from Google. */
  storage_path?: string;
  files?: Array<{ label: string; storage_path?: string; url?: string }>;
}
interface Asset {
  name?: string;
  path: string;
  group?: string;
  bytes?: number;
  mime?: string;
  /**
   * Where the file sits in private storage. Deliberately not a URL: a URL
   * implies anybody holding it can fetch the file, and these live in a bucket
   * that requires a signature. Signed at render time for whoever is signed in.
   */
  storage_path?: string;
  needs_approval?: boolean;
}

/**
 * Filing order, and the names a person would use.
 *
 * The order is how often you reach for them, not alphabetical: the hero video
 * and the site photography are what somebody is usually after, and the fonts
 * and read-me files are what they scroll past. Groups not on this list keep
 * their own name and sort to the end, so an unexpected category is filed
 * rather than hidden.
 */
const ASSET_CANON = [
  'Video',
  'Photography',
  'Customer logos',
  'Integration logos',
  'Fonts',
  'Documents',
];

const ASSET_LABEL: Record<string, string> = {
  Video: 'Hero video',
  Photography: 'Site images and headshots',
  'Customer logos': 'Customer logos',
  'Integration logos': 'Integration logos',
  Fonts: 'Typefaces',
  Documents: 'Documents',
  other: 'Everything else',
};

interface Brand {
  id: string;
  name: string;
  site_url: string | null;
  status: string;
  kit: {
    colors?: Color[];
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
  // Deliberately outside the portal's scale. A specimen shows a client's face
  // at the size their brand uses it, and moving with our own UI would make it
  // a picture of our decisions rather than theirs.
  return { fontSize: 17, lineHeight: 1.65, fontWeight: 400 };
}

/** What to set in each face so the specimen shows the face, not the words. */
function specimenText(role: string | undefined, family: string): string {
  const r = (role ?? '').toLowerCase();
  if (/wordmark/.test(r)) return family.split(' ')[0];
  if (/display|headline/.test(r)) return 'The work, in their own words';
  if (/eyebrow|label/.test(r)) return 'How it works';
  return 'Set at the size it runs on the page, so the line length and the color of the paragraph are the thing you are judging.';
}

const kb = (n?: number) =>
  !n ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)}MB` : `${Math.round(n / 1000)}KB`;

export default function BrandDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

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

  /**
   * Short-lived signed links for every file.
   *
   * The bucket is private, so nothing here is fetchable by an address alone.
   * Signatures last an hour: long enough to browse and download a set, short
   * enough that a link pasted into a chat stops working before it travels.
   *
   * A client's photo library is not ours to publish, and some of this
   * photography is not cleared. A public bucket would have meant anybody with
   * the address could pull the uncleared portrait, which is the sort of thing
   * that only surfaces when it has already gone wrong.
   */
  useEffect(() => {
    if (!brand) return;
    const paths = [
      ...(brand.kit?.assets ?? []).map((a) => a.storage_path).filter(Boolean),
      ...(brand.kit?.fonts ?? []).flatMap((f) => [
        f.storage_path,
        ...(f.files ?? []).map((x) => x.storage_path),
      ]).filter(Boolean),
    ] as string[];
    if (paths.length === 0) return;

    let cancelled = false;
    supabase.storage
      .from('client-assets')
      .createSignedUrls(paths.map((p) => `colette/${p}`), 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d) => {
          if (d.signedUrl && d.path) map[d.path.replace(/^colette\//, '')] = d.signedUrl;
        });
        setSigned(map);
      });
    return () => { cancelled = true; };
  }, [brand]);

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
    .filter((f) => f.storage_path && signed[f.storage_path])
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';src:url('${signed[f.storage_path!]}') format('opentype');font-display:swap;}`
    )
    .join('');

  const ASSET_ORDER = [
    ...ASSET_CANON.filter((g) => grouped[g]?.length),
    ...Object.keys(grouped).filter((g) => !ASSET_CANON.includes(g)),
  ];

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
          <Button onClick={() => router.push(`/brands/${brand.id}/messaging`)}>
            Messaging
          </Button>
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
          <SectionLabel>Color ({colors.length})</SectionLabel>
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
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>
                    {copied === c.hex ? 'Copied' : c.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: C.faint,
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {c.hex}{c.token ? ` · ${c.token}` : ''}
                  </span>
                  {c.role && (
                    <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 2 }}>
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
              const loadable = /google/i.test(f.source ?? '') || !!(f.storage_path && signed[f.storage_path]);
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
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                        {f.family}
                      </span>
                      <span style={{ fontSize: 13, color: C.faint, marginLeft: 8 }}>
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
                          key={file.label}
                          href={file.storage_path ? signed[file.storage_path] : file.url}
                          download
                          style={{
                            fontSize: 12.5,
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
                    <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
                      Shown in a substitute. The file is not hosted here.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/*
        A content repository, filed by what a thing is for.
        
        This was a wall of thumbnails, and the thumbnails broke. Even when they
        render, a 116px square of a logo on a cream background tells you less
        than its name does, and forty of them is a wall you scan rather than
        read. Filed and named, you find the file you came for.
      */}
      {assets.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Assets ({assets.length})</SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ASSET_ORDER.filter((g) => grouped[g]?.length).map((g) => {
              const items = grouped[g];
              const cleared = items.filter((a) => !a.needs_approval).length;
              return (
                <Card key={g}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                      {ASSET_LABEL[g] ?? g}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.faint }}>
                      {items.length} {items.length === 1 ? 'file' : 'files'}
                      {cleared < items.length ? ` · ${items.length - cleared} not cleared` : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: 2,
                    }}
                  >
                    {items.map((a) => {
                      const href = a.storage_path ? signed[a.storage_path] : undefined;
                      const name = a.name ?? a.path.split('/').pop() ?? a.path;
                      const ext = name.split('.').pop()?.toUpperCase() ?? '';
                      return (
                        <a
                          key={a.path}
                          href={href}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '7px 9px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            color: 'inherit',
                            background: a.needs_approval ? C.amberSoft : 'transparent',
                          }}
                        >
                          {/* The extension, because it is the one thing that
                              tells you what you are about to open. */}
                          <span
                            style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: '.04em',
                              color: C.faint,
                              background: C.panelAlt,
                              borderRadius: 4,
                              padding: '3px 5px',
                              minWidth: 34,
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {ext}
                          </span>
                          <span
                            style={{
                              fontSize: 13.5,
                              color: C.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {name}
                          </span>
                          {a.needs_approval && (
                            <span style={{ fontSize: 11.5, color: C.amber, flexShrink: 0 }}>
                              not cleared
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 12,
                              color: C.faint,
                              flexShrink: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {kb(a.bytes)}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

    </Page>
  );
}
