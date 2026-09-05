'use client';

/**
 * Your card, and the code somebody scans off your screen.
 *
 * A printed QR is still a thing you carry and still points wherever you decided
 * six months ago. Drawn on a screen, it can be held up in a bar, and where it
 * points can change tomorrow without reprinting anything.
 *
 * The QR gets its own full-bleed mode because a phone camera reading a code off
 * another phone needs size and contrast, and a code inside a card, inside a
 * layout, at 180 pixels, is a code that takes four tries in bad light.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { BRAND_TABS, Button, C, Card, Empty, Page, SectionLabel, inputStyle } from '@/components/spine/ui';

interface Link { label: string; url: string }
interface CardRow {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  photo_url: string | null;
  tagline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  links: Link[];
  live: boolean;
  scans: number;
  last_scan: string | null;
}

export default function CardPage() {
  const { org } = useOrg();
  const [row, setRow] = useState<CardRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase
      .from('cards')
      .select('id, slug, name, title, company, email, phone, website, photo_url, tagline, cta_label, cta_url, links, live, scans, last_scan')
      .limit(1)
      .maybeSingle();
    if (res.error) setError(res.error.message);
    else setRow(res.data as CardRow | null);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const url = useMemo(
    () => (row && typeof window !== 'undefined' ? `${window.location.origin}/c/${row.slug}` : ''),
    [row]
  );

  /**
   * Drawn at high error correction and a wide quiet zone.
   *
   * A camera reading this off a glass screen at an angle, under a bar light,
   * has every disadvantage. Correction level H survives glare and a thumb over
   * a corner; the margin stops the screen edge being read as part of the code.
   */
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 1200,
      color: { dark: '#141414', light: '#FFFFFF' },
    }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const patch = (p: Partial<CardRow>) => setRow((r) => (r ? { ...r, ...p } : r));

  const save = async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    const { id, scans, last_scan, ...fields } = row;
    const res = await supabase.from('cards').update(fields).eq('id', id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const create = async () => {
    if (!org) return;
    setBusy(true);
    const res = await supabase.from('cards').insert({
      org_id: org.id,
      slug: org.slug.slice(0, 30),
      name: org.name,
      company: org.name,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    load();
  };

  /* ------------------------------------------------------------ full screen */
  if (full && qr) {
    return (
      <div
        onClick={() => setFull(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 200, background: '#FFFFFF',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 20, cursor: 'pointer', padding: 24,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Scan this" style={{ width: 'min(78vw, 78vh)', maxWidth: 520, imageRendering: 'pixelated' }} />
        <div style={{ fontSize: 15, color: C.text, fontWeight: 500 }}>{row?.name}</div>
        <div style={{ fontSize: 12.5, color: C.faint }}>Tap anywhere to close</div>
      </div>
    );
  }

  return (
    <Page
      title="Card"
      subtitle="A card you hold up instead of hand over."
      tabs={BRAND_TABS}
      action={row ? <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button> : undefined}
    >
      {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>}
      {saved && <div style={{ fontSize: 13, color: C.green, marginBottom: 12 }}>Saved</div>}

      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : !row ? (
        <Card>
          <Empty>No card yet.</Empty>
          <div style={{ marginTop: 12 }}>
            <Button onClick={create} disabled={busy}>Make one</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 20, alignItems: 'start' }}>
          <div>
            <Card style={{ marginBottom: 14 }}>
              <SectionLabel>Who</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Text label="Name" value={row.name} onChange={(v) => patch({ name: v })} />
                <Text label="Title" value={row.title ?? ''} onChange={(v) => patch({ title: v })} />
                <Text label="Company" value={row.company ?? ''} onChange={(v) => patch({ company: v })} />
                <Text label="Photo URL" value={row.photo_url ?? ''} onChange={(v) => patch({ photo_url: v })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <Text label="One line" value={row.tagline ?? ''} onChange={(v) => patch({ tagline: v })} />
              </div>
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <SectionLabel>Reach</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Text label="Email" value={row.email ?? ''} onChange={(v) => patch({ email: v })} />
                <Text label="Phone" value={row.phone ?? ''} onChange={(v) => patch({ phone: v })} />
                <Text label="Website" value={row.website ?? ''} onChange={(v) => patch({ website: v })} />
                <Text label="Address" value={row.slug} onChange={(v) => patch({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
              </div>
            </Card>

            <Card>
              {/* One action, because a card with four buttons is a menu and a
                  menu is a decision somebody makes by leaving. */}
              <SectionLabel>The one thing you want them to do</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <Text label="Button" value={row.cta_label ?? ''} onChange={(v) => patch({ cta_label: v })} />
                <Text label="Goes to" value={row.cta_url ?? ''} onChange={(v) => patch({ cta_url: v })} />
              </div>
            </Card>
          </div>

          <div>
            <Card style={{ textAlign: 'center' }}>
              {qr && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qr}
                  alt="Your card as a QR code"
                  onClick={() => setFull(true)}
                  style={{ width: '100%', maxWidth: 220, cursor: 'pointer', display: 'block', margin: '0 auto' }}
                />
              )}
              <Button onClick={() => setFull(true)}>Show it big</Button>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
                Hold your phone up. They scan it off your screen.
              </div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, color: C.blue }}
              >
                {url.replace(/^https?:\/\//, '')}
              </a>
            </Card>

            <Card style={{ marginTop: 12 }}>
              <SectionLabel>Scans</SectionLabel>
              <div
                style={{
                  fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                  fontSize: 30, fontWeight: 600, color: C.text, lineHeight: 1,
                }}
              >
                {row.scans}
              </div>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>
                {row.last_scan ? `Last one ${row.last_scan.slice(0, 10)}.` : 'Nobody yet.'}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 12, color: C.faint, display: 'block', marginBottom: 3 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}
