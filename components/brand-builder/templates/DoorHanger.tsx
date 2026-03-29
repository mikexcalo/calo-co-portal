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
      {/* Die-cut hole indicator */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', border: '2px dashed #cbd5e1',
        margin: '14px auto 10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, color: '#94a3b8',
      }}>
        cut
      </div>

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
