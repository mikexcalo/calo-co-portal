'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import supabase from '@/lib/supabase';

interface AlertItem {
  id: string;
  type: 'task' | 'event';
  title: string;
  parentId: string | null;
  parentType: 'client' | 'contact' | null;
  parentName: string | null;
  dateLabel: string;
  color: string;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatOverdue(dateStr: string): string {
  const diff = Math.abs(daysUntil(dateStr));
  if (diff === 0) return 'due today';
  if (diff === 1) return '1 day overdue';
  return `${diff} days overdue`;
}

function formatUpcoming(dateStr: string): string {
  const diff = daysUntil(dateStr);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 3) return `In ${diff} days`;
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function AlertsCard() {
  const { t } = useTheme();
  const router = useRouter();
  const [overdue, setOverdue] = useState<AlertItem[]>([]);
  const [upcoming, setUpcoming] = useState<AlertItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const { data: clients } = await supabase.from('clients').select('id, name, company');
      const clientMap: Record<string, string> = {};
      for (const c of clients || []) clientMap[c.id] = c.company || c.name;

      // Overdue tasks
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, client_id, contact_id')
        .is('completed_at', null)
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      const overdueItems: AlertItem[] = (overdueTasks || []).map((tk: any) => ({
        id: tk.id,
        type: 'task' as const,
        title: tk.title,
        parentId: tk.client_id || tk.contact_id || null,
        parentType: tk.client_id ? 'client' : tk.contact_id ? 'contact' : null,
        parentName: tk.client_id ? clientMap[tk.client_id] || null : null,
        dateLabel: formatOverdue(tk.due_date),
        color: '#DC2626',
      }));

      // Upcoming events
      const { data: upcomingEvents } = await supabase
        .from('events')
        .select('id, title, event_date, client_id, contact_id')
        .gte('event_date', today)
        .lte('event_date', weekOut)
        .order('event_date', { ascending: true });

      const upcomingItems: AlertItem[] = (upcomingEvents || []).map((ev: any) => ({
        id: ev.id,
        type: 'event' as const,
        title: ev.title,
        parentId: ev.client_id || ev.contact_id || null,
        parentType: ev.client_id ? 'client' : ev.contact_id ? 'contact' : null,
        parentName: ev.client_id ? clientMap[ev.client_id] || null : null,
        dateLabel: formatUpcoming(ev.event_date),
        color: '#6d28d9',
      }));

      setOverdue(overdueItems);
      setUpcoming(upcomingItems);
      setLoaded(true);
    };
    load();
  }, []);

  if (!loaded) return null;

  const total = overdue.length + upcoming.length;
  if (total === 0) return null;

  const handleClick = (item: AlertItem) => {
    if (!item.parentId || !item.parentType) return;
    router.push(item.parentType === 'client' ? `/clients/${item.parentId}` : `/contacts/${item.parentId}`);
  };

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      marginBottom: 16, overflow: 'hidden',
    }}>
      {overdue.length > 0 && (
        <>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Overdue tasks ({overdue.length})
          </div>
          {overdue.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', border: 'none', background: 'transparent',
                cursor: item.parentId ? 'pointer' : 'default',
                fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: t.text.tertiary }}>
                  {item.parentName ? `${item.parentName} \u00B7 ` : ''}{item.dateLabel}
                </div>
              </div>
            </button>
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          {overdue.length > 0 && <div style={{ height: 1, background: t.border.default, margin: '4px 16px' }} />}
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 600, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Upcoming this week ({upcoming.length})
          </div>
          {upcoming.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', border: 'none', background: 'transparent',
                cursor: item.parentId ? 'pointer' : 'default',
                fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: t.text.tertiary }}>
                  {item.parentName ? `${item.parentName} \u00B7 ` : ''}{item.dateLabel}
                </div>
              </div>
            </button>
          ))}
        </>
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}
