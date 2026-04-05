'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logActivity, saveTaskNote } from '@/lib/database';
import { useTheme } from '@/lib/theme';

interface CommandResponse {
  type: 'query' | 'task' | 'note' | 'clarify';
  answer?: string; client_id?: string | null; client_name?: string;
  content?: string; message?: string;
}

interface CommandBarProps { onItemSaved?: () => void; }

export default function CommandBar({ onItemSaved }: CommandBarProps) {
  const router = useRouter();
  const { t } = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [barHovered, setBarHovered] = useState(false);
  const [toast, setToast] = useState<{ type: string; text: string; clientId: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
      return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
    }
  }, [toast]);

  useEffect(() => {
    if (!response) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setResponse(null); };
    const onClick = (e: MouseEvent) => { if (cardRef.current && !cardRef.current.contains(e.target as Node)) setResponse(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [response]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true); setResponse(null);
    try {
      const resp = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const data: CommandResponse = await resp.json();
      if ((data.type === 'task' || data.type === 'note') && data.client_id && data.content) {
        await saveTaskNote(data.client_id, data.type, data.content);
        await logActivity(data.client_id, data.type === 'task' ? 'task_added' : 'note_added', { content: data.content }).catch(() => {});
        setInput('');
        setToast({ type: data.type, text: data.client_name || 'client', clientId: data.client_id });
        onItemSaved?.();
      } else if (data.type === 'clarify') { setResponse(data); }
      else { setResponse(data); setInput(''); }
    } catch (e) { console.error('[CommandBar]', e); setResponse({ type: 'query', answer: 'Something went wrong.' }); }
    finally { setLoading(false); }
  }, [input, loading, onItemSaved]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}
        onMouseEnter={() => setBarHovered(true)} onMouseLeave={() => setBarHovered(false)}
      >
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: barHovered ? t.accent.primary : t.text.secondary, display: 'flex', pointerEvents: 'none', transition: 'color 150ms' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Ask a question or jot a note..." disabled={loading}
          style={{
            width: '100%', padding: '12px 14px 12px 36px', fontSize: 14,
            border: `1.5px solid ${t.accent.primary}`, borderRadius: t.radius.md,
            fontFamily: 'inherit', color: t.text.primary, background: t.bg.surface, outline: 'none',
            boxShadow: barHovered ? `0 0 20px rgba(14,165,233,0.15)` : 'none',
            transition: 'box-shadow 200ms, background 150ms',
          }} />
        {loading && (
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, border: `2px solid ${t.border.default}`, borderTopColor: t.accent.primary,
            borderRadius: '50%' }} className="animate-spin" />
        )}
      </div>
      {response && (
        <div ref={cardRef} style={{ marginTop: 8, padding: '12px 16px', background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, fontSize: 13, color: t.text.primary, lineHeight: 1.5, boxShadow: t.shadow.card }}>
          {response.type === 'clarify' ? <div>{response.message}</div> : (<><div>{response.answer}</div>{response.client_id && <button onClick={() => router.push(`/clients/${response.client_id}`)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: t.accent.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Open →</button>}</>)}
        </div>
      )}
      {toast && (
        <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: t.radius.md, background: t.accent.subtle, border: `1px solid ${t.border.default}`, fontSize: 12, color: t.status.success, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓ {toast.type === 'task' ? 'Task' : 'Note'} saved to <strong>{toast.text}</strong></span>
          <button onClick={() => router.push(`/clients/${toast.clientId}`)} style={{ background: 'none', border: 'none', color: t.accent.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Open →</button>
        </div>
      )}
    </div>
  );
}
