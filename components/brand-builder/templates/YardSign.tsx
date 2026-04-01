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
    logoUrl, companyName, phone, qrCodeUrl, headline,
    primaryColor, fontFamily, showHeadline, showQrCode, showPhone,
  } = fields;

  const ratio = RATIOS[fields.signSize] || RATIOS['18x24'];
  const w = BASE_W;
  const h = Math.round(BASE_W * ratio);

  // Scale fonts relative to smallest dimension
  const scale = Math.min(w, h);

  return (
    <div style={{
      width: w, height: h, background: primaryColor || '#28502e', borderRadius: 4,
      fontFamily, color: '#ffffff', overflow: 'hidden',
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
            filter: 'brightness(0) invert(1)',
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

      {/* Phone — centered, biggest text */}
      {showPhone !== false && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: Math.max(24, Math.round(scale * 0.1)), fontWeight: 900,
            letterSpacing: '0.02em', textAlign: 'center',
          }}>
            {phone || '(555) 000-0000'}
          </div>
        </div>
      )}

      {/* Bottom bar — company name left, QR right */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: `${Math.round(h * 0.04)}px ${Math.round(w * 0.05)}px`,
        gap: 12,
      }}>
        {/* Company name — left, bold, wraps if long */}
        <div style={{
          fontSize: Math.max(14, Math.round(scale * 0.06)), fontWeight: 800,
          lineHeight: 1.15, flex: 1, minWidth: 0,
        }}>
          {companyName || 'Company Name'}
        </div>

        {/* QR code — right */}
        {showQrCode !== false && qrCodeUrl && (
          <div style={{ flexShrink: 0 }}>
            <QRCode url={qrCodeUrl} size={70} color={primaryColor || '#28502e'} bgColor="#ffffff" />
          </div>
        )}
      </div>
    </div>
  );
}

export { RATIOS as YARD_SIGN_RATIOS };
