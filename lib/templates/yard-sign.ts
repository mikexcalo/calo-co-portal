interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  brandColor: string;
  size: string;
  displayWidth?: number;
  showHeadline?: boolean;
  showPhone?: boolean;
  showCompanyName?: boolean;
  showQrCode?: boolean;
}

// Physical dimensions in inches for PDF export
export const SIGN_PHYSICAL_SIZES: Record<string, { w: number; h: number }> = {
  '18x24': { w: 18, h: 24 },
  '24x18': { w: 24, h: 18 },
  '12x18': { w: 12, h: 18 },
  '24x36': { w: 24, h: 36 },
  '36x24': { w: 36, h: 24 },
};

export function getYardSignTemplate(props: YardSignTemplateProps) {
  const {
    companyName, phone, headline, logoUrl, qrCodeUrl, brandColor, size,
    displayWidth = 600,
    showHeadline = true, showPhone = true, showCompanyName = true, showQrCode = true,
  } = props;

  const phys = SIGN_PHYSICAL_SIZES[size] || SIGN_PHYSICAL_SIZES['18x24'];
  const aspectRatio = phys.h / phys.w;
  const isLandscape = phys.w > phys.h;

  const maxHeight = 500;
  let W = displayWidth;
  let H = Math.round(displayWidth * aspectRatio);
  if (H > maxHeight) {
    H = maxHeight;
    W = Math.round(maxHeight / aspectRatio);
  }

  const topH = Math.round(H * 0.75);
  const bottomH = H - topH;
  const pad = Math.round(W * 0.05);

  // Format phone
  const digits = phone.replace(/\D/g, '');
  let formattedPhone = phone;
  if (digits.length === 10) {
    formattedPhone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    formattedPhone = `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  const objects: any[] = [
    {
      type: 'rect', left: 0, top: 0,
      width: W, height: topH, fill: brandColor,
      strokeWidth: 0, selectable: false, evented: false,
      lockMovement: true, lockScaling: true, name: 'brand-bg',
    },
    {
      type: 'rect', left: 0, top: topH,
      width: W, height: bottomH, fill: '#ffffff',
      strokeWidth: 0, selectable: false, evented: false,
      lockMovement: true, lockScaling: true, name: 'white-strip',
    },
  ];

  // Logo — bigger, higher
  if (logoUrl) {
    objects.push({
      type: 'image', src: logoUrl,
      left: W / 2,
      top: Math.round(topH * 0.03),
      originX: 'center',
      maxWidth: isLandscape ? W * 0.35 : W * 0.4,
      maxHeight: isLandscape ? topH * 0.22 : topH * 0.25,
      name: 'logo',
    });
  }

  // Headline — bigger, higher
  if (headline && showHeadline !== false) {
    objects.push({
      type: 'textbox', text: headline,
      left: W / 2,
      top: Math.round(isLandscape ? topH * 0.36 : topH * 0.32),
      width: W * 0.85, originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.055 : W * 0.065),
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Phone — much bigger
  if (phone && showPhone !== false) {
    objects.push({
      type: 'textbox', text: formattedPhone,
      left: W / 2,
      top: Math.round(isLandscape ? topH * 0.52 : topH * 0.50),
      width: W * 0.95, originX: 'center',
      fontSize: Math.round(isLandscape ? W * 0.1 : W * 0.13),
      fontWeight: 800, fill: '#ffffff', textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name — bigger
  if (companyName && showCompanyName !== false) {
    objects.push({
      type: 'textbox', text: companyName,
      left: pad,
      top: topH + Math.round(bottomH * 0.2),
      width: W * 0.6,
      fontSize: Math.round(isLandscape ? W * 0.04 : W * 0.05),
      fontWeight: 900, fill: brandColor, textAlign: 'left',
      name: 'company-text',
    });
  }

  // QR code placeholder
  if (qrCodeUrl && showQrCode !== false) {
    const qrSize = Math.round(bottomH * 0.6);
    objects.push({
      type: 'rect',
      left: W - pad - qrSize,
      top: topH + Math.round((bottomH - qrSize) / 2),
      width: qrSize, height: qrSize,
      fill: '#f3f4f6', strokeWidth: 0, rx: 4, ry: 4,
      name: 'qr-placeholder',
    });
  }

  return { width: W, height: H, objects, qrCodeUrl: qrCodeUrl || '' };
}
