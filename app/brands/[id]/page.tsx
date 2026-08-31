'use client';

/**
 * One brand.
 *
 * Everything that decides what the work looks like and sounds like: the
 * palette with each colour's job, the type stack, the voice rules, and the
 * things that are not cleared yet.
 *
 * What is unresolved goes first. An unlicensed wordmark and two uncleared
 * photographs are cheap to fix now and expensive on launch day, and they are
 * exactly the sort of thing that gets forgotten because nothing in a folder
 * of assets says "this one is a problem".
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

  const { colors = [], fonts = [], voice = {}, assets = [] } = brand.kit ?? {};
  const items = brand.open_items ?? [];
  const grouped = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    const g = a.group || 'other';
    (acc[g] ??= []).push(a);
    return acc;
  }, {});

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  };

  const never = (voice.never_use as string[] | undefined) ?? [];
  const always = (voice.always as string[] | undefined) ?? [];

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
      {items.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Before this can launch ({items.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((it, i) => {
              const blocking = it.severity === 'blocker';
              return (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${blocking ? `${C.red}44` : C.border}`,
                    background: blocking ? C.redSoft : C.panel,
                    borderRadius: 8,
                    padding: '11px 13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{it.item}</span>
                    {blocking && <Pill tone="red">Blocks launch</Pill>}
                  </div>
                  {it.why && (
                    <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3, lineHeight: 1.55 }}>
                      {it.why}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
            {fonts.map((f) => (
              <div
                key={f.family}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '11px 13px',
                  background: C.panel,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{f.family}</div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                    {[f.role, f.weight, f.tracking].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {f.source && (
                  <Pill tone={/licens/i.test(f.source) ? 'amber' : 'neutral'}>{f.source}</Pill>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(never.length > 0 || always.length > 0) && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Voice</SectionLabel>
          <Card>
            {never.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 7 }}>
                  Never use
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {never.map((w) => (
                    <span
                      key={w}
                      style={{
                        fontSize: 12,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: C.redSoft,
                        color: C.red,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {always.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 7 }}>
                  Always
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {always.map((w) => (
                    <span
                      key={w}
                      style={{
                        fontSize: 12,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: C.greenSoft,
                        color: C.green,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {['rhythm', 'structure', 'rtb_test', 'section_rhythm'].map((k) =>
              voice[k] ? (
                <p
                  key={k}
                  style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, margin: '0 0 8px' }}
                >
                  {String(voice[k])}
                </p>
              ) : null
            )}
          </Card>
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
