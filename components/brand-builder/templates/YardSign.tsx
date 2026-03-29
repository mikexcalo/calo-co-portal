'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface YardSignProps {
  fields: BrandBuilderFields;
}

export default function YardSign({ fields }: YardSignProps) {
  const {
    logoUrl, companyName, phone, website, qrCodeUrl, tagline,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
  } = fields;

  // 24" × 18" → 480x360 preview
  const w = 480;
  const h = 360;

  return (
    <div
      style={{
        width: w, height: h, background: primaryColor, borderRadius: 4,
        fontFamily, color: '#ffffff', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {logoUrl && (
        <img
          src={logoUrl} alt="Logo"
          style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain', marginBottom: 12, filter: 'brightness(0) invert(1)' }}
        />
      )}

      <div style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: '0.02em', marginBottom: 6 }}>
        {companyName || 'Company Name'}
      </div>

      {tagline && (
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12, textAlign: 'center' }}>
          {tagline}
        </div>
      )}

      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.03em', marginBottom: 6 }}>
        {phone || '(555) 000-0000'}
      </div>

      {website && (
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {website}
        </div>
      )}

      {qrCodeUrl && (
        <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
          <QRCode url={qrCodeUrl} size={60} color="#ffffff" bgColor={primaryColor} />
        </div>
      )}
    </div>
  );
}
