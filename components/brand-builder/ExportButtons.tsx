'use client';

import { useState } from 'react';
import { AssetType, ASSET_TYPES } from './types';

interface ExportButtonsProps {
  assetType: AssetType;
  previewRef: React.RefObject<HTMLDivElement | null>;
  side?: 'front' | 'back';
}

export default function ExportButtons({ assetType, previewRef, side }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);

  const config = ASSET_TYPES.find((t) => t.id === assetType);
  if (!config) return null;

  const widthIn = side === 'back' && config.backWidthIn ? config.backWidthIn : config.widthIn;
  const heightIn = side === 'back' && config.backHeightIn ? config.backHeightIn : config.heightIn;

  // 300 DPI dimensions
  const pxWidth = Math.round(widthIn * 300);
  const pxHeight = Math.round(heightIn * 300);

  // Bleed: 0.125" on each side
  const bleedIn = 0.125;
  const bleedPx = Math.round(bleedIn * 300);
  const totalPxW = pxWidth + bleedPx * 2;
  const totalPxH = pxHeight + bleedPx * 2;

  const sideLabel = side ? ` (${side})` : '';

  const handleExportPng = async () => {
    if (!previewRef.current) return;
    setExporting('png');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: pxWidth / previewRef.current.offsetWidth,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${assetType}${side ? `-${side}` : ''}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('[ExportPNG] error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!previewRef.current) return;
    setExporting('pdf');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Render to canvas at high resolution
      const canvas = await html2canvas(previewRef.current, {
        scale: pxWidth / previewRef.current.offsetWidth,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      // PDF page size = asset + bleed on all sides
      const pdfWidthIn = widthIn + bleedIn * 2;
      const pdfHeightIn = heightIn + bleedIn * 2;

      const orientation = pdfWidthIn > pdfHeightIn ? 'landscape' as const : 'portrait' as const;
      const pdf = new jsPDF({
        orientation,
        unit: 'in',
        format: [pdfWidthIn, pdfHeightIn],
      });

      // Add the image with bleed offset
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', bleedIn, bleedIn, widthIn, heightIn);

      // Draw crop marks
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.003);
      const markLen = 0.1;

      // Top-left
      pdf.line(bleedIn, 0, bleedIn, markLen);
      pdf.line(0, bleedIn, markLen, bleedIn);
      // Top-right
      pdf.line(bleedIn + widthIn, 0, bleedIn + widthIn, markLen);
      pdf.line(pdfWidthIn, bleedIn, pdfWidthIn - markLen, bleedIn);
      // Bottom-left
      pdf.line(bleedIn, pdfHeightIn, bleedIn, pdfHeightIn - markLen);
      pdf.line(0, bleedIn + heightIn, markLen, bleedIn + heightIn);
      // Bottom-right
      pdf.line(bleedIn + widthIn, pdfHeightIn, bleedIn + widthIn, pdfHeightIn - markLen);
      pdf.line(pdfWidthIn, bleedIn + heightIn, pdfWidthIn - markLen, bleedIn + heightIn);

      pdf.save(`${assetType}${side ? `-${side}` : ''}-${Date.now()}.pdf`);
    } catch (err) {
      console.error('[ExportPDF] error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        onClick={handleExportPdf}
        disabled={!!exporting}
        style={{
          background: exporting === 'pdf' ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 600,
          cursor: exporting ? 'wait' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: exporting && exporting !== 'pdf' ? 0.5 : 1,
        }}
      >
        {exporting === 'pdf' ? 'Generating PDF...' : `Download PDF${sideLabel}`}
      </button>

      <button
        onClick={handleExportPng}
        disabled={!!exporting}
        style={{
          background: 'transparent',
          color: '#2563eb',
          border: '1.5px solid #2563eb',
          borderRadius: 6,
          padding: '7px 16px',
          fontSize: 12,
          fontWeight: 600,
          cursor: exporting ? 'wait' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: exporting && exporting !== 'png' ? 0.5 : 1,
        }}
      >
        {exporting === 'png' ? 'Generating PNG...' : `Download PNG${sideLabel}`}
      </button>

      {/* Disabled placeholder */}
      <button
        disabled
        title="Coming soon — let clients access finished assets."
        style={{
          background: '#f1f5f9',
          color: '#94a3b8',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '7px 14px',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'not-allowed',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Export to Client Dashboard
      </button>
    </div>
  );
}
