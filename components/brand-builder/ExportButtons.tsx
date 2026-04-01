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

  const btnBase: React.CSSProperties = {
    background: 'transparent', border: '1px solid #e5e7eb', color: '#374151',
    borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500,
    cursor: exporting ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif',
    transition: 'all 0.12s',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={handleExportPdf} disabled={!!exporting} style={{ ...btnBase, opacity: exporting && exporting !== 'pdf' ? 0.5 : 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'transparent'; }}>
        {exporting === 'pdf' ? 'Generating...' : 'Download PDF'}
      </button>
      <button onClick={handleExportPng} disabled={!!exporting} style={{ ...btnBase, opacity: exporting && exporting !== 'png' ? 0.5 : 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'transparent'; }}>
        {exporting === 'png' ? 'Generating...' : 'Download PNG'}
      </button>
    </div>
  );
}
