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
  const subtleText = isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)';
  const qrFg = isLightMode ? (primaryColor || '#28502e') : (primaryColor || '#28502e');
  const qrBg = '#ffffff';
  const logoFilter = isLightMode ? 'none' : 'brightness(0) invert(1)';

  const ratio = RATIOS[fields.signSize] || RATIOS['18x24'];
  const isLandscape = ratio < 1;
  const w = BASE_W;
  const h = Math.round(BASE_W * ratio);
  const scale = Math.min(w, h);

  const qrSize = Math.min(isLandscape ? 52 : 60, Math.max(40, Math.round(h * 0.14)));

  return (
    <div style={{
      width: w, height: h, background: signBg, borderRadius: 4,
      border: '6px solid rgba(0,0,0,0.25)',
      fontFamily, color: signText,
      display: 'flex', flexDirection: 'column',
      padding: isLandscape ? '16px 20px' : '20px 16px',
      overflow: 'hidden',
    }}>
      {/* Logo — centered */}
      {logoUrl && (
        <div style={{
          display: 'flex', justifyContent: 'center', flexShrink: 0,
          marginBottom: isLandscape ? 6 : 12,
        }}>
          <img src={logoUrl} alt="Logo" style={{
            maxHeight: isLandscape ? 60 : 90, maxWidth: '50%', objectFit: 'contain',
            filter: logoFilter,
          }} />
        </div>
      )}

      {/* Headline + Phone: side by side in landscape, stacked in portrait */}
      <div style={{
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: isLandscape ? 'space-between' : 'center',
        width: '100%',
        gap: isLandscape ? 12 : 4,
        textAlign: 'center',
      }}>
        <div>
          {showHeadline !== false && headline && (
            <div style={{
              fontSize: isLandscape ? Math.max(14, Math.round(scale * 0.05)) : Math.max(16, Math.round(scale * 0.055)),
              fontWeight: 700, lineHeight: 1.2,
            }}>
              {headline}
            </div>
          )}
          {showTagline !== false && tagline && (
            <div style={{
              fontSize: isLandscape ? Math.max(10, Math.round(scale * 0.035)) : Math.max(12, Math.round(scale * 0.04)),
              fontWeight: 400, color: subtleText, lineHeight: 1.3,
              marginTop: 2,
            }}>
              {tagline}
            </div>
          )}
        </div>

        {showPhone !== false && phone && (
          <div style={{
            fontSize: isLandscape ? Math.max(22, Math.round(scale * 0.09)) : Math.max(28, Math.round(scale * 0.12)),
            fontWeight: 900, letterSpacing: '0.02em', whiteSpace: 'nowrap',
            margin: isLandscape ? 0 : '8px 0',
          }}>
            {phone}
          </div>
        )}
      </div>

      {/* Spacer — pushes bottom section down */}
      <div style={{ flex: 1 }} />

      {/* Bottom: company name + details left, QR right */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        width: '100%', gap: 10, flexShrink: 0,
      }}>
        <div style={{ maxWidth: '65%', minWidth: 0 }}>
          {showCompanyName !== false && companyName && (
            <div style={{
              fontSize: isLandscape ? Math.max(12, Math.round(scale * 0.05)) : Math.max(14, Math.round(scale * 0.06)),
              fontWeight: 800, lineHeight: 1.15,
            }}>
              {companyName}
            </div>
          )}
          {showContactName !== false && contactName && (
            <div style={{ fontSize: Math.max(9, Math.round(scale * 0.03)), color: subtleText, marginTop: 2 }}>
              {contactName}
            </div>
          )}
          {showEmail !== false && email && (
            <div style={{ fontSize: Math.max(8, Math.round(scale * 0.026)), color: subtleText, marginTop: 1 }}>
              {email}
            </div>
          )}
          {showWebsite !== false && website && (
            <div style={{ fontSize: Math.max(8, Math.round(scale * 0.026)), color: subtleText, marginTop: 1 }}>
              {website}
            </div>
          )}
          {showAddress !== false && address && (
            <div style={{ fontSize: Math.max(8, Math.round(scale * 0.026)), color: subtleText, marginTop: 1 }}>
              {address}
            </div>
          )}
          {showLicense !== false && licenseNumber && (
            <div style={{ fontSize: Math.max(7, Math.round(scale * 0.022)), color: subtleText, marginTop: 1 }}>
              {licenseNumber}
            </div>
          )}
        </div>

        {showQrCode !== false && qrCodeUrl && (
          <div style={{ flexShrink: 0 }}>
            <QRCode url={qrCodeUrl} size={qrSize} color={qrFg} bgColor={qrBg} />
          </div>
        )}
      </div>
    </div>
  );
}

export { RATIOS as YARD_SIGN_RATIOS };
