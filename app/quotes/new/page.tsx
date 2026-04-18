'use client';

import { useTheme } from '@/lib/theme';
import { PageShell, PageHeader } from '@/components/shared/Brand';

export default function NewQuotePage() {
  const { t } = useTheme();
  return (
    <PageShell>
      <PageHeader title="New Quote" subtitle="Coming soon" />
      <div style={{ padding: 40, textAlign: 'center', background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12 }}>
        <div style={{ fontSize: 14, color: t.text.tertiary, marginBottom: 4 }}>Coming soon</div>
        <div style={{ fontSize: 12, color: t.text.tertiary, opacity: 0.6 }}>The quote creation form will be built in Brief Q2.</div>
      </div>
    </PageShell>
  );
}
