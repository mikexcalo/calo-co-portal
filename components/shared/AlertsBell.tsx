'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import supabase from '@/lib/supabase';

interface AlertItem {
  id: string;
  type: 'task' | 'event';
  title: string;
  clientId: string | null;
  clientName: string | null;
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
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function AlertsBell() {
  const { t } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overdue, setOverdue] = useState<AlertItem[]>([]);
  const [upcoming, setUpcoming] = useState<AlertItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      // Load clients for name lookup
      const { data: clients } = await supabase.from('clients').select('id, name, company');
      const clientMap: Record<string, string> = {};
      for (const c of clients || []) {
        clientMap[c.id] = c.company || c.name;
      }

      // Overdue tasks: due_date < today AND completed_at IS NULL
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, client_id')
        .is('completed_at', null)
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      const overdueItems: AlertItem[] = (overdueTasks || []).map((tk: any) => ({
        id: tk.id,
        type: 'task' as const,
        title: tk.title,
        clientId: tk.client_id,
        clientName: tk.client_id ? clientMap[tk.client_id] || null : null,
        dateLabel: formatOverdue(tk.due_date),
        color: '#DC2626',
      }));

      // Upcoming events: event_date BETWEEN today AND today+7
      const { data: upcomingEvents } = await supabase
        .from('events')
        .select('id, title, event_date, client_id')
        .gte('event_date', today)
        .lte('event_date', weekOut)
        .order('event_date', { ascending: true });

      const upcomingItems: AlertItem[] = (upcomingEvents || []).map((ev: any) => ({
        id: ev.id,
        type: 'event' as const,
        title: ev.title,
        clientId: ev.client_id,
        clientName: ev.client_id ? clientMap[ev.client_id] || null : null,
        dateLabel: formatUpcoming(ev.event_date),
        color: '#6d28d9',
      }));

      setOverdue(overdueItems);
      setUpcoming(upcomingItems);
    };
    load();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const total = overdue.length + upcoming.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 32, height: 32, border: 'none', borderRadius: 6, background: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.text.tertiary, transition: 'color 150ms', position: 'relative',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.text.tertiary; }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6a4 4 0 0 1 8 0c0 2.5 1 4 1 4H3s1-1.5 1-4z"/>
          <path d="M6.5 13a1.5 1.5 0 0 0 3 0"/>
        </svg>
        {total > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 14, height: 14, borderRadius: 7,
            background: '#DC2626', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 360, maxHeight: 420, overflowY: 'auto',
          background: t.bg.surface, border: `1px solid ${t.border.default}`,
          borderRadius: 10, boxShadow: t.shadow.elevated, zIndex: 50,
          padding: '12px 0',
        }}>
          {total === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>
              No alerts
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <>
                  <div style={{ padding: '4px 16px 6px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Overdue
                  </div>
                  {overdue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { if (item.clientId) { router.push(`/clients/${item.clientId}`); setOpen(false); } }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px', border: 'none', background: 'transparent',
                        cursor: item.clientId ? 'pointer' : 'default',
                        fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 6, height: 6, borderRadius: 3, background: item.color, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>
                          {item.clientName ? `${item.clientName} \u00B7 ` : ''}{item.dateLabel}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {upcoming.length > 0 && (
                <>
                  {overdue.length > 0 && <div style={{ height: 1, background: t.border.default, margin: '6px 16px' }} />}
                  <div style={{ padding: '4px 16px 6px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Upcoming this week
                  </div>
                  {upcoming.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { if (item.clientId) { router.push(`/clients/${item.clientId}`); setOpen(false); } }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px', border: 'none', background: 'transparent',
                        cursor: item.clientId ? 'pointer' : 'default',
                        fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 6, height: 6, borderRadius: 3, background: item.color, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: t.text.tertiary }}>
                          {item.clientName ? `${item.clientName} \u00B7 ` : ''}{item.dateLabel}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
