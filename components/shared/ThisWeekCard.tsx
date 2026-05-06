'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import supabase from '@/lib/supabase';

interface WeekEvent {
  id: string;
  title: string;
  eventDate: string;
  clientId: string | null;
  contactId: string | null;
  parentName: string | null;
  parentType: 'client' | 'contact' | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatEventDate(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function ThisWeekCard() {
  const { t } = useTheme();
  const router = useRouter();
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const { data: clients } = await supabase.from('clients').select('id, name, company');
      const clientMap: Record<string, string> = {};
      for (const c of clients || []) clientMap[c.id] = c.company || c.name;

      const { data } = await supabase
        .from('events')
        .select('id, title, event_date, client_id, contact_id')
        .gte('event_date', today)
        .lte('event_date', weekOut)
        .order('event_date', { ascending: true })
        .limit(5);

      setEvents((data || []).map((ev: any) => ({
        id: ev.id,
        title: ev.title,
        eventDate: ev.event_date,
        clientId: ev.client_id,
        contactId: ev.contact_id,
        parentName: ev.client_id ? clientMap[ev.client_id] || null : null,
        parentType: ev.client_id ? 'client' : ev.contact_id ? 'contact' : null,
      })));
      setLoaded(true);
    };
    load();
  }, []);

  if (!loaded) return null;

  return (
    <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px 8px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        This week
      </div>
      {events.length === 0 ? (
        <div style={{ padding: '8px 16px 16px', fontSize: 12, color: t.text.tertiary, fontStyle: 'italic' }}>No events this week</div>
      ) : (
        events.map((ev, i) => (
          <button
            key={ev.id}
            onClick={() => {
              if (ev.parentType === 'client' && ev.clientId) router.push(`/clients/${ev.clientId}`);
              else if (ev.parentType === 'contact' && ev.contactId) router.push(`/contacts/${ev.contactId}`);
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', border: 'none', background: 'transparent',
              cursor: ev.parentType ? 'pointer' : 'default',
              fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
              borderTop: i > 0 ? `0.5px solid ${t.border.default}` : 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#6d28d9', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
              <div style={{ fontSize: 11, color: t.text.tertiary }}>
                {ev.parentName ? `${ev.parentName} \u00B7 ` : ''}{formatEventDate(ev.eventDate)}
              </div>
            </div>
          </button>
        ))
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}
