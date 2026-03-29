'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Client, BrandKit } from '@/lib/types';
import { DB, loadClients, loadAllBrandKits, saveBrandKit } from '@/lib/database';
import LogoSlot from '@/components/brand-kit/LogoSlot';
import ColorPalette from '@/components/brand-kit/ColorPalette';
import Typography from '@/components/brand-kit/Typography';
import BrandNotes from '@/components/brand-kit/BrandNotes';
import BrandKitErrorBoundary from '@/components/brand-kit/BrandKitErrorBoundary';

export default function BrandKitPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const viewMode = searchParams.get('viewMode') || 'edit';
  const readOnly = viewMode === 'view';

  const [client, setClient] = useState<Client | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (DB.clientsState !== 'loaded') await loadClients();
        // Only reload brand kits if not already cached
        const hasBk = DB.clients.some((c) => c.brandKit?._id);
        if (!hasBk) await loadAllBrandKits();

        // Find the client
        const cl = DB.clients.find((c) => c.id === clientId);
        if (!cl) {
          setError('Client not found');
          setLoading(false);
          return;
        }

        setClient(cl);
        // Ensure brand kit has all required fields with safe defaults
        const bk = cl.brandKit || {
          _id: null,
          logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] },
          colors: [],
          fonts: { heading: '', body: '', accent: '' },
          notes: '',
        };
        // Guard individual fields
        if (!bk.logos) bk.logos = { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] };
        if (!bk.logos.light) bk.logos.light = [];
        if (!bk.logos.dark) bk.logos.dark = [];
        if (!bk.logos.color) bk.logos.color = [];
        if (!bk.logos.icon) bk.logos.icon = [];
        if (!bk.logos.secondary) bk.logos.secondary = [];
        if (!bk.logos.favicon) bk.logos.favicon = [];
        // Safely parse colors — could be array of strings, JSONB objects, or malformed
        if (!bk.colors) {
          bk.colors = [];
        } else if (!Array.isArray(bk.colors)) {
          try {
            bk.colors = typeof bk.colors === 'string' ? JSON.parse(bk.colors) : [];
          } catch {
            bk.colors = [];
          }
        }
        // Ensure each color is a string
        bk.colors = bk.colors.map((c: any) => {
          if (typeof c === 'string') return c;
          if (c && typeof c === 'object' && c.hex) return c.hex;
          return '#000000';
        });
        if (!bk.fonts) bk.fonts = { heading: '', body: '', accent: '' };
        if (!bk.notes) bk.notes = '';
        setBrandKit(bk);
        setLoading(false);
      } catch (err) {
        console.error('Error loading brand kit:', err);
        setError('Failed to load brand kit');
        setLoading(false);
      }
    };

    loadData();
  }, [clientId]);

  const handleLogoChange = async (slotKey: string, files: File[]) => {
    if (!brandKit || !client) return;

    // This will be handled by the LogoSlot component
    // It will call uploadAsset and update the brandKit
    setBrandKit({ ...brandKit });
  };

  const handleColorChange = (colors: string[]) => {
    if (!brandKit) return;
    brandKit.colors = colors;
    setBrandKit({ ...brandKit });
    saveBrandKit(brandKit, clientId);
  };

  const handleFontChange = (type: 'heading' | 'body' | 'accent', value: string) => {
    if (!brandKit) return;
    brandKit.fonts[type] = value;
    setBrandKit({ ...brandKit });
    saveBrandKit(brandKit, clientId);
  };

  const handleNotesChange = (notes: string) => {
    if (!brandKit) return;
    brandKit.notes = notes;
    setBrandKit({ ...brandKit });
    saveBrandKit(brandKit, clientId);
  };

  const handleExportPDF = async () => {
    if (!brandKit || !client) return;
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const name = client.company || client.name || 'Client';
    let y = 50;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text(`${name} — Brand Guide`, 50, y);
    y += 36;

    // Colors
    if (brandKit.colors.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Color Palette', 50, y);
      y += 20;
      brandKit.colors.forEach((c, i) => {
        const hex = typeof c === 'string' ? c : (c as any).hex || '#000';
        pdf.setFillColor(hex);
        pdf.rect(50 + i * 60, y, 50, 30, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor('#334155');
        pdf.text(hex, 50 + i * 60, y + 42);
      });
      y += 60;
    }

    // Typography
    pdf.setTextColor('#1a1f2e');
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Typography', 50, y);
    y += 18;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    if (brandKit.fonts.heading) { pdf.text(`Heading: ${brandKit.fonts.heading}`, 50, y); y += 14; }
    if (brandKit.fonts.body) { pdf.text(`Body: ${brandKit.fonts.body}`, 50, y); y += 14; }
    if (brandKit.fonts.accent) { pdf.text(`Accent: ${brandKit.fonts.accent}`, 50, y); y += 14; }
    y += 12;

    // Brand Notes
    if (brandKit.notes) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Brand Notes', 50, y);
      y += 18;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(brandKit.notes, 500);
      pdf.text(lines, 50, y);
    }

    pdf.save(`${name} - Brand Guide.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-700">Loading Brand Kit...</div>
        </div>
      </div>
    );
  }

  if (error || !client || !brandKit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">{error || 'Brand Kit not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '2px', color: '#0f172a' }}>Brand Kit</h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>{client.company || client.name}</p>
        </div>

        {!readOnly && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportPDF}
            style={{ marginBottom: '0', marginTop: '2px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Export Brand Guide PDF
          </button>
        )}
      </div>

      {/* Read-only notice */}
      {readOnly && (
        <div
          className="bk-ro-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#666',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '7px 11px',
            marginBottom: '16px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Read-only view — contact CALO&CO to update your brand assets
        </div>
      )}

      {/* Main layout */}
      <BrandKitErrorBoundary clientId={clientId} clientName={client.company || client.name}>
      <div className="bk-layout">
        {/* Logo Suite Card */}
        <div className="bk-card">
          <div className="bk-section-title">Logo Suite</div>
          <div className="bk-logo-grid">
            <div className="bk-logo-row">
              <LogoSlot
                clientId={clientId}
                slotKey="color"
                label="Full Color"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
              <LogoSlot
                clientId={clientId}
                slotKey="light"
                label="Light"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
              <LogoSlot
                clientId={clientId}
                slotKey="dark"
                label="Dark"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
            </div>
            <div className="bk-logo-row">
              <LogoSlot
                clientId={clientId}
                slotKey="icon"
                label="Icon"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
              <LogoSlot
                clientId={clientId}
                slotKey="secondary"
                label="Secondary"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
              <LogoSlot
                clientId={clientId}
                slotKey="favicon"
                label="Favicon"
                brandKit={brandKit}
                readOnly={readOnly}
                onFilesChange={handleLogoChange}
              />
            </div>
          </div>

          {/* Sync note */}
          <div
            className="bk-sync-note"
            id="bk-hint"
            style={{ marginTop: '12px' }}
          >
            <span className="bk-sync-dot"></span>
            The <strong>Full Color</strong> PNG or SVG is used in invoice headers and PDF exports. Source files (AI, EPS)
            are available for download only.
          </div>
        </div>

        {/* Three-column layout: Color Palette, Typography, Brand Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div className="bk-card">
            <div className="bk-section-title">Color Palette</div>
            <ColorPalette
              colors={brandKit.colors || []}
              readOnly={readOnly}
              onColorsChange={handleColorChange}
            />
          </div>
          <div className="bk-card">
            <div className="bk-section-title">Typography</div>
            <Typography
              fonts={brandKit.fonts}
              readOnly={readOnly}
              onFontChange={handleFontChange}
            />
          </div>
          <div className="bk-card">
            <div className="bk-section-title">Brand Notes</div>
            <BrandNotes
              notes={brandKit.notes || ''}
              readOnly={readOnly}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      </div>
      </BrandKitErrorBoundary>
    </div>
  );
}
