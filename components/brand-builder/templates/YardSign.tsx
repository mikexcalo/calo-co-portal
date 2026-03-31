'use client';

import { useState, useEffect } from 'react';
import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface YardSignProps {
  fields: BrandBuilderFields;
}

const SIZES: Record<string, { wIn: number; hIn: number; pw: number; ph: number }> = {
  '18x24': { wIn: 18, hIn: 24, pw: 360, ph: 480 },
  '24x18': { wIn: 24, hIn: 18, pw: 480, ph: 360 },
  '12x18': { wIn: 12, hIn: 18, pw: 300, ph: 450 },
  '24x36': { wIn: 24, hIn: 36, pw: 400, ph: 600 },
  '36x24': { wIn: 36, hIn: 24, pw: 600, ph: 400 },
};

export default function YardSign({ fields }: YardSignProps) {
  const {
    logoUrl, companyName, phone, website, qrCodeUrl, headline,
    primaryColor, fontFamily, showHeadline, showQrCode, showPhone, showWebsite,
  } = fields;

  const size = SIZES[fields.signSize] || SIZES['18x24'];
  const w = size.pw;
  const h = size.ph;

  // Detect logo aspect ratio
  const [logoAspect, setLogoAspect] = useState(1);
  useEffect(() => {
    if (!logoUrl) return;
    const img = new Image();
    img.onload = () => setLogoAspect(img.naturalWidth / img.naturalHeight);
    img.src = logoUrl;
  }, [logoUrl]);

  const isWide = logoAspect > 1.2;
  const qrSize = Math.round(w * 0.15);

  return (
    <div style={{
      width: w, height: h, background: primaryColor, borderRadius: 4,
      fontFamily, color: '#ffffff', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', padding: 0,
    }}>
      {/* Top ~40%: Logo */}
      <div style={{
        flex: '0 0 40%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 24px 8px',
      }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{
            maxWidth: isWide ? w * 0.75 : w * 0.3,
            maxHeight: h * 0.3,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
          }} />
        )}
      </div>

      {/* Middle: Headline */}
      {showHeadline && headline && (
        <div style={{
          textAlign: 'center', padding: '0 20px',
          fontSize: Math.round(w * 0.045), fontWeight: 700, opacity: 0.95,
          lineHeight: 1.2,
        }}>
          {headline}
        </div>
      )}

      {/* Bottom: Phone (largest) + Website */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4, padding: '8px 20px 20px',
      }}>
        {showPhone !== false && (
          <div style={{
            fontSize: Math.round(w * 0.09), fontWeight: 900,
            letterSpacing: '0.03em', textAlign: 'center',
          }}>
            {phone || '(555) 000-0000'}
          </div>
        )}
        {showWebsite !== false && website && (
          <div style={{ fontSize: Math.round(w * 0.035), opacity: 0.85, textAlign: 'center' }}>
            {website}
          </div>
        )}
      </div>

      {/* QR Code — bottom-right corner */}
      {showQrCode !== false && qrCodeUrl && (
        <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
          <QRCode url={qrCodeUrl} size={qrSize} color="#ffffff" bgColor={primaryColor} />
        </div>
      )}
    </div>
  );
}

export { SIZES as YARD_SIGN_SIZES };
