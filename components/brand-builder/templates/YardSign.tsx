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

function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export default function YardSign({ fields }: YardSignProps) {
  const {
    logoUrl, companyName, phone, email, website, qrCodeUrl,
    headline, tagline,
    primaryColor, backgroundColor,
    showCompanyName, showPhone, showEmail, showWebsite,
    showQrCode, showTagline, showHeadline,
  } = fields;

  // Color modes
  const isLightMode = backgroundColor === '#ffffff';
  const isDarkMode = backgroundColor === '#1a1a1a';

  const topBg = isLightMode ? '#ffffff' : isDarkMode ? '#1a1a1a' : (primaryColor || '#28502e');
  const topText = isLightMode ? (primaryColor || '#28502e') : '#ffffff';

  const bottomBg = isLightMode ? (primaryColor || '#28502e') : '#ffffff';
  const bottomNameColor = isLightMode ? '#ffffff' : topBg;
  const bottomDetailColor = isLightMode ? 'rgba(255,255,255,0.7)' : '#6b7280';

  const logoFilter = isLightMode ? 'none' : 'brightness(0) invert(1)';
  const qrFg = isLightMode ? (primaryColor || '#28502e') : (topBg === '#ffffff' ? (primaryColor || '#28502e') : topBg);

  const ratio = RATIOS[fields.signSize] || RATIOS['18x24'];
  const isLandscape = ratio < 1;
  const w = BASE_W;
  const h = Math.round(BASE_W * ratio);
  const qrSize = isLandscape ? 48 : 56;

  return (
    <div
      id="yard-sign-preview"
      style={{
        width: w, height: h, borderRadius: 3,
        border: '7px solid rgba(0,0,0,0.18)',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* BRAND COLOR SECTION — ~75-80% */}
      <div style={{
        flex: 3, background: topBg, color: topText,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        padding: isLandscape ? '16px 24px' : '20px 18px',
        paddingBottom: isLandscape ? 24 : 32,
        textAlign: 'center',
      }}>
        {/* Logo */}
        {logoUrl && (
          <img
            src={logoUrl}
            crossOrigin="anonymous"
            alt="Logo"
            style={{
              maxHeight: isLandscape ? 64 : 80, maxWidth: '50%', objectFit: 'contain',
              marginBottom: isLandscape ? 12 : 16,
              filter: logoFilter,
            }}
          />
        )}

        {/* Headline / CTA */}
        {showHeadline === true && headline && (
          <p style={{
            fontSize: isLandscape ? 18 : 20, fontWeight: 800,
            margin: '0 0 2px', lineHeight: 1.15,
          }}>
            {headline}
          </p>
        )}

        {/* Tagline */}
        {showTagline === true && tagline && (
          <p style={{
            fontSize: isLandscape ? 11 : 13, opacity: 0.85, margin: '2px 0 0',
          }}>
            {tagline}
          </p>
        )}

        {/* Phone — BIGGEST element */}
        {showPhone !== false && phone && (
          <p style={{
            fontSize: isLandscape ? 32 : 40, fontWeight: 800,
            margin: isLandscape ? '10px 0 0' : '14px 0 0',
            letterSpacing: '0.5px', lineHeight: 1, whiteSpace: 'nowrap',
          }}>
            {formatPhone(phone)}
          </p>
        )}
      </div>

      {/* WHITE STRIP — company name + optional detail + QR */}
      <div style={{
        flex: '0 0 auto', background: bottomBg,
        padding: isLandscape ? '12px 18px' : '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {showCompanyName !== false && companyName && (
            <p style={{
              fontSize: isLandscape ? 15 : 16, fontWeight: 800,
              color: bottomNameColor, margin: 0, lineHeight: 1.15,
            }}>
              {companyName}
            </p>
          )}
          {showEmail === true && email && (
            <p style={{ fontSize: 10, color: bottomDetailColor, margin: '2px 0 0' }}>
              {email}
            </p>
          )}
          {!(showEmail === true && email) && showWebsite === true && website && (
            <p style={{ fontSize: 10, color: bottomDetailColor, margin: '2px 0 0' }}>
              {website}
            </p>
          )}
        </div>

        {showQrCode !== false && qrCodeUrl && (
          <div style={{
            flexShrink: 0, background: '#fff', borderRadius: 3,
            padding: 3, border: isLightMode ? 'none' : '1px solid #e5e7eb',
          }}>
            <QRCode url={qrCodeUrl} size={qrSize} color={qrFg} bgColor="#ffffff" />
          </div>
        )}
      </div>
    </div>
  );
}

export { RATIOS as YARD_SIGN_RATIOS };
