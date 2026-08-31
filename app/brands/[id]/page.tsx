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
interface Colour { name: string; hex: string; role?: string }
interface Font { family: string; role?: string; weight?: string; tracking?: string; source?: string }
interface Asset { path: string; group?: string; bytes?: number; needs_approval?: boolean }

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

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Page
      title={brand.name}
      subtitle={brand.customer ? `Held for ${brand.customer.name}` : 'Your own brand'}
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/brands')}>All brands</Button>
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
                    {c.hex}
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
              const loadable = /google/i.test(f.source ?? '');
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

                  {!loadable && (
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
                      Shown in a substitute. This face is licensed and is not loaded here.
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
          <SectionLabel>Assets ({assets.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(grouped).map(([group, list]) => (
              <Card key={group}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  {group.replace(/-/g, ' ')} ({list.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {list.map((a) => (
                    <span
                      key={a.path}
                      title={a.path}
                      style={{
                        fontSize: 11.5,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: a.needs_approval ? C.amberSoft : C.panelAlt,
                        color: a.needs_approval ? C.amber : C.dim,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {a.path.split('/').pop()}
                      {a.bytes ? ` · ${kb(a.bytes)}` : ''}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}
