'use client';

/**
 * A client's brand files, where you go looking for them.
 *
 * They were reachable: open the client, find the brand card in the right rail,
 * press Open brand kit, land on a different object, scroll to Assets. Five
 * moves to answer "can you send us the logo", which is a question you get on a
 * phone call while somebody waits.
 *
 * WHY THE URLS ARE SIGNED HERE
 *
 * client-assets is private and scoped per org, so a link cannot be pasted into
 * an email and forwarded. That is correct for a working file: the export zip
 * is the thing you hand over, and this is the thing you grab from.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, SectionLabel } from './ui';

interface Asset {
  group?: string;
  name?: string;
  path: string;
  storage_path?: string;
  bytes?: number | null;
  for?: string;
  needs_approval?: boolean;
}

const kb = (n?: number | null) =>
  !n ? '' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function ClientBrandFiles({ customerId }: { customerId: string }) {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('brands')
      .select('id, kit, asset_prefix')
      .eq('customer_id', customerId)
      .maybeSingle();
    const b = res.data as { id: string; kit: { assets?: Asset[] } | null; asset_prefix: string | null } | null;
    if (b) {
      setBrandId(b.id);
      setPrefix(b.asset_prefix);
      setAssets((b.kit?.assets ?? []) as Asset[]);
    }
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const paths = assets.map((a) => a.storage_path).filter(Boolean) as string[];
    if (!paths.length || !prefix) return;
    let dead = false;
    supabase.storage
      .from('client-assets')
      .createSignedUrls(paths.map((p) => `${prefix}/${p}`), 3600)
      .then(({ data }) => {
        if (dead || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d, i) => { if (d.signedUrl) map[paths[i]] = d.signedUrl; });
        setSigned(map);
      });
    return () => { dead = true; };
  }, [assets, prefix]);

  /** Grouped in the order the groups were written, not alphabetically. */
  const groups = useMemo(() => {
    const out = new Map<string, Asset[]>();
    assets.forEach((a) => {
      const g = a.group ?? 'Files';
      out.set(g, [...(out.get(g) ?? []), a]);
    });
    return Array.from(out.entries());
  }, [assets]);

  if (!loaded) return null;

  if (!brandId) {
    return (
      <Card>
        <Empty>No brand on this client yet.</Empty>
      </Card>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Files ({assets.length})</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* The thing you actually send somebody. Everything, one file, with
              the colours and type written out alongside. */}
          <Button onClick={() => window.open(`/api/brands/${brandId}/export`, '_blank')}>
            Download everything
          </Button>
          <Button variant="ghost" onClick={() => window.open(`/brands/${brandId}`, '_self')}>
            Open the kit
          </Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card><Empty>Nothing filed against this brand yet.</Empty></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(([g, items]) => (
            <Card key={g}>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 7 }}>
                {g} ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((a, i) => {
                  const href = a.storage_path ? signed[a.storage_path] : undefined;
                  const name = a.name ?? a.path.split('/').pop() ?? a.path;
                  const ext = name.split('.').pop()?.toUpperCase() ?? '';
                  return (
                    <a
                      key={a.path}
                      href={href}
                      download={name}
                      style={{
                        display: 'flex', alignItems: 'baseline', gap: 10,
                        padding: '7px 0', textDecoration: 'none', color: 'inherit',
                        borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                        opacity: href ? 1 : 0.5,
                      }}
                    >
                      {/* The extension first: it is the one thing that tells
                          you what you are about to open. */}
                      <span
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                          color: C.faint, width: 34, flexShrink: 0,
                        }}
                      >
                        {ext}
                      </span>
                      <span style={{ fontSize: 13.5, color: C.text, flexShrink: 0 }}>{name}</span>
                      <span style={{ fontSize: 12.5, color: C.faint, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.for}
                      </span>
                      <span style={{ fontSize: 11.5, color: C.faint, flexShrink: 0 }}>{kb(a.bytes)}</span>
                    </a>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
