'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DB, logActivity, saveClientNote } from '@/lib/database';

interface CommandResponse {
  type: 'query' | 'note' | 'clarify';
  answer?: string;
  client_id?: string | null;
  client_name?: string;
  content?: string;
  message?: string;
}

export default function CommandBar() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [toast, setToast] = useState<{ text: string; clientId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Close response on Escape or click outside
  useEffect(() => {
    if (!response) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setResponse(null); };
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setResponse(null);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [response]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const apiKey = localStorage.getItem('claudeApiKey');
    if (!apiKey) {
      setResponse({ type: 'query', answer: 'Configure your Claude API key in Settings to use the command bar.' });
      return;
    }

    setLoading(true);
    setResponse(null);
    setToast(null);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, apiKey }),
      });

      if (!resp.ok) {
        setResponse({ type: 'query', answer: 'Failed to get a response. Check your API key.' });
        return;
      }

      const data: CommandResponse = await resp.json();

      if (data.type === 'note' && data.client_id && data.content) {
        // Save note to Supabase
        await saveClientNote(data.client_id, data.content);

        // Log activity
        await logActivity(data.client_id, 'note_added', { content: data.content });

        // Also save to localStorage for ClientUpdates component
        try {
          const key = `client_updates_${data.client_id}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift({
            id: Date.now().toString(),
            message: data.content,
            timestamp: new Date().toISOString(),
            from: 'CALO&CO',
          });
          localStorage.setItem(key, JSON.stringify(existing));
        } catch {}

        setToast({ text: data.client_name || 'client', clientId: data.client_id });
        setInput('');
      } else if (data.type === 'clarify') {
        setResponse(data);
        // Keep input focused for follow-up
      } else {
        // Query response
        setResponse(data);
        setInput('');
      }
    } catch (e) {
      console.error('[CommandBar] error:', e);
      setResponse({ type: 'query', answer: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      {/* Input bar */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Ask a question or jot a note..."
          disabled={loading}
          style={{
            width: '100%', padding: '11px 40px 11px 14px', fontSize: 14,
            border: '1px solid #e2e8f0', borderRadius: 10,
            fontFamily: 'Inter, sans-serif', color: '#1a1f2e',
            background: '#fff', outline: 'none',
            boxShadow: 'none',
            transition: 'box-shadow 0.15s, border-color 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {/* Loading spinner */}
        {loading && (
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#2563eb',
            borderRadius: '50%', animation: 'spin 0.6s linear infinite',
          }} />
        )}
      </div>

      {/* Response card */}
      {response && (
        <div ref={cardRef} style={{
          marginTop: 8, padding: '12px 16px',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          fontSize: 13, color: '#334155', lineHeight: 1.5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {response.type === 'clarify' ? (
            <div>{response.message}</div>
          ) : (
            <>
              <div>{response.answer}</div>
              {response.client_id && (
                <button
                  onClick={() => router.push(`/clients/${response.client_id}`)}
                  style={{
                    marginTop: 8, background: 'none', border: 'none', padding: 0,
                    color: '#2563eb', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Open →
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Toast for saved notes */}
      {toast && (
        <div style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn 0.2s ease',
        }}>
          <span>✓ Saved to <strong>{toast.text}</strong></span>
          <button
            onClick={() => router.push(`/clients/${toast.clientId}`)}
            style={{
              background: 'none', border: 'none', color: '#2563eb', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Open →
          </button>
        </div>
      )}

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
