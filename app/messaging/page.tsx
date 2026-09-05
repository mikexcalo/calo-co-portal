'use client';

/**
 * What you say, on its own screen.
 *
 * It was a block at the bottom of the brand kit, under the colours, the type
 * and the logo uploader. That is the wrong place for the thing every pitch,
 * proposal and home page is written out of: you would only find it while
 * looking for something else.
 */

import { useOrg } from '@/lib/spine/org';
import { BrandMessage } from '@/components/spine/BrandMessage';
import { BRAND_TABS, Empty, Page } from '@/components/spine/ui';

export default function MessagingPage() {
  const { org, loading } = useOrg();
  return (
    <Page
      title="Messaging"
      subtitle="What you claim, who it is for, and where the edges are. Everything you send is written out of this."
      tabs={BRAND_TABS}
    >
      {loading || !org ? (
        <Empty>Loading…</Empty>
      ) : (
        <BrandMessage orgId={org.id} orgName={org.name} />
      )}
    </Page>
  );
}
