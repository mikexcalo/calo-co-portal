interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  brandColor: string;
  size: string;
  displayWidth?: number;
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
  const { companyName, phone, headline, logoUrl, qrCodeUrl, brandColor, size, displayWidth = 600 } = props;

  const phys = SIGN_PHYSICAL_SIZES[size] || SIGN_PHYSICAL_SIZES['18x24'];
  const aspectRatio = phys.h / phys.w;
  const isLandscape = phys.w > phys.h;

  // Canvas = display dimensions. No scaling later.
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
    // Brand color background — full canvas width
    {
      type: 'rect',
      left: 0, top: 0,
      width: W, height: topH,
      fill: brandColor,
      strokeWidth: 0,
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'brand-bg',
    },
    // White strip — full canvas width
    {
      type: 'rect',
      left: 0, top: topH,
      width: W, height: bottomH,
      fill: '#ffffff',
      strokeWidth: 0,
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'white-strip',
    },
  ];

  // Logo — centered
  if (logoUrl) {
    objects.push({
      type: 'image',
      src: logoUrl,
      left: W / 2,
      top: isLandscape ? topH * 0.08 : topH * 0.08,
      originX: 'center',
      maxWidth: isLandscape ? W * 0.25 : W * 0.3,
      maxHeight: isLandscape ? topH * 0.2 : topH * 0.2,
      name: 'logo',
    });
  }

  // Headline — centered
  if (headline) {
    objects.push({
      type: 'textbox',
      text: headline,
      left: W / 2,
      top: isLandscape ? topH * 0.42 : topH * 0.38,
      width: W * 0.8,
      originX: 'center',
      fontSize: isLandscape ? Math.round(W * 0.047) : Math.round(W * 0.053),
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'headline-text',
    });
  }

  // Phone — biggest text, centered
  if (phone) {
    objects.push({
      type: 'textbox',
      text: formattedPhone,
      left: W / 2,
      top: isLandscape ? topH * 0.6 : topH * 0.56,
      width: W * 0.9,
      originX: 'center',
      fontSize: isLandscape ? Math.round(W * 0.073) : Math.round(W * 0.087),
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name — white strip, left-aligned
  if (companyName) {
    objects.push({
      type: 'textbox',
      text: companyName,
      left: pad,
      top: topH + Math.round(bottomH * 0.25),
      width: W * 0.6,
      fontSize: isLandscape ? Math.round(W * 0.03) : Math.round(W * 0.033),
      fontWeight: 800,
      fill: brandColor,
      textAlign: 'left',
      name: 'company-text',
    });
  }

  // QR code placeholder — right-aligned in white strip
  if (qrCodeUrl) {
    const qrSize = Math.round(bottomH * 0.6);
    objects.push({
      type: 'rect',
      left: W - pad - qrSize,
      top: topH + Math.round((bottomH - qrSize) / 2),
      width: qrSize, height: qrSize,
      fill: '#f3f4f6',
      strokeWidth: 0,
      rx: 4, ry: 4,
      name: 'qr-placeholder',
    });
  }

  return { width: W, height: H, objects, qrCodeUrl: qrCodeUrl || '' };
}
