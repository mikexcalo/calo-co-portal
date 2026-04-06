'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Client } from '@/lib/types';
import { DB, loadClients, loadAllBrandKits, saveBrandKit } from '@/lib/database';
import { PageLayout } from '@/components/shared/PageLayout';
import BrandKit from '@/components/shared/BrandKit';
import { useTheme } from '@/lib/theme';
import HelmSpinner from '@/components/shared/HelmSpinner';

export default function BrandKitPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><BrandKitPageContent /></Suspense>;
}

function BrandKitPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();
  const clientId = params.id as string;
  const viewMode = searchParams.get('viewMode') || 'edit';
  const readOnly = viewMode === 'view';

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (DB.clientsState !== 'loaded') await loadClients();
      if (!DB.clients.some((c) => c.brandKit?._id)) await loadAllBrandKits();
      const cl = DB.clients.find((c) => c.id === clientId);
      if (cl) setClient(cl); else router.push('/');
      setLoading(false);
    };
    load();
  }, [clientId, router]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 96px)' }}><HelmSpinner size={32} /></div>;
  if (!client) return <div style={{ padding: 32, fontSize: 13, color: t.status.danger }}>Client not found</div>;

  const handleExportPDF = async () => {
    const bk = client.brandKit;
    if (!bk) return;
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const name = client.company || client.name || 'Client';
    let y = 50;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24);
    pdf.text(`${name} — Brand Guide`, 50, y); y += 36;
    if (bk.colors?.length > 0) {
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
      pdf.text('Color Palette', 50, y); y += 20;
      bk.colors.forEach((c, i) => {
        const hex = typeof c === 'string' ? c : '#000';
        pdf.setFillColor(hex); pdf.rect(50 + i * 60, y, 50, 30, 'F');
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
        pdf.setTextColor('#334155'); pdf.text(hex, 50 + i * 60, y + 42);
      });
      y += 60;
    }
    pdf.setTextColor('#1a1f2e');
    if (bk.fonts?.heading) { pdf.setFontSize(10); pdf.text(`Heading: ${bk.fonts.heading}`, 50, y); y += 14; }
    if (bk.fonts?.body) { pdf.text(`Body: ${bk.fonts.body}`, 50, y); y += 14; }
    pdf.save(`${name} - Brand Guide.pdf`);
  };

  return (
    <PageLayout
      title="Brand Kit"
      subtitle={client.company || client.name}
      action={!readOnly ? (
        <button onClick={handleExportPDF} style={{
          background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
          padding: '6px 14px', fontSize: 13, fontWeight: 500, color: t.text.primary,
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surface}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Export PDF
        </button>
      ) : undefined}
    >
      <BrandKit context={{ type: 'client', clientId }} readOnly={readOnly} />
    </PageLayout>
  );
}
