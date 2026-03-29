'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface DoorHangerProps {
  fields: BrandBuilderFields;
}

export default function DoorHanger({ fields }: DoorHangerProps) {
  const {
    logoUrl, companyName, phone, email, website, qrCodeUrl, tagline, headline,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
  } = fields;

  // 4.25" × 11" → 212x550 preview
  const w = 212;
  const h = 550;

  return (
    <div
      style={{
        width: w, height: h, background: backgroundColor || '#ffffff', borderRadius: 4,
        fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Die-cut hole */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#ffffff',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
        margin: '12px auto 8px', flexShrink: 0,
        border: '2px dashed #d1d5db',
      }} />

      {/* Header bar */}
      <div style={{
        background: primaryColor, padding: '16px 14px', color: '#ffffff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        {logoUrl ? (
          <img
            src={logoUrl} alt="Logo"
            style={{ maxWidth: 100, maxHeight: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700 }}>{companyName || 'Company'}</div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: primaryColor, lineHeight: 1.3 }}>
          {headline || 'We just finished a project in your neighborhood!'}
        </div>

        {tagline && (
          <div style={{ fontSize: 9, textAlign: 'center', color: '#64748b', lineHeight: 1.4 }}>
            {tagline}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Contact block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryColor }}>
            {companyName || 'Company Name'}
          </div>
          {phone && <div style={{ fontSize: 14, fontWeight: 800 }}>{phone}</div>}
          {email && <div style={{ fontSize: 8, color: '#64748b' }}>{email}</div>}
          {website && <div style={{ fontSize: 8, color: primaryColor }}>{website}</div>}
        </div>

        {qrCodeUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
            <QRCode url={qrCodeUrl} size={55} color={primaryColor} bgColor={backgroundColor || '#ffffff'} />
          </div>
        )}
      </div>
    </div>
  );
}
