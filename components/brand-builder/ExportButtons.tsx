'use client';

import { useState } from 'react';
import { AssetType, ASSET_TYPES } from './types';

interface ExportButtonsProps {
  assetType: AssetType;
  previewRef: React.RefObject<HTMLDivElement | null>;
  side?: 'front' | 'back';
  frontRef?: React.RefObject<HTMLDivElement | null>;
  backRef?: React.RefObject<HTMLDivElement | null>;
}

export default function ExportButtons({ assetType, previewRef, side, frontRef, backRef }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const config = ASSET_TYPES.find((t) => t.id === assetType);
  if (!config) return null;

  const widthIn = side === 'back' && config.backWidthIn ? config.backWidthIn : config.widthIn;
  const heightIn = side === 'back' && config.backHeightIn ? config.backHeightIn : config.heightIn;
  const pxWidth = Math.round(widthIn * 300);
  const bleedIn = 0.125;

  const sideLabel = side ? ` (${side})` : '';

  const captureCanvas = async (ref: React.RefObject<HTMLDivElement | null>, w: number) => {
    if (!ref.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(ref.current, {
      scale: w / ref.current.offsetWidth,
      useCORS: true, backgroundColor: null, logging: false,
    });
  };

  const handleExportPng = async () => {
    setExporting('png');
    try {
      const canvas = await captureCanvas(previewRef, pxWidth);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${assetType}${side ? `-${side}` : ''}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) { console.error('[ExportPNG]', err); alert('Export failed.'); }
    finally { setExporting(null); }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const canvas = await captureCanvas(previewRef, pxWidth);
      if (!canvas) return;
      const { jsPDF } = await import('jspdf');
      const pdfW = widthIn + bleedIn * 2;
      const pdfH = heightIn + bleedIn * 2;
      const pdf = new jsPDF({ orientation: pdfW > pdfH ? 'landscape' : 'portrait', unit: 'in', format: [pdfW, pdfH] });
      pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, widthIn, heightIn);
      pdf.save(`${assetType}${side ? `-${side}` : ''}-${Date.now()}.pdf`);
    } catch (err) { console.error('[ExportPDF]', err); alert('Export failed.'); }
    finally { setExporting(null); }
  };

  // Combined 2-page PDF (#3)
  const handleExportBoth = async () => {
    if (!frontRef?.current || !backRef?.current) return;
    setExporting('both');
    try {
      const fW = config.widthIn;
      const fH = config.heightIn;
      const bW = config.backWidthIn || fW;
      const bH = config.backHeightIn || fH;
      const fPx = Math.round(fW * 300);
      const bPx = Math.round(bW * 300);

      const [frontCanvas, backCanvas] = await Promise.all([
        captureCanvas(frontRef, fPx),
        captureCanvas(backRef, bPx),
      ]);
      if (!frontCanvas || !backCanvas) return;

      const { jsPDF } = await import('jspdf');
      const pdfW = fW + bleedIn * 2;
      const pdfH = fH + bleedIn * 2;
      const pdf = new jsPDF({ orientation: pdfW > pdfH ? 'landscape' : 'portrait', unit: 'in', format: [pdfW, pdfH] });

      // Page 1: front
      pdf.addImage(frontCanvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, fW, fH);

      // Page 2: back
      const bPdfW = bW + bleedIn * 2;
      const bPdfH = bH + bleedIn * 2;
      pdf.addPage([bPdfW, bPdfH], bPdfW > bPdfH ? 'landscape' : 'portrait');
      pdf.addImage(backCanvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, bW, bH);

      pdf.save(`${assetType}-both-${Date.now()}.pdf`);
    } catch (err) { console.error('[ExportBoth]', err); alert('Export failed.'); }
    finally { setExporting(null); }
  };

  const btnStyle = (variant: 'primary' | 'outline' | 'disabled', active: boolean) => ({
    background: variant === 'primary' ? (active ? '#93c5fd' : '#2563eb') : variant === 'outline' ? 'transparent' : '#f1f5f9',
    color: variant === 'primary' ? '#fff' : variant === 'outline' ? '#2563eb' : '#94a3b8',
    border: variant === 'outline' ? '1.5px solid #2563eb' : variant === 'disabled' ? '1px solid #e2e8f0' : 'none',
    borderRadius: 6, padding: variant === 'outline' ? '7px 16px' : '8px 16px',
    fontSize: 12, fontWeight: 600, cursor: exporting ? 'wait' : variant === 'disabled' ? 'not-allowed' : 'pointer',
    fontFamily: 'Inter, sans-serif', opacity: exporting && !active ? 0.5 : 1,
  });

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button onClick={handleExportPdf} disabled={!!exporting} style={btnStyle('primary', exporting === 'pdf')}>
        {exporting === 'pdf' ? 'Generating...' : `Download PDF${sideLabel}`}
      </button>

      {/* Combined PDF — only for front/back assets */}
      {frontRef && backRef && (
        <button onClick={handleExportBoth} disabled={!!exporting} style={btnStyle('primary', exporting === 'both')}>
          {exporting === 'both' ? 'Generating...' : 'Download Both (PDF)'}
        </button>
      )}

      <button onClick={handleExportPng} disabled={!!exporting} style={btnStyle('outline', exporting === 'png')}>
        {exporting === 'png' ? 'Generating...' : `Download PNG${sideLabel}`}
      </button>
    </div>
  );
}
