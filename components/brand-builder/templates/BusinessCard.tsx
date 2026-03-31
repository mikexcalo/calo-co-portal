'use client';

import { useState, useEffect } from 'react';
import { BrandBuilderFields } from '../types';
import QRCode from '../QRCode';

interface BusinessCardProps {
  fields: BrandBuilderFields;
  side: 'front' | 'back';
}

export default function BusinessCard({ fields, side }: BusinessCardProps) {
  const {
    logoUrl, companyName, contactName, contactTitle, phone, email, website,
    qrCodeUrl, tagline, primaryColor, secondaryColor, backgroundColor, fontFamily,
    showCompanyName, showContactName, showContactTitle, showPhone, showEmail,
    showWebsite, showQrCode, showTagline,
  } = fields;

  const w = 350, h = 200;

  // Detect logo aspect ratio
  const [logoAspect, setLogoAspect] = useState(1);
  useEffect(() => {
    if (!logoUrl) { setLogoAspect(1); return; }
    const img = new Image();
    img.onload = () => setLogoAspect(img.naturalWidth / img.naturalHeight);
    img.src = logoUrl;
  }, [logoUrl]);

  const isSquare = logoAspect >= 0.7 && logoAspect <= 1.3;
  // isWide = !isSquare (aspect > 1.3)

  // ========== MODE A: Square logo ==========
  if (isSquare) {
    if (side === 'back') {
      // BACK: Full primary bg, large centered logo, company name, tagline
      return (
        <div style={{
          width: w, height: h, background: primaryColor, borderRadius: 4,
          fontFamily, color: '#fff', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
        }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{
              maxWidth: 100, maxHeight: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)',
            }} />
          )}
          {showCompanyName && companyName && (
            <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{companyName}</div>
          )}
          {showTagline && tagline && (
            <div style={{ fontSize: 9, opacity: 0.8, textAlign: 'center', padding: '0 20px' }}>{tagline}</div>
          )}
        </div>
      );
    }

    // FRONT Mode A: Accent bar, logo left + QR right, company name, contact details
    return (
      <div style={{
        width: w, height: h, background: backgroundColor || '#fff', borderRadius: 4,
        fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Accent bar */}
        <div style={{ height: 6, background: primaryColor, flexShrink: 0 }} />

        {/* Logo row: logo left, QR right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 6px' }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain', flexShrink: 0 }} />
          )}
          {showQrCode && qrCodeUrl && (
            <div style={{ flexShrink: 0 }}>
              <QRCode url={qrCodeUrl} size={70} color={primaryColor} bgColor={backgroundColor || '#fff'} />
            </div>
          )}
        </div>

        {/* Text below */}
        <div style={{ padding: '0 20px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {showCompanyName && <div style={{ fontSize: 12, fontWeight: 700, color: primaryColor, marginBottom: 3 }}>{companyName}</div>}
          {showContactName && contactName && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 1 }}>{contactName}</div>}
          {showContactTitle && contactTitle && <div style={{ fontSize: 8, color: '#64748b', marginBottom: 3 }}>{contactTitle}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {showPhone && phone && <div style={{ fontSize: 8, color: '#475569' }}>{phone}</div>}
            {showEmail && email && <div style={{ fontSize: 8, color: '#475569' }}>{email}</div>}
            {showWebsite && website && <div style={{ fontSize: 8, color: primaryColor }}>{website}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ========== MODE B: Wide/horizontal logo ==========
  if (side === 'back') {
    // BACK Mode B: QR left + divider + contact info right
    return (
      <div style={{
        width: w, height: h, background: primaryColor, borderRadius: 4,
        fontFamily, color: '#fff', display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 16, overflow: 'hidden',
      }}>
        {/* QR left */}
        {showQrCode && qrCodeUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <QRCode url={qrCodeUrl} size={120} color="#ffffff" bgColor={primaryColor} />
            <div style={{ fontSize: 7, opacity: 0.7 }}>Scan for website</div>
          </div>
        )}
        {/* Divider */}
        {showQrCode && qrCodeUrl && (
          <div style={{ width: 1, height: 100, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        )}
        {/* Contact info right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          {showContactName && contactName && <div style={{ fontSize: 12, fontWeight: 600 }}>{contactName}</div>}
          {showContactTitle && contactTitle && <div style={{ fontSize: 9, opacity: 0.8 }}>{contactTitle}</div>}
          {showPhone && phone && <div style={{ fontSize: 9, opacity: 0.85, marginTop: 4 }}>{phone}</div>}
          {showEmail && email && <div style={{ fontSize: 9, opacity: 0.85 }}>{email}</div>}
          {showWebsite && website && <div style={{ fontSize: 9, opacity: 0.85 }}>{website}</div>}
        </div>
      </div>
    );
  }

  // FRONT Mode B: Accent bar, logo spanning width, company name — clean, logo-forward
  return (
    <div style={{
      width: w, height: h, background: backgroundColor || '#fff', borderRadius: 4,
      fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: primaryColor }} />

      {logoUrl && (
        <img src={logoUrl} alt="Logo" style={{
          maxWidth: w * 0.7, maxHeight: h * 0.45, objectFit: 'contain', marginBottom: 8,
        }} />
      )}
      {showCompanyName && companyName && (
        <div style={{ fontSize: 13, fontWeight: 700, color: primaryColor, textAlign: 'center' }}>{companyName}</div>
      )}
    </div>
  );
}
