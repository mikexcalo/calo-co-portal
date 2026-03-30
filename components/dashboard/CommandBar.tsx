'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logActivity, saveTaskNote } from '@/lib/database';

interface CommandResponse {
  type: 'query' | 'task' | 'note' | 'clarify';
  answer?: string;
  client_id?: string | null;
  client_name?: string;
  content?: string;
  message?: string;
}

interface CommandBarProps {
  onItemSaved?: () => void;
}

export default function CommandBar({ onItemSaved }: CommandBarProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [toast, setToast] = useState<{ type: string; text: string; clientId: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3500);
      return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
    }
  }, [toast]);

  useEffect(() => {
    if (!response) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setResponse(null); };
    const onClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setResponse(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [response]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const apiKey = localStorage.getItem('CLAUDE_API_KEY');
    if (!apiKey) {
      setResponse({ type: 'query', answer: 'Configure your Claude API key in Settings to use the AI bar.' });
      return;
    }

    setLoading(true);
    setResponse(null);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, apiKey }),
      });
      const data: CommandResponse = await resp.json();

      if ((data.type === 'task' || data.type === 'note') && data.client_id && data.content) {
        await saveTaskNote(data.client_id, data.type, data.content);
        await logActivity(data.client_id, data.type === 'task' ? 'task_added' : 'note_added', { content: data.content });
        setInput('');
        setToast({ type: data.type, text: data.client_name || 'client', clientId: data.client_id });
        onItemSaved?.();
      } else if (data.type === 'clarify') {
        setResponse(data);
      } else {
        setResponse(data);
        setInput('');
      }
    } catch (e) {
      console.error('[CommandBar] error:', e);
      setResponse({ type: 'query', answer: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [input, loading, onItemSaved]);

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      {/* Dark container + white inset input */}
      <div style={{ background: '#1a1f2e', borderRadius: 12, padding: 6 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#94a3b8', display: 'flex', pointerEvents: 'none',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Ask a question or jot a note..." disabled={loading}
            style={{
              width: '100%', padding: '10px 40px 10px 34px', fontSize: 14,
              border: 'none', borderRadius: 8, fontFamily: 'Inter, sans-serif',
              color: '#1a1f2e', background: '#fff', outline: 'none',
            }} />
          {loading && (
            <div style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#2563eb',
              borderRadius: '50%', animation: 'cmd-spin 0.6s linear infinite',
            }} />
          )}
        </div>
      </div>

      {response && (
        <div ref={cardRef} style={{
          marginTop: 8, padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 10, fontSize: 13, color: '#334155', lineHeight: 1.5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {response.type === 'clarify' ? <div>{response.message}</div> : (
            <>
              <div>{response.answer}</div>
              {response.client_id && (
                <button onClick={() => router.push(`/clients/${response.client_id}`)} style={{
                  marginTop: 8, background: 'none', border: 'none', padding: 0,
                  color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>Open →</button>
              )}
            </>
          )}
        </div>
      )}

      {toast && (
        <div style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>✓ {toast.type === 'task' ? 'Task' : 'Note'} saved to <strong>{toast.text}</strong></span>
          <button onClick={() => router.push(`/clients/${toast.clientId}`)} style={{
            background: 'none', border: 'none', color: '#2563eb', fontSize: 11,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Open →</button>
        </div>
      )}

      <style>{`@keyframes cmd-spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
