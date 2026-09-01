'use client';

/**
 * Brands.
 *
 * An agency's own identity and every client identity it holds, in one place.
 * The brand kit used to live on the org, which quietly assumed a business has
 * exactly one brand. CALO&CO has its own and holds Colette's, and those are
 * different things that were sharing a field.
 *
 * The list leads with what is unresolved rather than with what is finished.
 * A brand with an unlicensed font and two uncleared photographs is not a
 * brand you can launch, and that fact is worth more on this screen than a
 * swatch of colors.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Empty,
  Metric,
  Page,
  Pill,
  SectionLabel,
} from '@/components/spine/ui';

interface OpenItem { item: string; why?: string; severity?: string }

interface Brand {
  id: string;
  name: string;
  site_url: string | null;
  status: string;
  kit: {
    colors?: Array<{ name: string; hex: string; role?: string }>;
    fonts?: Array<{ family: string }>;
    assets?: Array<{ needs_approval?: boolean }>;
  };
  open_items: OpenItem[];
  customer?: { name: string } | null;
}

export default function BrandsPage() {
  const router = useRouter();
  const { org, vocab } = useOrg();
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org) return;
    const res = await supabase
      .from('brands')
      .select('id, name, site_url, status, kit, open_items, customer:customers(name)')
      .eq('org_id', org.id)
      .neq('status', 'archived')
      .order('name');
    if (res.error) setError(res.error.message);
    else {
      setRows(
        (res.data ?? []).map((r: Record<string, unknown>) => ({
          ...(r as unknown as Brand),
          customer: Array.isArray(r.customer) ? r.customer[0] : r.customer,
        })) as Brand[]
      );
    }
    setLoading(false);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const blockers = rows.reduce(
    (n, b) => n + (b.open_items ?? []).filter((i) => i.severity === 'blocker').length,
    0
  );

  return (
    <Page
      title="Brands"
      subtitle={`Your own identity, and every ${vocab.customer.toLowerCase()} identity you hold.`}
      action={<Button onClick={() => router.push('/brand-kit')}>Open your brand kit</Button>}
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {loading ? (
        <Card><Empty>Loading…</Empty></Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty hero>
            No client brands yet. When you build an identity for somebody, its colors, type and
            voice rules live here rather than in a folder.
          </Empty>
        </Card>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 26,
            }}
          >
            <Metric label="Brands" value={String(rows.length)} hint="Being held or built" />
            <Metric
              label="Blocking launch"
              value={String(blockers)}
              tone={blockers > 0 ? 'red' : undefined}
              hint="Licences and permissions"
            />
          </div>

          <SectionLabel>All brands</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((b) => {
              const items = b.open_items ?? [];
              const blocking = items.filter((i) => i.severity === 'blocker').length;
              const colors = b.kit?.colors ?? [];
              return (
                <Card key={b.id}>
                  <div
                    onClick={() => router.push(`/brands/${b.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15.5, fontWeight: 600, color: C.text }}>
                            {b.name}
                          </span>
                          {b.status === 'building' && <Pill tone="blue">In build</Pill>}
                          {blocking > 0 && (
                            <Pill tone="red">
                              {blocking} blocking launch
                            </Pill>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                          {b.customer?.name ?? 'Your own brand'}
                          {b.kit?.fonts?.length ? ` · ${b.kit.fonts.map((f) => f.family).join(', ')}` : ''}
                        </div>
                      </div>

                      {/* The palette as the row's own signature. Faster to
                          recognize than the name, once there are a dozen. */}
                      {colors.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          {colors.slice(0, 8).map((c) => (
                            <span
                              key={c.hex + c.name}
                              title={`${c.name} ${c.hex}`}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 5,
                                background: c.hex,
                                border: `1px solid ${C.border}`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
