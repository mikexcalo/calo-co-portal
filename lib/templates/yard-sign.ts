interface YardSignTemplateProps {
  companyName: string;
  phone: string;
  headline: string;
  logoUrl: string | null;
  qrCodeUrl: string;
  website?: string;
  brandColor: string;
  size: string;
}

export function getYardSignTemplate(props: YardSignTemplateProps) {
  const { companyName, phone, headline, logoUrl, qrCodeUrl, website, brandColor, size } = props;

  // Canvas dimensions in points
  const sizes: Record<string, { w: number; h: number }> = {
    '18x24': { w: 450, h: 600 },
    '24x18': { w: 600, h: 450 },
    '12x18': { w: 360, h: 540 },
    '24x36': { w: 480, h: 720 },
    '36x24': { w: 720, h: 480 },
  };

  const dim = sizes[size] || sizes['18x24'];
  const isLandscape = dim.w > dim.h;
  const stripHeight = Math.round(dim.h * 0.22);
  const brandHeight = dim.h - stripHeight;
  const pad = Math.round(dim.w * 0.05);

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
      width: dim.w, height: brandHeight,
      fill: brandColor,
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'brand-bg',
    },
    // White strip — full canvas width
    {
      type: 'rect',
      left: 0, top: brandHeight,
      width: dim.w, height: stripHeight,
      fill: '#ffffff',
      selectable: false, evented: false,
      lockMovement: true, lockScaling: true,
      name: 'white-strip',
    },
  ];

  // Logo — centered horizontally using originX: 'center'
  if (logoUrl) {
    objects.push({
      type: 'image',
      src: logoUrl,
      left: dim.w / 2,
      top: isLandscape ? brandHeight * 0.08 : brandHeight * 0.08,
      originX: 'center',
      maxWidth: isLandscape ? 120 : 140,
      maxHeight: isLandscape ? 60 : 80,
      name: 'logo',
    });
  }

  // Headline — centered
  if (headline) {
    objects.push({
      type: 'textbox',
      text: headline,
      left: dim.w / 2,
      top: isLandscape ? brandHeight * 0.42 : brandHeight * 0.38,
      width: dim.w * 0.8,
      originX: 'center',
      fontSize: isLandscape ? 28 : 32,
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
      left: dim.w / 2,
      top: isLandscape ? brandHeight * 0.6 : brandHeight * 0.56,
      width: dim.w * 0.9,
      originX: 'center',
      fontSize: isLandscape ? 44 : 52,
      fontWeight: 800,
      fill: '#ffffff',
      textAlign: 'center',
      name: 'phone-text',
    });
  }

  // Company name — in white strip, left-aligned with padding
  if (companyName) {
    objects.push({
      type: 'textbox',
      text: companyName,
      left: pad,
      top: brandHeight + stripHeight * 0.2,
      width: dim.w * 0.6,
      fontSize: isLandscape ? 18 : 20,
      fontWeight: 800,
      fill: brandColor,
      textAlign: 'left',
      name: 'company-text',
    });
  }

  // Website — small text below company name in white strip
  if (website) {
    objects.push({
      type: 'textbox',
      text: website,
      left: pad,
      top: brandHeight + stripHeight * 0.6,
      width: dim.w * 0.6,
      fontSize: 11,
      fontWeight: 400,
      fill: '#6b7280',
      textAlign: 'left',
      name: 'detail-text',
    });
  }

  // QR code placeholder — right-aligned in white strip
  if (qrCodeUrl) {
    const qrSize = Math.round(isLandscape ? stripHeight * 0.65 : stripHeight * 0.7);
    objects.push({
      type: 'rect',
      left: dim.w - pad - qrSize,
      top: brandHeight + Math.round((stripHeight - qrSize) / 2),
      width: qrSize,
      height: qrSize,
      fill: '#f3f4f6',
      rx: 4,
      ry: 4,
      name: 'qr-placeholder',
    });
  }

  return { width: dim.w, height: dim.h, objects };
}
