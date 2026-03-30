import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { initials } from '@/lib/utils';
import { DB, loadTasksNotes, updateTaskStatus } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
  expanded: boolean;
  onToggle: () => void;
}

export interface HealthResult {
  color: string;
  issues: { label: string; href: string }[];
}

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
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);

  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const health = getClientHealth(client);
  const logoUrl = client.logo;

  // Load client tasks/notes when expanded
  useEffect(() => {
    if (expanded) {
      loadTasksNotes(client.id).then((data) => setTasks(data.slice(0, 3)));
    }
  }, [expanded, client.id]);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [expanded, tasks]);

  const handleToggleTask = async (item: any) => {
    const newStatus = item.status === 'complete' ? 'open' : 'complete';
    await updateTaskStatus(item.id, newStatus);
    setTasks((prev) => prev.map((t) => t.id === item.id ? { ...t, status: newStatus } : t));
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      overflow: 'hidden', gridColumn: expanded ? '1 / -1' : undefined,
    }}>
      {/* Collapsed header */}
      <div onClick={onToggle} style={{
        padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
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
      </div>

      {/* Accordion expand */}
      <div style={{ maxHeight: expanded ? height : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
        <div ref={contentRef} style={{ padding: '0 14px 12px', fontSize: 12, borderTop: '1px solid #f1f5f9' }}>
          {/* Missing items — only if any */}
          {health.issues.length > 0 && (
            <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#475569', fontSize: 11 }}>Missing:</span>
              {health.issues.map((issue, i) => (
                <a key={i} onClick={(e) => { e.stopPropagation(); router.push(issue.href); }}
                  style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>
                  {issue.label}
                </a>
              ))}
            </div>
          )}

          {/* Recent tasks & notes for this client */}
          {tasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
              {tasks.map((item) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '4px 6px', background: '#f8fafc', borderRadius: 6,
                  opacity: item.status === 'complete' ? 0.5 : 1,
                }}>
                  {item.type === 'task' ? (
                    <input type="checkbox" checked={item.status === 'complete'}
                      onChange={(e) => { e.stopPropagation(); handleToggleTask(item); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span style={{
                    fontSize: 11, color: '#334155', lineHeight: 1.3,
                    textDecoration: item.status === 'complete' ? 'line-through' : 'none',
                  }}>{item.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Open button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600,
              border: '1.5px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Open</button>
          </div>
        </div>
      </div>
    </div>
  );
}
