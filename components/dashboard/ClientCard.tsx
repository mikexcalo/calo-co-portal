import React, { useState, useRef, useEffect } from 'react';
import { Client } from '@/lib/types';
import { initials } from '@/lib/utils';
import { DB, loadTasksNotes, updateTaskStatus } from '@/lib/database';
import TaskNoteCard from '@/components/shared/TaskNoteCard';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
  expanded: boolean;
  onToggle: () => void;
}

export interface HealthResult { color: string; issues: { label: string; href: string }[]; }

export function getClientHealth(client: Client, staleDays = 7): HealthResult {
  const issues: { label: string; href: string }[] = [];
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0];
  const nameParts = (primary?.name || '').split(/\s+/);
  if (!nameParts[0]) issues.push({ label: 'First Name', href: `/clients/${client.id}` });
  if (!nameParts[1]) issues.push({ label: 'Last Name', href: `/clients/${client.id}` });
  if (!primary?.email && !client.email) issues.push({ label: 'Email', href: `/clients/${client.id}` });
  const bk = client.brandKit;
  const hasLogos = bk && Object.values(bk.logos || {}).some((a: any) => a?.length > 0);
  const hasColors = bk?.colors?.length > 0;
  if (!hasLogos) issues.push({ label: 'Brand Kit logos', href: `/clients/${client.id}/brand-kit` });
  if (!hasColors) issues.push({ label: 'Brand colors', href: `/clients/${client.id}/brand-kit` });
  const hasMandatory = !!nameParts[0] && !!nameParts[1] && !!(primary?.email || client.email);
  const lastAct = DB.activityLog.filter((e) => e.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const daysSince = lastAct ? (Date.now() - new Date(lastAct.createdAt).getTime()) / 86400000 : Infinity;
  let color: string;
  if (!hasMandatory || daysSince > staleDays) color = '#ef4444';
  else if (daysSince > staleDays - 2 || !hasLogos || !hasColors) color = '#f59e0b';
  else color = '#22c55e';
  return { color, issues };
}

export default function ClientCard({ client, onNavigate, expanded, onToggle }: ClientCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [hovered, setHovered] = useState(false);

  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const health = getClientHealth(client);
  const logoUrl = client.logo;

  useEffect(() => {
    if (expanded) loadTasksNotes(client.id).then((d) => setTasks(d.slice(0, 3)));
  }, [expanded, client.id]);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [expanded, tasks]);

  const handleToggleTask = async (item: any) => {
    const ns = item.status === 'complete' ? 'open' : 'complete';
    await updateTaskStatus(item.id, ns);
    setTasks((p) => p.map((t) => t.id === item.id ? { ...t, status: ns } : t));
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !expanded ? '#f8fafc' : '#fff',
        border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
        transition: 'background 0.12s',
      }}
    >
      {/* Collapsed row */}
      <div onClick={onToggle} style={{
        padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div className="cc-row-avatar" style={logoUrl ? { background: 'transparent' } : undefined}>
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initials(client.company || client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e', lineHeight: 1.3 }}>
            {client.company || client.name}
          </div>
          {primary && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {primary.name}{primary.role ? ` · ${primary.role}` : ''}
            </div>
          )}
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: health.color, flexShrink: 0 }} />
        {/* Visible Open button on collapsed tile (#2) */}
        <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{
          padding: '3px 10px', fontSize: 11, fontWeight: 600, color: '#2563eb',
          background: 'none', border: '1px solid #dbeafe', borderRadius: 5,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
        }}>Open</button>
        <span style={{
          color: hovered ? '#94a3b8' : '#d1d5db', fontSize: 10, flexShrink: 0,
          transition: 'transform 0.25s ease, color 0.12s',
          transform: expanded ? 'rotate(180deg)' : 'none',
        }}>▾</span>
      </div>

      {/* Accordion — simplified (#1): only tasks/notes + Open button */}
      <div style={{ maxHeight: expanded ? height : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
        <div ref={contentRef} style={{ padding: '0 14px 12px', borderTop: '1px solid #f1f5f9' }}>
          {/* Recent tasks/notes only */}
          {tasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {tasks.map((item) => (
                <TaskNoteCard
                  key={item.id}
                  item={item}
                  showClient={false}
                  onToggle={() => handleToggleTask(item)}
                />
              ))}
            </div>
          )}
          {/* Open button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600,
              border: '1.5px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Open →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
