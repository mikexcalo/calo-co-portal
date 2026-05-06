'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import supabase from '@/lib/supabase';

interface ActivityRow {
  id: string;
  type: 'note' | 'task';
  text: string;
  parentId: string | null;
  parentType: 'client' | 'contact' | null;
  parentName: string | null;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function RecentActivityCard() {
  const { t } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: clients } = await supabase.from('clients').select('id, name, company');
      const clientMap: Record<string, string> = {};
      for (const c of clients || []) clientMap[c.id] = c.company || c.name;

      const [notesRes, tasksRes] = await Promise.all([
        supabase.from('notes').select('id, content, client_id, contact_id, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('tasks').select('id, title, client_id, contact_id, created_at').order('created_at', { ascending: false }).limit(8),
      ]);

      const noteRows: ActivityRow[] = (notesRes.data || []).map((n: any) => ({
        id: n.id, type: 'note' as const,
        text: n.content.length > 60 ? n.content.slice(0, 60) + '...' : n.content,
        parentId: n.client_id || n.contact_id || null,
        parentType: n.client_id ? 'client' : n.contact_id ? 'contact' : null,
        parentName: n.client_id ? clientMap[n.client_id] || null : null,
        createdAt: n.created_at,
      }));

      const taskRows: ActivityRow[] = (tasksRes.data || []).map((tk: any) => ({
        id: tk.id, type: 'task' as const,
        text: tk.title.length > 60 ? tk.title.slice(0, 60) + '...' : tk.title,
        parentId: tk.client_id || tk.contact_id || null,
        parentType: tk.client_id ? 'client' : tk.contact_id ? 'contact' : null,
        parentName: tk.client_id ? clientMap[tk.client_id] || null : null,
        createdAt: tk.created_at,
      }));

      const merged = [...noteRows, ...taskRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

      setItems(merged);
      setLoaded(true);
    };
    load();
  }, []);

  if (!loaded) return null;

  const noteIcon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1.5h8a1 1 0 0 1 1 1v12l-5-2.5L3 14.5v-12a1 1 0 0 1 1-1z"/>
    </svg>
  );
  const taskIcon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#3B82F6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2"/><polyline points="5 8 7 10 11 6"/>
    </svg>
  );

  return (
    <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Recent activity
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '8px 16px 16px', fontSize: 12, color: t.text.tertiary, fontStyle: 'italic' }}>No recent activity</div>
      ) : (
        items.map((item, i) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => {
              if (item.parentType === 'client' && item.parentId) router.push(`/clients/${item.parentId}`);
              else if (item.parentType === 'contact' && item.parentId) router.push(`/contacts/${item.parentId}`);
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 16px', border: 'none', background: 'transparent',
              cursor: item.parentType ? 'pointer' : 'default',
              fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms',
              borderTop: i > 0 ? `0.5px solid ${t.border.default}` : 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.type === 'note' ? noteIcon : taskIcon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
              <div style={{ fontSize: 10, color: t.text.tertiary }}>
                {item.parentName ? `${item.parentName} \u00B7 ` : ''}{relativeTime(item.createdAt)}
              </div>
            </div>
          </button>
        ))
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}
