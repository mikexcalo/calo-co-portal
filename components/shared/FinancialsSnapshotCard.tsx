'use client';

import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { DB } from '@/lib/database';
import { invTotal, currency } from '@/lib/utils';

export function FinancialsSnapshotCard() {
  const { t } = useTheme();
  const router = useRouter();
  const invoices = DB.invoices;

  if (invoices.length === 0) {
    return (
      <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Financials</div>
        <div style={{ fontSize: 12, color: t.text.tertiary, fontStyle: 'italic' }}>No invoices yet</div>
      </div>
    );
  }

  const outstanding = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');
  const outstandingTotal = outstanding.reduce((s, i) => s + invTotal(i), 0);
  const overdue = invoices.filter((i) => i.status === 'overdue');
  const overdueTotal = overdue.reduce((s, i) => s + invTotal(i), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = invoices.filter((i) => {
    if (i.status !== 'paid') return false;
    const paidDate = (i as any).paidDate || (i as any).paid_date;
    if (!paidDate) return true; // assume current if no date
    return new Date(paidDate) >= monthStart;
  });
  const paidTotal = paidThisMonth.reduce((s, i) => s + invTotal(i), 0);

  const metrics = [
    { label: 'Outstanding', value: currency(outstandingTotal), count: outstanding.length, color: outstandingTotal > 0 ? '#F59E0B' : t.text.secondary },
    { label: 'Paid this month', value: currency(paidTotal), count: paidThisMonth.length, color: paidTotal > 0 ? '#16a34a' : t.text.secondary },
    { label: 'Overdue', value: currency(overdueTotal), count: overdue.length, color: overdueTotal > 0 ? '#DC2626' : t.text.secondary },
  ];

  return (
    <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Financials
      </div>
      <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {metrics.map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.color, lineHeight: 1.2 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>
              {m.label} {m.count > 0 ? `\u00B7 ${m.count} invoice${m.count !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 16px 12px', borderTop: `0.5px solid ${t.border.default}` }}>
        <span onClick={() => router.push('/financials')} style={{ fontSize: 12, color: t.accent.primary, cursor: 'pointer' }}>
          View all \u2192
        </span>
      </div>
    </div>
  );
}
