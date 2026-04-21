'use client';

import { useState } from 'react';
import { AssetType, ASSET_TYPES } from './types';
import { useTheme } from '@/lib/theme';

interface ExportButtonsProps {
  assetType: AssetType;
  previewRef: React.RefObject<HTMLDivElement | null>;
  side?: 'front' | 'back';
  frontRef?: React.RefObject<HTMLDivElement | null>;
  backRef?: React.RefObject<HTMLDivElement | null>;
  bgColor?: string; // card background color for bleed fill
}

function drawCropMarks(pdf: any, trimX: number, trimY: number, trimW: number, trimH: number) {
  const markLen = 0.1; // inches
  const gap = 0.02;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.003);

  // Top-left
  pdf.line(trimX - gap - markLen, trimY, trimX - gap, trimY);
  pdf.line(trimX, trimY - gap - markLen, trimX, trimY - gap);
  // Top-right
  pdf.line(trimX + trimW + gap, trimY, trimX + trimW + gap + markLen, trimY);
  pdf.line(trimX + trimW, trimY - gap - markLen, trimX + trimW, trimY - gap);
  // Bottom-left
  pdf.line(trimX - gap - markLen, trimY + trimH, trimX - gap, trimY + trimH);
  pdf.line(trimX, trimY + trimH + gap, trimX, trimY + trimH + gap + markLen);
  // Bottom-right
  pdf.line(trimX + trimW + gap, trimY + trimH, trimX + trimW + gap + markLen, trimY + trimH);
  pdf.line(trimX + trimW, trimY + trimH + gap, trimX + trimW, trimY + trimH + gap + markLen);
}

export default function ExportButtons({ assetType, previewRef, side, frontRef, backRef, bgColor }: ExportButtonsProps) {
  const { t } = useTheme();
  const [exporting, setExporting] = useState<string | null>(null);

  const config = ASSET_TYPES.find((t) => t.id === assetType);
  if (!config) return null;

  const widthIn = side === 'back' && config.backWidthIn ? config.backWidthIn : config.widthIn;
  const heightIn = side === 'back' && config.backHeightIn ? config.backHeightIn : config.heightIn;
  const pxWidth = Math.round(widthIn * 300);
  const bleedIn = 0.125;
  const isCard = assetType === 'business-card';

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
      // For business cards, render at bleed size (1125×675 at 300 DPI)
      const totalPx = isCard ? Math.round((widthIn + bleedIn * 2) * 300) : pxWidth;
      const canvas = await captureCanvas(previewRef, pxWidth);
      if (!canvas) return;

      if (isCard) {
        // Create bleed-extended canvas
        const bleedPx = Math.round(bleedIn * 300);
        const fullW = pxWidth + bleedPx * 2;
        const fullH = Math.round(heightIn * 300) + bleedPx * 2;
        const offscreen = document.createElement('canvas');
        offscreen.width = fullW;
        offscreen.height = fullH;
        const ctx = offscreen.getContext('2d')!;
        // Fill bleed area with card bg color
        ctx.fillStyle = bgColor || '#ffffff';
        ctx.fillRect(0, 0, fullW, fullH);
        // Draw captured card centered
        ctx.drawImage(canvas, bleedPx, bleedPx, pxWidth, Math.round(heightIn * 300));
        const link = document.createElement('a');
        link.download = `${assetType}${side ? `-${side}` : ''}-300dpi-${Date.now()}.png`;
        link.href = offscreen.toDataURL('image/png', 1.0);
        link.click();
      } else {
        const link = document.createElement('a');
        link.download = `${assetType}${side ? `-${side}` : ''}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      }
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

      if (isCard && bgColor) {
        // Fill bleed area with card background
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pdfW, pdfH, 'F');
      }

      pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, widthIn, heightIn);

      if (isCard) {
        drawCropMarks(pdf, bleedIn, bleedIn, widthIn, heightIn);
      }

      pdf.save(`${assetType}${side ? `-${side}` : ''}-print-${Date.now()}.pdf`);
    } catch (err) { console.error('[ExportPDF]', err); alert('Export failed.'); }
    finally { setExporting(null); }
  };

  // Combined 2-page PDF
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

      if (isCard && bgColor) {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pdfW, pdfH, 'F');
      }
      pdf.addImage(frontCanvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, fW, fH);
      if (isCard) drawCropMarks(pdf, bleedIn, bleedIn, fW, fH);

      const bPdfW = bW + bleedIn * 2;
      const bPdfH = bH + bleedIn * 2;
      pdf.addPage([bPdfW, bPdfH], bPdfW > bPdfH ? 'landscape' : 'portrait');
      if (isCard && bgColor) {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, bPdfW, bPdfH, 'F');
      }
      pdf.addImage(backCanvas.toDataURL('image/png', 1.0), 'PNG', bleedIn, bleedIn, bW, bH);
      if (isCard) drawCropMarks(pdf, bleedIn, bleedIn, bW, bH);

      pdf.save(`${assetType}-both-print-${Date.now()}.pdf`);
    } catch (err) { console.error('[ExportBoth]', err); alert('Export failed.'); }
    finally { setExporting(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleExportPdf} disabled={!!exporting} style={{
          background: '#2563eb', border: 'none', color: '#fff',
          borderRadius: 6, padding: '8px 20px', fontSize: 14, fontWeight: 500,
          cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: exporting && exporting !== 'pdf' ? 0.5 : 1,
        }}>
          {exporting === 'pdf' ? 'Generating...' : isCard ? 'Download print PDF' : 'Download PDF'}
        </button>
        <button onClick={handleExportPng} disabled={!!exporting} style={{
          background: 'transparent', border: '1px solid #2563eb', color: '#2563eb',
          borderRadius: 6, padding: '8px 20px', fontSize: 14, fontWeight: 500,
          cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: exporting && exporting !== 'png' ? 0.5 : 1,
        }}>
          {exporting === 'png' ? 'Generating...' : isCard ? 'Download PNG @ 300 DPI' : 'Download PNG'}
        </button>
      </div>
      {isCard && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: t.text.tertiary, lineHeight: 1.5 }}>
            Files include 0.125&quot; bleed and crop marks. Drop directly into Canva, Moo, or Vistaprint.
          </div>
          <div style={{ fontSize: 10, color: t.text.tertiary, marginTop: 4, lineHeight: 1.5, opacity: 0.8 }}>
            Exports in RGB. Digital print (Canva, Vistaprint Standard) handles RGB natively. Offset print colors may shift 5-10%.
          </div>
        </div>
      )}
    </div>
  );
}
