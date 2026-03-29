'use client';

import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';

interface QRCodeProps {
  url: string;
  size?: number;
  color?: string;
  bgColor?: string;
}

export default function QRCode({ url, size = 150, color = '#000000', bgColor = '#ffffff' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!url) { setDataUrl(''); return; }

    toDataURL(url, {
      width: size * 2,
      margin: 1,
      color: { dark: color, light: bgColor },
      errorCorrectionLevel: 'M',
    })
      .then((result) => setDataUrl(result))
      .catch((err) => console.error('[QRCode] generation error:', err));
  }, [url, size, color, bgColor]);

  if (!url) {
    return (
      <div style={{
        width: size, height: size, background: '#f1f5f9', borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#94a3b8',
      }}>
        No URL
      </div>
    );
  }

  if (!dataUrl) return <div style={{ width: size, height: size }} />;

  return <img src={dataUrl} alt="QR Code" style={{ width: size, height: size, display: 'block' }} />;
}
