'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  url: string;
  size?: number;
  color?: string;
  bgColor?: string;
}

export default function QRCode({ url, size = 150, color = '#000000', bgColor = '#ffffff' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;

    QRCodeLib.toCanvas(canvasRef.current, url || 'https://example.com', {
      width: size,
      margin: 1,
      color: {
        dark: color,
        light: bgColor,
      },
      errorCorrectionLevel: 'M',
    }).catch((err: Error) => {
      console.error('[QRCode] generation error:', err);
    });
  }, [url, size, color, bgColor]);

  if (!url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#f1f5f9',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#94a3b8',
        }}
      >
        No URL
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}
