'use client';

/**
 * A client's brand, on the client's own record.
 *
 * There is no such thing as a brand you hold for nobody, so the door belongs
 * here rather than in the sidebar. You never wake up thinking "let me look at
 * brands"; you think "what is the state of Colette".
 *
 * Deliberately a visible section rather than a tab. A tab is invisible until
 * you are already on the page holding it, which is the exact fault that made
 * the last navigation unusable. This shows the palette and the faces at a
 * glance and links to the full kit for the detail.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Button, C, Card, SectionLabel } from './ui';

interface Brand {
  id: string;
  name: string;
  status: string;
  kit: {
    colors?: Array<{ name: string; hex: string; role?: string }>;
    fonts?: Array<{ family: string; role?: string; source?: string }>;
    assets?: Array<unknown>;
  };
}

export function BrandCard({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);

  const load = useCallback(async () => {
    const res = await supabase
      .from('brands')
      .select('id, name, status, kit')
      .eq('customer_id', customerId)
      .neq('status', 'archived')
      .order('name');
    if (!res.error) setBrands((res.data ?? []) as Brand[]);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  // Nothing to hold means nothing to show. A client with no brand should not
  // be told they are missing one.
  if (brands.length === 0) return null;

  const webFonts = brands
    .flatMap((b) => b.kit?.fonts ?? [])
    .filter((f) => /google/i.test(f.source ?? ''))
    .map((f) => `family=${f.family.trim().replace(/\s+/g, '+')}:wght@300;400;600`)
    .join('&');

  return (
    <div style={{ marginBottom: 26 }}>
      {webFonts && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${webFonts}&display=swap`} />
      )}

      <SectionLabel>
        {brands.length === 1 ? 'Brand' : `Brands (${brands.length})`}
      </SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {brands.map((b) => {
          const colors = b.kit?.colors ?? [];
          const fonts = b.kit?.fonts ?? [];
          const display = fonts.find((f) => /display|headline/i.test(f.role ?? ''));
          const loadable = display && /google/i.test(display.source ?? '');

          return (
            <Card key={b.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 14,
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Set in the brand's own display face. The point of a
                      brand card is to look like the brand, not like the app. */}
                  <div
                    style={{
                      fontSize: 22,
                      lineHeight: 1.15,
                      letterSpacing: '-0.02em',
                      fontWeight: 300,
                      color: C.text,
                      fontFamily: loadable
                        ? `'${display!.family}', Georgia, serif`
                        : 'inherit',
                    }}
                  >
                    {b.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
                    {fonts.map((f) => f.family).join(' · ')}
                    {b.kit?.assets?.length ? ` · ${b.kit.assets.length} assets` : ''}
                  </div>
                </div>

                <Button variant="ghost" onClick={() => router.push(`/brands/${b.id}`)}>
                  Open brand kit
                </Button>
              </div>

              {colors.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
                  {colors.map((c) => (
                    <span
                      key={c.hex + c.name}
                      title={`${c.name} ${c.hex}${c.role ? ` — ${c.role}` : ''}`}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        background: c.hex,
                        border: `1px solid ${C.border}`,
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
