'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface FlyerProps {
  fields: BrandBuilderFields;
}

export default function Flyer({ fields }: FlyerProps) {
  const {
    logoUrl, companyName, phone, email, website, qrCodeUrl, tagline,
    headline, bodyText, address,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
    showAddress,
  } = fields;

  // 8.5" × 11" → 425x550 preview
  const w = 425;
  const h = 550;

  return (
    <div
      style={{
        width: w, height: h, background: backgroundColor || '#ffffff', borderRadius: 4,
        fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div style={{
        background: primaryColor, padding: '20px 24px', color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {logoUrl ? (
          <img
            src={logoUrl} alt="Logo"
            style={{ maxWidth: 120, maxHeight: 44, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700 }}>{companyName || 'Company'}</div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
          {companyName}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: primaryColor, lineHeight: 1.2 }}>
          {headline || 'Your Headline Here'}
        </div>

        {tagline && (
          <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
            {tagline}
          </div>
        )}

        <div style={{
          flex: 1, fontSize: 10, color: '#475569', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', overflow: 'hidden',
        }}>
          {bodyText || 'Add a description of your services, current offers, or key information here. This space is perfect for a brief overview of what you do and why clients should choose you.'}
        </div>

        {qrCodeUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <QRCode url={qrCodeUrl} size={70} color={primaryColor} bgColor={backgroundColor || '#ffffff'} />
          </div>
        )}
      </div>

      {/* Footer contact bar */}
      <div style={{
        background: primaryColor, padding: '14px 24px', color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {phone && <span style={{ fontWeight: 600 }}>{phone}</span>}
          {email && <span>{email}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
          {website && <span>{website}</span>}
          {showAddress && address && <span>{address}</span>}
        </div>
      </div>
    </div>
  );
}
