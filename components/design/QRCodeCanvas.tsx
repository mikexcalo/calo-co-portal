'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';
import QRCode from 'qrcode';
import { exportQRAsPNG, exportQRAsSVG } from '@/lib/qr-export';
import { getClientAvatarUrl } from '@/lib/clientAvatar';

interface QRCodeWorkspaceProps {
  client?: any;
  fields?: any;
}

export default function QRCodeWorkspace({ client, fields }: QRCodeWorkspaceProps) {
  const { t } = useTheme();
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Auto-populate from client data
  useEffect(() => {
    if (!client) return;
    setUrl(client.website || '');
  }, [client?.id]);

  // Also pick up qrCodeUrl from fields if available
  useEffect(() => {
    if (fields?.qrCodeUrl) setUrl(fields.qrCodeUrl);
    else if (fields?.website) setUrl(fields.website);
  }, [fields?.qrCodeUrl, fields?.website]);

  // Generate QR with debounce
  useEffect(() => {
    if (!url) { setQrDataUrl(''); return; }
    const timer = setTimeout(() => {
      QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        margin: 2, width: 800,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }, 200);
    return () => clearTimeout(timer);
  }, [url]);

  const clientName = client?.company || client?.name || 'agency';
  const exportName = `qrcode-${clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  const logoUrl = fields?.logoUrl || getClientAvatarUrl(client) || null;

  return (
    <div style={{ padding: '32px 48px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
      {/* URL input */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Destination URL</label>
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." autoFocus
          style={{ width: '100%', height: 48, padding: '0 16px', fontSize: 15, fontFamily: 'inherit', background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 8, color: t.text.primary, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 150ms' }}
          onFocus={e => e.currentTarget.style.borderColor = t.accent.primary}
          onBlur={e => e.currentTarget.style.borderColor = t.border.default} />
      </div>

      {/* QR preview */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%', maxWidth: 420, aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {qrDataUrl ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img src={qrDataUrl} alt="QR code" style={{ width: '100%', height: '100%', display: 'block' }} />
              {logoUrl && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '22%', aspectRatio: '1/1', background: '#fff', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #fff' }}>
                  <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#9b9b9f', fontSize: 13, textAlign: 'center', padding: 32 }}>Enter a URL to generate a QR code</div>
          )}
        </div>
      </div>

      {/* Trackable toggle (decorative) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'center', opacity: 0.6, cursor: 'not-allowed' }} title="Trackable QR codes with scan analytics — coming soon">
        <input type="checkbox" checked={false} disabled style={{ cursor: 'not-allowed' }} />
        <span style={{ fontSize: 13, color: t.text.secondary }}>Make this trackable</span>
        <span style={{ fontSize: 10, fontWeight: 500, background: t.accent.subtle, color: t.accent.text, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Coming soon</span>
      </div>

      {/* Download buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        {([512, 1024, 2048] as const).map(size => (
          <button key={size} disabled={!url} onClick={() => exportQRAsPNG({ destination: url, errorCorrection: 'H', color: '#000000', size, filename: exportName })}
            style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, color: t.text.primary, cursor: url ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: url ? 1 : 0.5, transition: 'all 150ms' }}>
            PNG · {size}px
          </button>
        ))}
        <button disabled={!url} onClick={() => exportQRAsSVG({ destination: url, errorCorrection: 'H', color: '#000000', filename: exportName })}
          style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, color: t.text.primary, cursor: url ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: url ? 1 : 0.5 }}>
          SVG · scalable
        </button>
      </div>

      <div style={{ fontSize: 12, color: t.text.tertiary, textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        Logo overlay shows in preview only. Exports are bare QR for maximum scan reliability.
      </div>
    </div>
  );
}
