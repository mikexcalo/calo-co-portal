import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DB } from '@/lib/database';
import { daysUntil } from '@/lib/utils';

interface FeedItem {
  label: string;
  sub: string;
  color: string;
  clientId?: string;
}

export default function ActivityFeed() {
  const router = useRouter();

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Tier 1: Overdue invoices (most overdue first)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = DB.invoices
      .filter((i) => {
        if (i.status === 'paid') return false;
        const daysToGo = daysUntil(i.due);
        return daysToGo !== null && daysToGo < 0;
      })
      .sort((a, b) => {
        const daysA = daysUntil(a.due);
        const daysB = daysUntil(b.due);
        return (daysA || 0) - (daysB || 0);
      });

    overdueInvoices.forEach((inv) => {
      const client = DB.clients.find((c) => c.id === inv.clientId);
      const coName = client?.company || client?.name || 'Unknown';
      const days = Math.abs(daysUntil(inv.due) || 0);
      const daysStr = days === 1 ? '1 day' : `${days} days`;
      items.push({
        label: 'Invoice Overdue',
        sub: `${coName} · ${daysStr} overdue`,
        color: 'af-red',
        clientId: inv.clientId,
      });
    });

    // Tier 2: Activity log (deduplicated and prioritized)
    const FEED_EVENTS = new Set([
      'invoice_created',
      'invoice_paid',
      'client_added',
      'contact_saved',
      'brand_guide_exported',
      'signature_generated',
    ]);

    const evLabels: Record<string, string> = {
      invoice_created: 'Invoice Created',
      invoice_paid: 'Invoice Paid',
      client_added: 'Client Added',
      contact_saved: 'Contact Saved',
      brand_guide_exported: 'Brand Guide Exported',
      signature_generated: 'Signature Generated',
    };

    const evColors: Record<string, string> = {
      invoice_created: 'af-blue',
      invoice_paid: 'af-green',
      client_added: 'af-blue',
      contact_saved: 'af-blue',
      brand_guide_exported: 'af-green',
      signature_generated: 'af-green',
    };

    const evPriority: Record<string, number> = {
      invoice_created: 0,
      invoice_paid: 1,
      client_added: 2,
      contact_saved: 3,
      signature_generated: 4,
      brand_guide_exported: 5,
    };

    const todayStr = today.toDateString();

    // Filter and deduplicate
    const tier2Raw = DB.activityLog.filter((e) => {
      if (!FEED_EVENTS.has(e.eventType)) return false;
      if (e.eventType === 'signature_generated') {
        const d = new Date(e.createdAt);
        if (d.toDateString() !== todayStr) return false;
      }
      return true;
    });

    const deduped: Array<any> = [];
    const seen = new Map<string, any>();

    tier2Raw.forEach((entry) => {
      const key = `${entry.eventType}|${entry.clientId}`;
      const d = new Date(entry.createdAt);
      const dateKey = isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullKey = `${key}|${dateKey}`;

      if (seen.has(fullKey)) {
        seen.get(fullKey).count++;
      } else {
        const item = { ...entry, count: 1, dateStr: dateKey };
        deduped.push(item);
        seen.set(fullKey, item);
      }
    });

    // Sort by priority within the same day, then by recency
    deduped.sort((a, b) => {
      const da = new Date(a.createdAt);
      const db = new Date(b.createdAt);
      const dayA = da.toDateString();
      const dayB = db.toDateString();

      if (dayA === dayB) {
        return (evPriority[a.eventType] ?? 99) - (evPriority[b.eventType] ?? 99);
      }
      return db.getTime() - da.getTime();
    });

    // Fill up to 6 items total with tier 2
    const remaining = 6 - items.length;
    deduped.slice(0, Math.max(0, remaining)).forEach((entry) => {
      const client = DB.clients.find((c) => c.id === entry.clientId);
      const coName = client?.company || client?.name || 'Unknown';
      const label = evLabels[entry.eventType] || entry.eventType;
      const countBadge = entry.count > 1 ? ` ×${entry.count}` : '';
      const color = evColors[entry.eventType] || 'af-blue';

      items.push({
        label: label + countBadge,
        sub: `${coName}${entry.dateStr ? ` · ${entry.dateStr}` : ''}`,
        color,
        clientId: entry.clientId,
      });
    });

    return items.slice(0, 6);
  }, []);

  const handleItemClick = (item: FeedItem) => {
    if (item.clientId) {
      router.push(`/clients/${item.clientId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div>
      <div className="section-hd" style={{ marginBottom: '14px' }}>
        <div className="section-title">Activity</div>
      </div>
      {feedItems.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: '12.5px', padding: '8px 2px' }}>
          No recent activity
        </div>
      ) : (
        <div>
          {feedItems.map((item, idx) => (
            <div
              key={idx}
              className={`af-card ${item.color}`}
              onClick={() => handleItemClick(item)}
              style={{ cursor: 'pointer' }}
            >
              <div className="af-title">{item.label}</div>
              <div className="af-sub">{item.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
