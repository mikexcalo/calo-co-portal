'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@/lib/theme';
import QRCode from 'qrcode';
import { exportQRAsPNG, exportQRAsSVG } from '@/lib/qr-export';

interface QRCodeCanvasProps {
  destination: string;
  caption: string;
  useClientLogo: boolean;
  useClientColor: boolean;
  errorCorrection: 'M' | 'Q' | 'H';
  clientLogo?: string;
  clientColor?: string;
  clientName?: string;
}

export default function QRCodeCanvas(props: QRCodeCanvasProps) {
  const { t } = useTheme();
  const [qrDataUrl, setQrDataUrl] = useState('');

  const qrColor = props.useClientColor && props.clientColor ? props.clientColor : '#000000';

  useEffect(() => {
    if (!props.destination) { setQrDataUrl(''); return; }
    QRCode.toDataURL(props.destination, {
      errorCorrectionLevel: props.errorCorrection,
      margin: 2, width: 800,
      color: { dark: qrColor, light: '#FFFFFF' },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [props.destination, props.errorCorrection, qrColor]);

  const contrastWarning = useMemo(() => {
    if (!props.useClientColor || !props.clientColor) return null;
    const hex = props.clientColor.replace('#', '');
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? 'Low contrast — QR may not scan reliably' : null;
  }, [props.useClientColor, props.clientColor]);

  const slug = (props.clientName || 'qr').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const exportOpts = { destination: props.destination, errorCorrection: props.errorCorrection, color: qrColor, filename: `qrcode-${slug}` };

  return (
    <div>
      {/* Preview */}
      <div style={{ background: '#fff', padding: 40, maxWidth: 480, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {props.clientLogo && (
          <img src={props.clientLogo} alt="" style={{ maxWidth: 180, maxHeight: 60, objectFit: 'contain' }} />
        )}
        <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '1/1' }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code" style={{ width: '100%', height: '100%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13, borderRadius: 8 }}>Enter a destination URL</div>
          )}
          {props.useClientLogo && props.clientLogo && qrDataUrl && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '20%', aspectRatio: '1/1', background: '#fff', borderRadius: 6, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>
              <img src={props.clientLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>
        {props.caption && <div style={{ fontSize: 16, color: '#111', fontWeight: 500, textAlign: 'center', maxWidth: 320 }}>{props.caption}</div>}
        {contrastWarning && <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 500 }}>⚠ {contrastWarning}</div>}
      </div>

      {/* Export buttons */}
      {props.destination && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {([512, 1024, 2048] as const).map(size => (
            <button key={size} onClick={() => exportQRAsPNG({ ...exportOpts, size })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, background: t.bg.surface, color: t.text.primary, border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; }}>
              PNG · {size}px
            </button>
          ))}
          <button onClick={() => exportQRAsSVG(exportOpts)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, background: t.bg.surface, color: t.text.primary, border: `1px solid ${t.border.default}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; }}>
            SVG · Scalable
          </button>
        </div>
      )}
      <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 8 }}>Logo overlay shows in preview only. Exports are bare QR for maximum scan reliability.</div>
    </div>
  );
}
