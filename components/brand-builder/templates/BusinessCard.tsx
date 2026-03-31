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

  // Detect logo aspect ratio (#5)
  const [logoAspect, setLogoAspect] = useState(1);
  useEffect(() => {
    if (!logoUrl) return;
    const img = new Image();
    img.onload = () => setLogoAspect(img.naturalWidth / img.naturalHeight);
    img.src = logoUrl;
  }, [logoUrl]);

  const isWide = logoAspect > 1.2;

  if (side === 'back') {
    // Back: logo left + divider + QR right with "Scan for website"
    return (
      <div style={{
        width: w, height: h, background: primaryColor, borderRadius: 4,
        fontFamily, color: '#ffffff', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px',
      }}>
        {/* Logo — large, left */}
        {logoUrl && (
          <img src={logoUrl} alt="Logo"
            style={{ maxWidth: 130, maxHeight: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
        )}
        {/* Divider */}
        {logoUrl && showQrCode && qrCodeUrl && (
          <div style={{ width: 1, height: 80, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        )}
        {/* QR + text — right */}
        {showQrCode && qrCodeUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <QRCode url={qrCodeUrl} size={60} color="#ffffff" bgColor={primaryColor} />
            <div style={{ fontSize: 7, opacity: 0.7, textAlign: 'center' }}>Scan for website</div>
          </div>
        )}
        {/* Tagline bottom center if no QR */}
        {showTagline && tagline && !(showQrCode && qrCodeUrl) && (
          <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 9, opacity: 0.8 }}>
            {tagline}
          </div>
        )}
      </div>
    );
  }

  // Front — layout depends on logo aspect ratio
  return (
    <div style={{
      width: w, height: h, background: backgroundColor, borderRadius: 4,
      fontFamily, color: secondaryColor, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: isWide ? '0' : '24px 20px 18px',
    }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: primaryColor }} />

      {isWide && logoUrl ? (
        /* Wide logo — spans top as primary visual */
        <>
          <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 0 }}>
            <img src={logoUrl} alt="Logo" style={{ maxWidth: 200, maxHeight: 50, objectFit: 'contain' }} />
          </div>
          <div style={{ padding: '0 20px 16px' }}>
            {showCompanyName && <div style={{ fontSize: 11, fontWeight: 700, color: primaryColor, marginBottom: 4 }}>{companyName}</div>}
            {showContactName && contactName && <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 1 }}>{contactName}</div>}
            {showContactTitle && contactTitle && <div style={{ fontSize: 8, color: '#64748b', marginBottom: 4 }}>{contactTitle}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {showPhone && phone && <div style={{ fontSize: 8, color: '#475569' }}>{phone}</div>}
              {showEmail && email && <div style={{ fontSize: 8, color: '#475569' }}>{email}</div>}
              {showWebsite && website && <div style={{ fontSize: 8, color: primaryColor }}>{website}</div>}
            </div>
          </div>
        </>
      ) : (
        /* Square/no logo — centered logo above company name */
        <>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {logoUrl && (
                <img src={logoUrl} alt="Logo" style={{
                  width: logoAspect >= 0.8 && logoAspect <= 1.2 ? 36 : 60,
                  height: logoAspect >= 0.8 && logoAspect <= 1.2 ? 36 : 30,
                  objectFit: 'contain',
                }} />
              )}
              {showCompanyName && <div style={{ fontSize: 13, fontWeight: 700, color: primaryColor }}>{companyName || 'Company Name'}</div>}
            </div>
          </div>
          <div>
            {showContactName && contactName && <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{contactName}</div>}
            {showContactTitle && contactTitle && <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>{contactTitle}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {showPhone && phone && <div style={{ fontSize: 8.5, color: '#475569' }}>{phone}</div>}
              {showEmail && email && <div style={{ fontSize: 8.5, color: '#475569' }}>{email}</div>}
              {showWebsite && website && <div style={{ fontSize: 8.5, color: primaryColor }}>{website}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
