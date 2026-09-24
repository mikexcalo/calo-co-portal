'use client';

/**
 * QR codes, with the things you hand over.
 *
 * It was a tab of Brand because it reads the brand colors, which is a reason
 * to look the palette up and not a reason to live there. A QR code is
 * something you print on a van, a card or a sign and give to somebody — the
 * same job as the business card and the email signature, both of which moved
 * to Pitches already.
 */

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { QrStudio, type BrandColor } from '@/components/spine/QrStudio';
import { Empty, Page, PITCH_TABS } from '@/components/spine/ui';
import { orgNow } from '@/lib/spine/db';

export default function QrPage() {
  const { org } = useOrg();
  const [colors, setColors] = useState<BrandColor[]>([]);
  const [siteUrl, setSiteUrl] = useState('');

  useEffect(() => {
    const s = (org?.settings ?? {}) as { brand?: { colors?: BrandColor[] } };
    setColors(s.brand?.colors ?? []);
  }, [org]);

  /* The site is the usual thing a code points at, so it is the default. */
  useEffect(() => {
    (async () => {
      const id = await orgNow();
      if (!id) return;
      const res = await supabase
        .from('client_sites')
        .select('url')
        .eq('org_id', id)
        .limit(1)
        .maybeSingle();
      setSiteUrl((res.data as { url?: string } | null)?.url ?? '');
    })();
  }, []);

  return (
    <Page
      tabs={PITCH_TABS}
      title="QR Codes"
      subtitle="Something to point a phone at, in your colors."
    >
      {!org ? (
        <Empty>Loading…</Empty>
      ) : (
        <QrStudio
          orgId={org.id}
          colors={colors}
          company={org.name}
          defaultUrl={siteUrl}
        />
      )}
    </Page>
  );
}
