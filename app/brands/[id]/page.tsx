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
import { Swatch, ColorRules, LogoRules, Pairings, ApprovalBanner, StatusChip } from '@/components/spine/BrandSpecimen';
import { Messaging } from '@/components/spine/Messaging';
import { useOrg } from '@/lib/spine/org';
import { kitFromBrand } from '@/lib/spine/brandkit';
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
  /** How the brand sets it. Optional, and most brands never say. */
  case?: string;
  status?: 'Decided by CALO&CO' | 'Proposed' | 'Not decided';
  client_approved?: boolean;
  status_note?: string;
  /** Where the file lives, for a face we host rather than fetch from Google. */
  storage_path?: string;
  files?: Array<{ label: string; storage_path?: string; url?: string }>;
}
interface Asset {
  /** Provenance, where somebody recorded it. Most assets have none. */
  status?: 'Decided by CALO&CO' | 'Proposed' | 'Not decided';
  client_approved?: boolean;
  status_note?: string;
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

/**
 * Can this be shown as a picture rather than described as a file.
 *
 * By extension rather than by sniffing, because the name is what we have and
 * the browser decides the rest. SVG is in deliberately: it is served from a
 * private bucket through a signed url into an img tag, which does not execute
 * script even if one were present, and these marks are vector originals whose
 * whole point is that they are exact.
 */
const PREVIEWABLE = /\.(svg|png|jpe?g|gif|webp|avif)$/i;
const isPreviewable = (name: string) => PREVIEWABLE.test(name);

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
  /** Which folder in storage holds this brand's files. Was hardcoded. */
  asset_prefix: string | null;
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
  const { org } = useOrg();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await supabase
      .from('brands')
      .select('id, name, site_url, status, kit, open_items, asset_prefix, customer:customers(id, name)')
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
    /*
      Strip the brand's own prefix, not Colette's.

      storage_path in the kit is relative to asset_prefix, so the request has
      to prepend it and the reply has to have it taken off again to match the
      key the renderer looks up. The second half was hardcoded to `colette/`,
      which is the only prefix that existed when it was written. For any other
      brand the signed url came back under a key nothing asked for, every
      lookup missed, and the assets rendered as dead links with no error
      anywhere. Found on the first brand to have a prefix that was not Colette.
    */
    const prefix = brand?.asset_prefix ?? 'colette';
    supabase.storage
      .from('client-assets')
      .createSignedUrls(paths.map((p) => `${prefix}/${p}`), 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d) => {
          if (d.signedUrl && d.path) map[d.path.replace(new RegExp(`^${prefix}/`), '')] = d.signedUrl;
        });
        setSigned(map);
      });
    return () => { cancelled = true; };
  }, [brand]);

  if (loading) return <Page title="Brand"><Card><Empty>Loading…</Empty></Card></Page>;
  if (!brand) return <Page title="Brand"><Card><Empty>Not found.</Empty></Card></Page>;

  const { colors = [], fonts = [], assets = [] } = brand.kit ?? {};
  /* Read once. Three components wanted it and each was rebuilding it. */
  const kit = kitFromBrand({ id: brand.id, name: brand.name, kit: brand.kit });
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
          {/* The answer to "can you send the design files". One click, one
              zip, nothing to assemble by hand and nothing forgotten. */}
          <Button onClick={() => { window.location.href = `/api/brands/${brand.id}/export`; }}>
            Export kit
          </Button>
          {/* Renamed. The framework is on this page now, so the screen
              behind this button is the proof register and the banned-term
              checker, which is what it was actually for. */}
          <Button variant="ghost" onClick={() => router.push(`/brands/${brand.id}/messaging`)}>
            Proof &amp; guardrails
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

      {/*
        Before the artwork, not after it.

        Whether the client has seen any of this changes what everything below
        means, and a kit read as finished and a kit read as a proposal are the
        same pixels. One line, passed before the swatches.
      */}
      <ApprovalBanner kit={kit} />

      {/*
        What this brand says, in the same framework as every other one.

        A client's brand row held colors, fonts and logos and had no opinion
        about the words — so the part every pitch and homepage is written out
        of existed for your own brand and for none of theirs. Same component,
        same six statements, same pillars.
      */}
      <div style={{ marginBottom: 30 }}>
        <Messaging orgId={org?.id ?? null} brandId={brand.id} name={brand.name} />
      </div>

      {colors.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Color ({colors.length})</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: 12,
            }}
          >
            {colors.map((c, i) => <Swatch key={`${c.hex}-${i}`} c={c} />)}
          </div>
        </div>
      )}

      {/*
        Two different things, in the order they should be read.

        The brand's own rules first, because they are decisions and they are
        stricter. The contrast table second, because it is arithmetic and
        arithmetic does not know what was agreed. Where they disagree the rule
        wins, and the rules block says so.
      */}
      <div style={{ marginBottom: 26 }}>
        <ColorRules kit={kit} />
      </div>

      {colors.length > 1 && (
        <div style={{ marginBottom: 26 }}>
          {/* Derived from the colors above, never typed, so it cannot drift. */}
          <Pairings kit={kit} />
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
                        {/* Case sits with the other specifications, because a
                            wordmark set in uppercase is wrong in sentence case
                            and the person who needs to know is reading this. */}
                        {[f.role, f.weight, f.tracking, f.case].filter(Boolean).join(' · ')}
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <StatusChip of={{ status: f.status, clientApproved: f.client_approved, statusNote: f.status_note }} />
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
      {/*
        Beside the files it governs, not in a document beside the product.

        With the artwork already downloaded the questions are which one goes
        here, how small it can go, and what is not allowed. Those belong next
        to the download, which is the last place anybody looks before using it.
      */}
      <div style={{ marginBottom: 26 }}>
        <LogoRules kit={kit} />
      </div>

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
                          {/*
                            The file, where the file can be shown.

                            A list of names with an extension chip answers
                            "what is in the kit" and not "is this the right
                            one", which is the question somebody opening a mark
                            actually has. A logo you cannot see is a filename.

                            Checkered ground because these are transparent, and
                            a white mark on a white card is an empty square.
                            Anything not an image keeps the chip, which is
                            still the most useful thing to say about a PDF.
                          */}
                          {href && isPreviewable(name) ? (
                            <span
                              style={{
                                flexShrink: 0,
                                width: 34,
                                height: 34,
                                borderRadius: 4,
                                background:
                                  'repeating-conic-gradient(#EDEEF0 0% 25%, #FFFFFF 0% 50%) 50% / 10px 10px',
                                border: `1px solid ${C.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={href}
                                alt=""
                                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                              />
                            </span>
                          ) : (
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
                          )}
                          <StatusChip of={{ status: a.status, clientApproved: a.client_approved, statusNote: a.status_note }} />
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
