/**
 * Logo assets — preview and download in the formats people actually need.
 *
 * Conversion happens in the browser on a canvas. That means PNG, JPG and WebP
 * are all real, and any size down from the source is real.
 *
 * SVG is NOT offered, and that's deliberate rather than an oversight. These
 * sources are raster; "converting" a PNG to SVG produces either a giant
 * embedded bitmap wearing an .svg extension or an auto-traced approximation
 * that looks wrong at the exact sizes a logo matters. If a true vector is
 * needed, it has to come from the original design file.
 */

export type LogoFormat = 'png' | 'jpg' | 'webp';

export interface LogoVariant {
  id: string;
  /** What it is, in the words someone choosing would use. */
  name: string;
  /** When to reach for this one. */
  use: string;
  url: string;
  /** Background the preview sits on, so it reads honestly. */
  preview: 'light' | 'dark' | 'brand';
  /** Full lockup or just the mark. */
  shape: 'lockup' | 'icon';
}

export const LOGO_SIZES = [
  { label: 'Original', px: 0 },
  { label: 'Large — 1024px', px: 1024 },
  { label: 'Medium — 512px', px: 512 },
  { label: 'Small — 256px', px: 256 },
  { label: 'Email — 240px', px: 240 },
] as const;

export const FORMAT_NOTES: Record<LogoFormat, string> = {
  png: 'Transparent background. Use this unless you have a reason not to.',
  jpg: 'No transparency — the background is filled in. Smaller file; good for email and documents that reject PNG.',
  webp: 'Smallest file, transparent. Great on the web, still refused by some older software.',
};

/**
 * Redraw through a canvas at the requested size and format.
 * Returns a blob URL the caller must revoke after use.
 */
export async function convertLogo(
  url: string,
  format: LogoFormat,
  maxPx: number,
  backgroundForJpg = '#FFFFFF'
): Promise<Blob> {
  const img = await loadImage(url);

  const scale = maxPx > 0 ? Math.min(1, maxPx / Math.max(img.width, img.height)) : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser');

  // JPG has no alpha channel; without this, transparency renders black.
  if (format === 'jpg') {
    ctx.fillStyle = backgroundForJpg;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, format === 'png' ? undefined : 0.92)
  );

  if (!blob) throw new Error(`This browser could not produce a ${format.toUpperCase()}`);
  return blob;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required or the canvas is tainted and toBlob throws.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          'Could not load that logo. It has to be publicly reachable, and the host has to allow cross-origin reads.'
        )
      );
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — revoking immediately can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileNameFor(
  company: string,
  variant: LogoVariant,
  format: LogoFormat,
  px: number
): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const size = px > 0 ? `-${px}` : '';
  return `${slug(company)}-${slug(variant.name)}${size}.${format}`;
}

/**
 * Best guess at what each file is from its name, so a brand kit with logos
 * already saved shows something sensible without anyone tagging them.
 */
export function describeFromFilename(url: string): Pick<LogoVariant, 'name' | 'use' | 'preview' | 'shape'> {
  const f = url.split('/').pop() ?? '';
  const lower = f.toLowerCase();

  const isIcon = /icon|favicon|mark|symbol/.test(lower);
  const onWhite = /white/.test(lower);
  const onNavy = /navy|dark/.test(lower);

  if (isIcon) {
    return {
      name: onWhite ? 'Icon — light' : onNavy ? 'Icon — dark' : 'Icon',
      use: 'Social avatars, favicons, anywhere too small for the full name.',
      preview: onWhite ? 'dark' : 'light',
      shape: 'icon',
    };
  }

  if (onWhite) {
    return {
      name: 'Full logo — reversed',
      use: 'On photographs and dark backgrounds.',
      preview: 'dark',
      shape: 'lockup',
    };
  }

  return {
    name: onNavy ? 'Full logo — primary' : 'Full logo',
    use: 'The default. Use this on light backgrounds.',
    preview: 'light',
    shape: 'lockup',
  };
}
