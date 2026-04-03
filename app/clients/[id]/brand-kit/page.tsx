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
import { PageLayout, Section, InfoBar } from '@/components/shared/PageLayout';

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
        const hasBk = DB.clients.some((c) => c.brandKit?._id);
        if (!hasBk) await loadAllBrandKits();

        const cl = DB.clients.find((c) => c.id === clientId);
        if (!cl) { setError('Client not found'); setLoading(false); return; }

        setClient(cl);
        const bk = cl.brandKit || {
          _id: null,
          logos: { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] },
          colors: [], fonts: { heading: '', body: '', accent: '' }, notes: '',
        };
        if (!bk.logos) bk.logos = { light: [], dark: [], color: [], icon: [], secondary: [], favicon: [] };
        if (!bk.logos.light) bk.logos.light = [];
        if (!bk.logos.dark) bk.logos.dark = [];
        if (!bk.logos.color) bk.logos.color = [];
        if (!bk.logos.icon) bk.logos.icon = [];
        if (!bk.logos.secondary) bk.logos.secondary = [];
        if (!bk.logos.favicon) bk.logos.favicon = [];
        if (!bk.colors) { bk.colors = []; }
        else if (!Array.isArray(bk.colors)) {
          try { bk.colors = typeof bk.colors === 'string' ? JSON.parse(bk.colors) : []; } catch { bk.colors = []; }
        }
        bk.colors = bk.colors.map((c: any) => typeof c === 'string' ? c : c?.hex || '#000000');
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
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24);
    pdf.text(`${name} — Brand Guide`, 50, y); y += 36;
    if (brandKit.colors.length > 0) {
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
      pdf.text('Color Palette', 50, y); y += 20;
      brandKit.colors.forEach((c, i) => {
        const hex = typeof c === 'string' ? c : (c as any).hex || '#000';
        pdf.setFillColor(hex); pdf.rect(50 + i * 60, y, 50, 30, 'F');
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
        pdf.setTextColor('#334155'); pdf.text(hex, 50 + i * 60, y + 42);
      });
      y += 60;
    }
    pdf.setTextColor('#1a1f2e'); pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
    pdf.text('Typography', 50, y); y += 18;
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
    if (brandKit.fonts.heading) { pdf.text(`Heading: ${brandKit.fonts.heading}`, 50, y); y += 14; }
    if (brandKit.fonts.body) { pdf.text(`Body: ${brandKit.fonts.body}`, 50, y); y += 14; }
    if (brandKit.fonts.accent) { pdf.text(`Accent: ${brandKit.fonts.accent}`, 50, y); y += 14; }
    y += 12;
    if (brandKit.notes) {
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
      pdf.text('Brand Notes', 50, y); y += 18;
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      pdf.text(pdf.splitTextToSize(brandKit.notes, 500), 50, y);
    }
    pdf.save(`${name} - Brand Guide.pdf`);
  };

  if (loading) return <div style={{ padding: 32, color: '#6b7280', fontSize: 13 }}>Loading Brand Kit...</div>;
  if (error || !client || !brandKit) return <div style={{ padding: 32, color: '#ef4444', fontSize: 13 }}>{error || 'Brand Kit not found'}</div>;

  return (
    <PageLayout
      title="Brand Kit"
      subtitle={client.company || client.name}
      action={!readOnly ? (
        <button onClick={handleExportPDF} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#374151',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          Export PDF
        </button>
      ) : undefined}
    >
      {readOnly && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a',
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          padding: '8px 12px', marginBottom: 20,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Read-only view — contact CALO&CO to update brand assets
        </div>
      )}

      <BrandKitErrorBoundary clientId={clientId} clientName={client.company || client.name}>
        {/* Logo Suite */}
        <Section label="Logo Suite">
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <LogoSlot clientId={clientId} slotKey="color" label="Full Color" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              <LogoSlot clientId={clientId} slotKey="light" label="Light" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              <LogoSlot clientId={clientId} slotKey="dark" label="Dark" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <LogoSlot clientId={clientId} slotKey="icon" label="Icon" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              <LogoSlot clientId={clientId} slotKey="secondary" label="Secondary" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
              <LogoSlot clientId={clientId} slotKey="favicon" label="Favicon" brandKit={brandKit} readOnly={readOnly} onFilesChange={handleLogoChange} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              Full Color PNG/SVG is used in invoice headers and PDF exports.
            </div>
          </div>
        </Section>

        {/* Colors, Typography, Notes — 3 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Section label="Colors">
            <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <ColorPalette colors={brandKit.colors || []} readOnly={readOnly} onColorsChange={handleColorChange} />
            </div>
          </Section>
          <Section label="Typography">
            <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <Typography fonts={brandKit.fonts} readOnly={readOnly} onFontChange={handleFontChange} />
            </div>
          </Section>
          <Section label="Notes">
            <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <BrandNotes notes={brandKit.notes || ''} readOnly={readOnly} onNotesChange={handleNotesChange} />
            </div>
          </Section>
        </div>
      </BrandKitErrorBoundary>
    </PageLayout>
  );
}
