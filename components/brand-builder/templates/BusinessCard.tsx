'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface BusinessCardProps {
  fields: BrandBuilderFields;
  side: 'front' | 'back';
}

export default function BusinessCard({ fields, side }: BusinessCardProps) {
  const {
    logoUrl, companyName, contactName, contactTitle, phone, email, website,
    qrCodeUrl, tagline, primaryColor, secondaryColor, backgroundColor, fontFamily,
  } = fields;

  // Preview at ~3x scale for readability (3.5" x 2" → 350x200px)
  const w = 350;
  const h = 200;

  if (side === 'back') {
    return (
      <div
        style={{
          width: w, height: h, background: primaryColor, borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily, color: '#ffffff', position: 'relative', overflow: 'hidden',
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl} alt="Logo"
            style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain', marginBottom: 10, filter: 'brightness(0) invert(1)' }}
          />
        )}
        {tagline && (
          <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 8, textAlign: 'center', padding: '0 20px' }}>
            {tagline}
          </div>
        )}
        {qrCodeUrl && (
          <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
            <QRCode url={qrCodeUrl} size={50} color="#ffffff" bgColor={primaryColor} />
          </div>
        )}
      </div>
    );
  }

  // Front
  return (
    <div
      style={{
        width: w, height: h, background: backgroundColor, borderRadius: 4,
        fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 20px 18px',
      }}
    >
      {/* Brand color accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: primaryColor }} />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ maxWidth: 60, maxHeight: 30, objectFit: 'contain' }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: primaryColor }}>
            {companyName || 'Company Name'}
          </div>
        </div>
      </div>

      <div>
        {contactName && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{contactName}</div>}
        {contactTitle && <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>{contactTitle}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {phone && <div style={{ fontSize: 8.5, color: '#475569' }}>{phone}</div>}
          {email && <div style={{ fontSize: 8.5, color: '#475569' }}>{email}</div>}
          {website && <div style={{ fontSize: 8.5, color: primaryColor }}>{website}</div>}
        </div>
      </div>
    </div>
  );
}
