'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface YardSignProps {
  fields: BrandBuilderFields;
}

const BASE_W = 360;
const RATIOS: Record<string, number> = {
  '18x24': 24 / 18,   // 1.333 — portrait
  '24x18': 18 / 24,   // 0.75  — landscape
  '12x18': 18 / 12,   // 1.5   — tall portrait
  '24x36': 36 / 24,   // 1.5   — tall portrait
  '36x24': 24 / 36,   // 0.667 — wide landscape
};

export default function YardSign({ fields }: YardSignProps) {
  const {
    logoUrl, companyName, contactName, phone, email, website, qrCodeUrl,
    headline, tagline, address, licenseNumber,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
    showCompanyName, showContactName, showPhone, showEmail, showWebsite,
    showQrCode, showTagline, showHeadline, showAddress, showLicense,
  } = fields;

  // Colorway
  const isLightMode = backgroundColor === '#ffffff';
  const isDarkMode = backgroundColor === '#1a1a1a';
  const signBg = isDarkMode ? '#1a1a1a' : isLightMode ? '#ffffff' : (primaryColor || '#28502e');
  const signText = isLightMode ? (primaryColor || '#28502e') : '#ffffff';
  const qrFg = signBg === '#ffffff' ? (primaryColor || '#28502e') : signBg;
  const logoFilter = isLightMode ? 'none' : 'brightness(0) invert(1)';

  const ratio = RATIOS[fields.signSize] || RATIOS['18x24'];
  const isLandscape = ratio < 1;
  const w = BASE_W;
  const h = Math.round(BASE_W * ratio);

  const qrSize = isLandscape ? 48 : 56;

  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      border: '6px solid rgba(0,0,0,0.25)',
      fontFamily, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TOP SECTION — brand color, ~65% height */}
      <div style={{
        flex: 2, background: signBg, color: signText,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isLandscape ? '16px 24px' : '20px 20px',
        textAlign: 'center', gap: isLandscape ? 6 : 10,
      }}>
        {/* Logo */}
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{
            maxHeight: isLandscape ? 50 : 70, maxWidth: '40%', objectFit: 'contain',
            filter: logoFilter,
          }} />
        )}

        {/* Headline */}
        {showHeadline !== false && headline && (
          <p style={{
            fontSize: isLandscape ? 18 : 22, fontWeight: 700,
            margin: 0, lineHeight: 1.2,
          }}>
            {headline}
          </p>
        )}

        {/* Tagline */}
        {showTagline !== false && tagline && (
          <p style={{
            fontSize: isLandscape ? 11 : 13, opacity: 0.85, margin: 0,
          }}>
            {tagline}
          </p>
        )}

        {/* Phone — largest text */}
        {showPhone !== false && phone && (
          <p style={{
            fontSize: isLandscape ? 28 : 36, fontWeight: 700,
            margin: isLandscape ? '4px 0 0' : '8px 0 0',
            whiteSpace: 'nowrap', letterSpacing: '0.5px',
          }}>
            {phone}
          </p>
        )}
      </div>

      {/* BOTTOM SECTION — white, ~35% height */}
      <div style={{
        flex: 1, background: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isLandscape ? '10px 20px' : '12px 16px',
      }}>
        {/* Left: company name + contact details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {showCompanyName !== false && companyName && (
            <p style={{
              fontSize: isLandscape ? 13 : 15, fontWeight: 700,
              color: signBg, margin: '0 0 2px', lineHeight: 1.2,
            }}>
              {companyName}
            </p>
          )}
          {showContactName !== false && contactName && (
            <p style={{ fontSize: 9, color: '#374151', margin: '1px 0 0' }}>{contactName}</p>
          )}
          {showEmail !== false && email && (
            <p style={{ fontSize: 8, color: '#6b7280', margin: '1px 0 0' }}>{email}</p>
          )}
          {showWebsite !== false && website && (
            <p style={{ fontSize: 8, color: '#6b7280', margin: '1px 0 0' }}>{website}</p>
          )}
          {showAddress !== false && address && (
            <p style={{ fontSize: 8, color: '#6b7280', margin: '1px 0 0' }}>{address}</p>
          )}
          {showLicense !== false && licenseNumber && (
            <p style={{ fontSize: 7, color: '#9ca3af', margin: '1px 0 0' }}>{licenseNumber}</p>
          )}
        </div>

        {/* Right: QR code */}
        {showQrCode !== false && qrCodeUrl && (
          <div style={{ flexShrink: 0, marginLeft: 12 }}>
            <QRCode url={qrCodeUrl} size={qrSize} color={qrFg} bgColor="#ffffff" />
          </div>
        )}
      </div>
    </div>
  );
}

export { RATIOS as YARD_SIGN_RATIOS };
