'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { initials, currency } from '@/lib/utils';
import { DB, loadTasksNotes, updateTaskStatus } from '@/lib/database';

interface ClientCardProps {
  client: Client;
  onNavigate: () => void;
  taskCount: number;
  invoiceCount: number;
  expanded: boolean;
  onToggle: () => void;
  onTaskCompleted?: () => void;
}

export default function ClientCard({ client, onNavigate, taskCount, invoiceCount, expanded, onToggle, onTaskCompleted }: ClientCardProps) {
  const router = useRouter();
  const contacts = DB.contacts[client.id] || [];
  const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
  const logoUrl = client.logo;
  const [expandData, setExpandData] = useState<{ tasks: any[]; invoices: any[] }>({ tasks: [], invoices: [] });
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [fadingId, setFadingId] = useState<string | null>(null);

  useEffect(() => {
    if (expanded) {
      loadTasksNotes(client.id).then((data) => {
        const openTasks = data.filter((t: any) => t.type === 'task' && t.status === 'open').slice(0, 5);
        const unpaidInv = DB.invoices.filter((i) => i.clientId === client.id && (i.status === 'unpaid' || i.status === 'overdue'));
        setExpandData({ tasks: openTasks, invoices: unpaidInv });
      });
    }
  }, [expanded, client.id]);

  useEffect(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, [expanded, expandData]);

  const handleCompleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFadingId(taskId);
    await updateTaskStatus(taskId, 'complete');
    // Fade out over 300ms, then remove
    setTimeout(() => {
      setExpandData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) }));
      setFadingId(null);
      onTaskCompleted?.();
    }, 300);
  };

  const name = client.company || client.name || '?';
  const colors = ['#dbeafe', '#fef3c7', '#d1fae5', '#fce7f3', '#ede9fe', '#ffedd5'];
  const bgColor = colors[name.charCodeAt(0) % colors.length];

  const relTime = (iso: string) => {
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24);
    return dy === 1 ? 'Yesterday' : `${dy}d ago`;
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <span style={{ fontSize: 14, color: '#9ca3af', opacity: 0.4, flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: logoUrl ? 'transparent' : bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#475569', flexShrink: 0, overflow: 'hidden' }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1f2e', lineHeight: 1.3 }}>{name}</div>
          {primary && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{primary.name}{primary.role ? ` · ${primary.role}` : ''}</div>}
          {(taskCount > 0 || invoiceCount > 0) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {taskCount > 0 && <span onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 99, background: '#faeeda', color: '#854f0b', cursor: 'pointer' }}>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>}
              {invoiceCount > 0 && <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}/invoices`); }} style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 99, background: '#e6f1fb', color: '#185fa5', cursor: 'pointer' }}>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onNavigate(); }} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px',
          color: '#2563eb', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
        }}>Manage →</button>
      </div>

      <div style={{ maxHeight: expanded ? height : 0, overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
        <div ref={contentRef} style={{ borderTop: '1px solid #e5e7eb', padding: '14px 16px 14px 82px' }}>
          {expandData.tasks.length === 0 && expandData.invoices.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>No open tasks or unpaid invoices</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expandData.tasks.map((task) => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: fadingId === task.id ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                }}>
                  <div onClick={(e) => handleCompleteTask(task.id, e)} style={{
                    width: 24, height: 24, borderRadius: 6, background: '#faeeda',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854f0b" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 12 2 2 4-4"/></svg>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: '#1a1f2e' }}>{task.content}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{relTime(task.created_at)}</span>
                </div>
              ))}
              {expandData.invoices.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => router.push(`/clients/${client.id}/invoices`)}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: '#e6f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#185fa5" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: '#1a1f2e' }}>#{inv.id} — {currency((inv.items || []).reduce((s: number, i: any) => s + (i.qty || 1) * (i.price || 0), 0) + (inv.tax || 0) + (inv.shipping || 0))} · <span style={{ color: '#ba7517' }}>Unpaid</span></span>
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{inv.due}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
