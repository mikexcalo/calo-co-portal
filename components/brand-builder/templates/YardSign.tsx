'use client';

import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface YardSignProps {
  fields: BrandBuilderFields;
}

// Fixed preview width, height calculated from aspect ratio
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

  // Colorway: use backgroundColor if set (from color dots), otherwise primaryColor
  const isLightMode = backgroundColor === '#ffffff';
  const isDarkMode = backgroundColor === '#1a1a1a';
  const signBg = isDarkMode ? '#1a1a1a' : isLightMode ? '#ffffff' : (primaryColor || '#28502e');
  const signText = isLightMode ? (primaryColor || '#28502e') : '#ffffff';
  const subtleText = isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)';
  const qrFg = isLightMode ? (primaryColor || '#28502e') : (primaryColor || '#28502e');
  const qrBg = '#ffffff';
  const logoFilter = isLightMode ? 'none' : 'brightness(0) invert(1)';

  const ratio = RATIOS[fields.signSize] || RATIOS['18x24'];
  const w = BASE_W;
  const h = Math.round(BASE_W * ratio);

  // Scale fonts relative to smallest dimension
  const scale = Math.min(w, h);

  return (
    <div style={{
      width: w, height: h, background: signBg, borderRadius: 4,
      border: '4px solid rgba(0,0,0,0.3)',
      fontFamily, color: signText,
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Logo — centered, top section */}
      {logoUrl && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: `${Math.round(h * 0.06)}px ${Math.round(w * 0.08)}px`,
          flex: '0 0 auto',
        }}>
          <img src={logoUrl} alt="Logo" style={{
            maxHeight: 120, maxWidth: w * 0.7, objectFit: 'contain',
            filter: logoFilter,
          }} />
        </div>
      )}

      {/* Headline — centered */}
      {showHeadline !== false && headline && (
        <div style={{
          textAlign: 'center', padding: '0 20px',
          fontSize: Math.max(16, Math.round(scale * 0.055)), fontWeight: 700,
          lineHeight: 1.2,
        }}>
          {headline}
        </div>
      )}

      {/* Tagline — centered, between headline and phone */}
      {showTagline !== false && tagline && (
        <div style={{
          textAlign: 'center', padding: '4px 20px 0',
          fontSize: Math.max(12, Math.round(scale * 0.04)), fontWeight: 400,
          color: subtleText, lineHeight: 1.3,
        }}>
          {tagline}
        </div>
      )}

      {/* Phone — centered, biggest text */}
      {showPhone !== false && phone && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: Math.max(28, Math.round(scale * 0.12)), fontWeight: 900,
            letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap',
          }}>
            {phone}
          </div>
        </div>
      )}

      {/* Spacer if phone is hidden */}
      {(showPhone === false || !phone) && <div style={{ flex: 1 }} />}

      {/* Bottom bar — info left, QR right */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, right: 16,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 12,
      }}>
        {/* Left: company name + contact details */}
        <div style={{ maxWidth: '65%', minWidth: 0 }}>
          {showCompanyName !== false && companyName && (
            <div style={{
              fontSize: Math.max(14, Math.round(scale * 0.06)), fontWeight: 800,
              lineHeight: 1.15,
            }}>
              {companyName}
            </div>
          )}
          {showContactName !== false && contactName && (
            <div style={{ fontSize: Math.max(10, Math.round(scale * 0.032)), color: subtleText, marginTop: 2 }}>
              {contactName}
            </div>
          )}
          {showEmail !== false && email && (
            <div style={{ fontSize: Math.max(9, Math.round(scale * 0.028)), color: subtleText, marginTop: 1 }}>
              {email}
            </div>
          )}
          {showWebsite !== false && website && (
            <div style={{ fontSize: Math.max(9, Math.round(scale * 0.028)), color: subtleText, marginTop: 1 }}>
              {website}
            </div>
          )}
          {showAddress !== false && address && (
            <div style={{ fontSize: Math.max(9, Math.round(scale * 0.028)), color: subtleText, marginTop: 1 }}>
              {address}
            </div>
          )}
          {showLicense !== false && licenseNumber && (
            <div style={{ fontSize: Math.max(8, Math.round(scale * 0.024)), color: subtleText, marginTop: 1 }}>
              {licenseNumber}
            </div>
          )}
        </div>

        {/* Right: QR code */}
        {showQrCode !== false && qrCodeUrl && (
          <div style={{ flexShrink: 0 }}>
            <QRCode url={qrCodeUrl} size={Math.min(70, Math.max(48, Math.round(h * 0.15)))} color={qrFg} bgColor={qrBg} />
          </div>
        )}
      </div>
    </div>
  );
}

export { RATIOS as YARD_SIGN_RATIOS };
