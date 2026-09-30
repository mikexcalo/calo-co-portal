/**
 * svg-to-pdfkit ships no types.
 *
 * The whole surface we use is one call: draw this SVG into this document at
 * this box. Declaring that is truer than pulling in a stub that describes
 * options we never pass.
 */
declare module 'svg-to-pdfkit' {
  import type PDFDocument from 'pdfkit';
  export default function SVGtoPDF(
    doc: InstanceType<typeof PDFDocument>,
    svg: string,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; preserveAspectRatio?: string; assumePt?: boolean }
  ): void;
}
