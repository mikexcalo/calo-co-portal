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
    logoUrl, companyName, phone, qrCodeUrl, headline, tagline,
    primaryColor, secondaryColor, backgroundColor, fontFamily,
    showHeadline, showQrCode, showPhone, showTagline,
  } = fields;

  // Colorway: use backgroundColor if set (from color dots), otherwise primaryColor
  const isLightMode = backgroundColor === '#ffffff';
  const isDarkMode = backgroundColor === '#1a1a1a';
  const signBg = isDarkMode ? '#1a1a1a' : isLightMode ? '#ffffff' : (primaryColor || '#28502e');
  const signText = isLightMode ? (primaryColor || '#28502e') : '#ffffff';
  const qrFg = isLightMode ? (primaryColor || '#28502e') : (primaryColor || '#28502e');
  const qrBg = isLightMode ? '#ffffff' : '#ffffff';
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
          color: 'rgba(255,255,255,0.85)', lineHeight: 1.3,
        }}>
          {tagline}
        </div>
      )}

      {/* Phone — centered, biggest text */}
      {showPhone !== false && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: Math.max(28, Math.round(scale * 0.12)), fontWeight: 900,
            letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap',
          }}>
            {phone || '(555) 000-0000'}
          </div>
        </div>
      )}

      {/* Bottom bar — company name left, QR right */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '14px 18px',
        gap: 12, flexShrink: 0,
      }}>
        {/* Company name — left, bold, wraps if long */}
        <div style={{
          fontSize: Math.max(14, Math.round(scale * 0.06)), fontWeight: 800,
          lineHeight: 1.15, flex: 1, minWidth: 0,
        }}>
          {companyName || 'Company Name'}
        </div>

        {/* QR code — right, scales with sign height */}
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
