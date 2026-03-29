'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface TShirtProps {
  fields: BrandBuilderFields;
  side: 'front' | 'back';
}

export default function TShirt({ fields, side }: TShirtProps) {
  const {
    logoUrl, companyName, phone, website, qrCodeUrl, tagline,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
  } = fields;

  if (side === 'front') {
    // Front: 12" × 12" → 300x300 preview
    return (
      <div
        style={{
          width: 300, height: 300, background: backgroundColor || '#ffffff', borderRadius: 4,
          fontFamily, color: primaryColor, position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl} alt="Logo"
            style={{ maxWidth: 180, maxHeight: 120, objectFit: 'contain', marginBottom: 14 }}
          />
        ) : (
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 14 }}>
            {companyName || 'Logo'}
          </div>
        )}
        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          {companyName || 'Company Name'}
        </div>
      </div>
    );
  }

  // Back: 14" × 17" → 350x425 preview
  return (
    <div
      style={{
        width: 350, height: 425, background: backgroundColor || '#ffffff', borderRadius: 4,
        fontFamily, color: primaryColor, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 28,
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl} alt="Logo"
          style={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain', marginBottom: 16 }}
        />
      ) : (
        <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
          {companyName || 'Logo'}
        </div>
      )}

      <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
        {companyName || 'Company Name'}
      </div>

      {tagline && (
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', marginBottom: 14 }}>
          {tagline}
        </div>
      )}

      <div style={{
        fontSize: 24, fontWeight: 900, textAlign: 'center', marginBottom: 8,
        background: primaryColor, color: '#ffffff', padding: '6px 18px', borderRadius: 6,
      }}>
        {phone || '(555) 000-0000'}
      </div>

      {website && (
        <div style={{ fontSize: 13, marginBottom: 8, opacity: 0.8 }}>{website}</div>
      )}

      {qrCodeUrl && (
        <div style={{ marginTop: 10 }}>
          <QRCode url={qrCodeUrl} size={70} color={primaryColor} bgColor={backgroundColor || '#ffffff'} />
        </div>
      )}
    </div>
  );
}
