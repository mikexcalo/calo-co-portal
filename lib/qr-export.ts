import QRCode from 'qrcode';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportQRAsSVG(opts: {
  destination: string;
  errorCorrection: 'M' | 'Q' | 'H';
  color: string;
  bgColor?: string;
  filename: string;
}) {
  const svgString = await QRCode.toString(opts.destination, {
    type: 'svg',
    errorCorrectionLevel: opts.errorCorrection,
    margin: 2,
    color: { dark: opts.color, light: opts.bgColor || '#FFFFFF' },
  });
  triggerDownload(new Blob([svgString], { type: 'image/svg+xml' }), `${opts.filename}.svg`);
}

export async function exportQRAsPNG(opts: {
  destination: string;
  errorCorrection: 'M' | 'Q' | 'H';
  color: string;
  bgColor?: string;
  size: 512 | 1024 | 2048;
  filename: string;
}) {
  // Note: qrcode library supports transparent bg via '#00000000' (8-char hex with alpha).
  // PNG export preserves alpha channel when bgColor is transparent.
  const dataUrl = await QRCode.toDataURL(opts.destination, {
    errorCorrectionLevel: opts.errorCorrection,
    margin: 2,
    width: opts.size,
    color: { dark: opts.color, light: opts.bgColor || '#FFFFFF' },
  });
  const res = await fetch(dataUrl);
  triggerDownload(await res.blob(), `${opts.filename}-${opts.size}.png`);
}
