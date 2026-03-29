'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface VehicleMagnetProps {
  fields: BrandBuilderFields;
}

export default function VehicleMagnet({ fields }: VehicleMagnetProps) {
  const {
    logoUrl, companyName, phone, website, qrCodeUrl, tagline,
    primaryColor, backgroundColor, fontFamily,
  } = fields;

  // 24" × 12" → 480x240 preview
  const w = 480;
  const h = 240;

  const useDarkBg = backgroundColor === '#ffffff' || !backgroundColor;
  const bg = useDarkBg ? primaryColor : backgroundColor;
  const textColor = useDarkBg ? '#ffffff' : primaryColor;

  return (
    <div
      style={{
        width: w, height: h, background: bg, borderRadius: 4,
        fontFamily, color: textColor, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', padding: '0 28px', gap: 24,
      }}
    >
      {/* Left: Logo + Tagline */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {logoUrl && (
          <img
            src={logoUrl} alt="Logo"
            style={{ maxWidth: 140, maxHeight: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        )}
        {!logoUrl && (
          <div style={{ fontSize: 18, fontWeight: 800 }}>{companyName || 'Logo'}</div>
        )}
        {tagline && (
          <div style={{ fontSize: 8, opacity: 0.8, textAlign: 'center', maxWidth: 140 }}>{tagline}</div>
        )}
      </div>

      {/* Center: Company + Phone */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, letterSpacing: '0.02em' }}>
          {companyName || 'Company Name'}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '0.04em' }}>
          {phone || '(555) 000-0000'}
        </div>
        {website && (
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{website}</div>
        )}
      </div>

      {/* Right: QR Code */}
      {qrCodeUrl && (
        <div style={{ flexShrink: 0 }}>
          <QRCode url={qrCodeUrl} size={65} color={textColor} bgColor={bg} />
        </div>
      )}
    </div>
  );
}
