/**
 * Pulling a palette out of a logo.
 *
 * Somebody hands you a logo and you need the hexes. The usual answer is an
 * eyedropper and guesswork, which gets you close and never exact, or an API
 * that charges per image for arithmetic a browser can do in fifteen
 * milliseconds. This does it locally: no upload, no key, no per-image cost,
 * and it works on a plane.
 *
 * Two decisions worth knowing:
 *
 *  * Clustering happens in OKLab, not RGB. RGB distance thinks navy and
 *    maroon are neighbours and that two greens a designer chose deliberately
 *    are the same colour. OKLab distance matches what an eye reports, so the
 *    clusters come out where a person would have drawn them.
 *
 *  * Every swatch returned is a pixel that genuinely exists in the image, not
 *    a cluster average. Averaging a logo's red against its shadow produces a
 *    red that is nearly right, which is the worst kind of wrong: it survives
 *    review and shows up as a mismatch against the client's real asset later.
 */

export interface Swatch {
  hex: string;
  /** Share of the non-transparent pixels this cluster covers, 0-1. */
  share: number;
  /** OKLab lightness, 0-1. */
  lightness: number;
  /** OKLab chroma. Above ~0.04 reads as a colour rather than a grey. */
  chroma: number;
  role: 'primary' | 'secondary' | 'accent' | 'ink' | 'paper' | 'neutral';
  /** A starting name. Always meant to be overwritten by a human. */
  name: string;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** sRGB to OKLab. Björn Ottosson's matrices, unchanged. */
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

export const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

interface Px { r: number; g: number; b: number; L: number; a: number; bb: number }

/**
 * Names that describe the colour rather than the brand.
 *
 * "Blueprint" and "Brass" are the names a person gives a palette once they
 * own it. Nothing here knows the business, so it says what it sees and gets
 * out of the way.
 */
function describe(L: number, C: number, hue: number): string {
  if (C < 0.035) {
    if (L > 0.93) return 'Off white';
    if (L > 0.75) return 'Light grey';
    if (L > 0.45) return 'Mid grey';
    if (L > 0.18) return 'Charcoal';
    return 'Near black';
  }
  const h = ((hue * 180) / Math.PI + 360) % 360;
  const family =
    h < 20 ? 'Red' : h < 45 ? 'Orange' : h < 70 ? 'Amber' : h < 100 ? 'Yellow'
    : h < 160 ? 'Green' : h < 200 ? 'Teal' : h < 250 ? 'Blue'
    : h < 290 ? 'Indigo' : h < 330 ? 'Violet' : 'Pink';
  const tone = L > 0.78 ? 'Light ' : L < 0.35 ? 'Deep ' : '';
  return tone + family;
}

/**
 * k-means over the image, seeded with k-means++.
 *
 * Random seeding on a logo reliably drops two centroids inside the same big
 * flat area and leaves the one-percent accent — usually the colour the brand
 * is actually known for — unclaimed.
 */
export function extractPalette(data: Uint8ClampedArray, k = 6, maxIter = 14): Swatch[] {
  const px: Px[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Anything part-transparent is an edge pixel: a blend of the mark and
    // whatever was behind it, and a colour that appears nowhere in the design.
    if (data[i + 3] < 240) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [L, a, bb] = rgbToOklab(r, g, b);
    px.push({ r, g, b, L, a, bb });
  }
  if (!px.length) return [];

  const K = Math.max(1, Math.min(k, px.length));
  const dist = (p: Px, c: { L: number; a: number; bb: number }) => {
    const dL = p.L - c.L, da = p.a - c.a, db = p.bb - c.bb;
    return dL * dL + da * da + db * db;
  };

  // k-means++ seeding, deterministic: farthest point rather than weighted
  // random, so the same logo gives the same palette every time it is opened.
  const cent: { L: number; a: number; bb: number }[] = [{ L: px[0].L, a: px[0].a, bb: px[0].bb }];
  while (cent.length < K) {
    let best = -1, bestD = -1;
    for (let i = 0; i < px.length; i++) {
      let d = Infinity;
      for (const c of cent) d = Math.min(d, dist(px[i], c));
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best < 0) break;
    cent.push({ L: px[best].L, a: px[best].a, bb: px[best].bb });
  }

  const owner = new Int32Array(px.length);
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;
    for (let i = 0; i < px.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cent.length; c++) {
        const d = dist(px[i], cent[c]);
        if (d < bd) { bd = d; bi = c; }
      }
      if (owner[i] !== bi) { owner[i] = bi; moved = true; }
    }
    const sumL = new Float64Array(cent.length);
    const sumA = new Float64Array(cent.length);
    const sumB = new Float64Array(cent.length);
    const n = new Int32Array(cent.length);
    for (let i = 0; i < px.length; i++) {
      const o = owner[i];
      sumL[o] += px[i].L; sumA[o] += px[i].a; sumB[o] += px[i].bb; n[o]++;
    }
    for (let c = 0; c < cent.length; c++) {
      if (!n[c]) continue;
      cent[c] = { L: sumL[c] / n[c], a: sumA[c] / n[c], bb: sumB[c] / n[c] };
    }
    if (!moved) break;
  }

  // The representative is the real pixel nearest the centroid, never the mean.
  const out: Swatch[] = [];
  for (let c = 0; c < cent.length; c++) {
    let best = -1, bd = Infinity, count = 0;
    for (let i = 0; i < px.length; i++) {
      if (owner[i] !== c) continue;
      count++;
      const d = dist(px[i], cent[c]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || !count) continue;
    const p = px[best];
    const chroma = Math.sqrt(p.a * p.a + p.bb * p.bb);
    out.push({
      hex: toHex(p.r, p.g, p.b),
      share: count / px.length,
      lightness: p.L,
      chroma,
      role: 'neutral',
      name: describe(p.L, chroma, Math.atan2(p.bb, p.a)),
    });
  }

  // Merge anything that survived clustering but is visually the same colour.
  const merged: Swatch[] = [];
  for (const s of out.sort((a, b) => b.share - a.share)) {
    const near = merged.find((m) => {
      const [L1, a1, b1] = rgbToOklab(parseInt(m.hex.slice(1, 3), 16), parseInt(m.hex.slice(3, 5), 16), parseInt(m.hex.slice(5, 7), 16));
      const [L2, a2, b2] = rgbToOklab(parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16));
      return Math.hypot(L1 - L2, a1 - a2, b1 - b2) < 0.045;
    });
    if (near) near.share += s.share;
    else merged.push({ ...s });
  }

  /**
   * Roles, by what the colour is doing rather than how much of it there is.
   *
   * Area is a bad ranking on its own: a logo on a white card is 80% white,
   * and calling white the primary is technically true and useless. The
   * chromatic colours are ranked by presence weighted toward saturation, and
   * the greys are named for the jobs greys actually do.
   */
  const chromatic = merged.filter((s) => s.chroma >= 0.04).sort((a, b) => (b.share * (0.35 + b.chroma)) - (a.share * (0.35 + a.chroma)));
  const greys = merged.filter((s) => s.chroma < 0.04);

  chromatic.forEach((s, i) => { s.role = i === 0 ? 'primary' : i === 1 ? 'secondary' : 'accent'; });
  for (const s of greys) s.role = s.lightness > 0.85 ? 'paper' : s.lightness < 0.30 ? 'ink' : 'neutral';

  return [...chromatic, ...greys.sort((a, b) => a.lightness - b.lightness)];
}

/**
 * Down to 160px on the long edge before clustering.
 *
 * A 2000px logo is four million pixels of the same twelve colours. The
 * palette is identical and the wait is four seconds instead of instant.
 */
export const SAMPLE_EDGE = 160;
