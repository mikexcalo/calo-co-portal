/**
 * The card, as somebody who just met you sees it.
 *
 * One screen, read on a phone, held in a hand five seconds after a handshake.
 * So: who you are, one action, and the ways to reach you underneath. Nothing
 * that needs scrolling to understand and nothing that asks them to decide.
 *
 * SAVE COMES FIRST
 *
 * The whole point of a card is ending up in their phone. Everything else is
 * secondary to that one tap, which is why it is the darkest thing on the page
 * and why the file is generated rather than linked: a vCard downloaded from a
 * URL opens straight into Contacts on both phones.
 */

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Link { label: string; url: string }

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const card = await read(params.slug);
  if (!card) return { title: 'Card' };
  return {
    title: `${card.name}${card.company ? ` · ${card.company}` : ''}`,
    description: card.tagline ?? undefined,
  };
}

async function read(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  const db = createClient(url, service, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
  const { data } = await db
    .from('cards')
    .select('slug, name, title, company, email, phone, website, photo_url, tagline, cta_label, cta_url, links, live')
    .eq('slug', slug)
    .eq('live', true)
    .maybeSingle();
  if (data) await db.rpc('note_card_scan', { card_slug: slug });
  return data;
}

export default async function CardPage({ params }: { params: { slug: string } }) {
  const card = await read(params.slug);

  if (!card) {
    return (
      <main style={S.page}>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={S.name}>Nothing here</div>
          <p style={S.tagline}>That card does not exist, or has been taken down.</p>
        </div>
      </main>
    );
  }

  const links = (card.links ?? []) as Link[];
  const initials = card.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <main style={S.page}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"
      />

      <div style={S.card}>
        {card.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={card.photo_url} alt={card.name} style={S.photo} />
        ) : (
          <div style={{ ...S.photo, ...S.initials }}>{initials}</div>
        )}

        <h1 style={S.name}>{card.name}</h1>
        {(card.title || card.company) && (
          <div style={S.role}>
            {[card.title, card.company].filter(Boolean).join(' · ')}
          </div>
        )}
        {card.tagline && <p style={S.tagline}>{card.tagline}</p>}

        {/* The one tap this page exists for. */}
        <a href={`/api/card/vcf?slug=${encodeURIComponent(card.slug)}`} style={S.primary}>
          Save to contacts
        </a>

        {card.cta_label && card.cta_url && (
          <a href={card.cta_url} style={S.secondary}>{card.cta_label}</a>
        )}

        <div style={S.rows}>
          {card.phone && <Row label="Call" value={card.phone} href={`tel:${card.phone.replace(/[^\d+]/g, '')}`} />}
          {card.email && <Row label="Email" value={card.email} href={`mailto:${card.email}`} />}
          {card.website && (
            <Row
              label="Site"
              value={card.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              href={card.website}
            />
          )}
          {links.map((l) => (
            <Row key={l.url} label={l.label} value="Open" href={l.url} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a href={href} style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
      <span style={S.chev}>›</span>
    </a>
  );
}

const FONT = "'Figtree', ui-sans-serif, system-ui, -apple-system, sans-serif";

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: '#F4F5F6',
    color: '#141414',
    fontFamily: FONT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 18px 40px',
    margin: 0,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#FFFFFF',
    border: '1px solid #E7E8EB',
    borderRadius: 20,
    padding: '30px 24px 22px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
  },
  photo: {
    width: 92, height: 92, borderRadius: '50%',
    objectFit: 'cover', margin: '0 auto 16px', display: 'block',
    border: '1px solid #E7E8EB',
  },
  initials: {
    background: '#141414', color: '#FFFFFF',
    display: 'grid', placeItems: 'center',
    fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
  },
  name: { fontSize: 25, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 },
  role: { fontSize: 14.5, color: '#5B6069', marginTop: 5 },
  tagline: { fontSize: 14.5, color: '#8A9099', margin: '12px 0 0', lineHeight: 1.5 },
  primary: {
    display: 'block', marginTop: 22,
    background: '#141414', color: '#FFFFFF',
    padding: '14px 20px', borderRadius: 999,
    fontSize: 16, fontWeight: 600, textDecoration: 'none',
  },
  secondary: {
    display: 'block', marginTop: 10,
    background: 'transparent', color: '#141414',
    border: '1px solid #141414',
    padding: '13px 20px', borderRadius: 999,
    fontSize: 15.5, fontWeight: 500, textDecoration: 'none',
  },
  rows: { marginTop: 22, borderTop: '1px solid #E7E8EB' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '13px 2px', borderBottom: '1px solid #E7E8EB',
    textDecoration: 'none', color: '#141414', textAlign: 'left',
  },
  rowLabel: { fontSize: 12.5, color: '#8A9099', width: 52, flexShrink: 0 },
  rowValue: { fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chev: { color: '#C7CAD0', fontSize: 20, lineHeight: 1 },
};
