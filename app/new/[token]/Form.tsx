'use client';

import { useState } from 'react';

const INK = '#14161A';
const MUTED = '#69727D';

export function Form({ token, business }: { token: string; business: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, email, phone, detail }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.ok) setSent(true);
    else setError(data.error ?? 'That did not go through. Try again, or call us.');
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '13px 14px', fontSize: 16, border: '1px solid #DDE0E4',
    borderRadius: 9, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12,
  };

  return (
    <main style={{ minHeight: '100vh', background: '#fff', padding: '10vh 20px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        {sent ? (
          <>
            <h1 style={{ fontSize: 26, color: INK, margin: '0 0 10px', fontWeight: 600 }}>Thanks, got it</h1>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.65, margin: 0 }}>
              {business} will be in touch. If it is urgent, calling is faster.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 26, color: INK, margin: '0 0 8px', fontWeight: 600 }}>
              Get in touch with {business}
            </h1>
            <p style={{ fontSize: 15.5, color: MUTED, lineHeight: 1.6, margin: '0 0 22px' }}>
              Leave a name and a number and somebody will call you back. The rest is optional.
            </p>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={input} autoFocus />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" style={input} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" inputMode="email" style={input} />
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What do you need? Rough is fine."
              rows={4}
              style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
            />

            <button
              onClick={submit}
              disabled={busy || !name.trim()}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
                background: name.trim() ? INK : '#C9CDD3', color: '#fff', border: 'none',
                borderRadius: 999, cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>

            {error && <p style={{ fontSize: 14, color: '#A4331F', marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
