'use client';

/**
 * The email signature, inside Brand.
 *
 * It used to be its own page at /signature, mapped to the `pitches` module,
 * which meant a workspace with pitches switched off had a signature builder
 * it could not reach and a Brand screen that did not mention signatures. A
 * signature is the brand, applied: the logo, the dark color and the business
 * name, arranged for the one surface every client uses every day.
 *
 * Nothing here is written for one business. The defaults come from
 * /api/brand/signature, which reads the workspace's own settings and whatever
 * brand kit is linked to it, so the next client gets theirs filled in the same
 * way with no edit here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  SectionLabel,
  Skeleton,
  radius,
} from './ui';
import {
  GMAIL_STEPS,
  SIGNATURE_DEFAULTS,
  bareHost,
  renderSignatureBlock,
  type SignatureInput,
} from '@/lib/spine/signature-block';

interface Defaults {
  business: string;
  person: string;
  dark: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  brandSource: 'brands' | 'settings' | 'none';
}

export function SignatureTab() {
  const [d, setD] = useState<Defaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* All off by default, which is the whole point of them being options. */
  const [showTitle, setShowTitle] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [title, setTitle] = useState<string>(SIGNATURE_DEFAULTS.title);
  /* Editable, because a workspace may never have been asked for its site. */
  const [website, setWebsite] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/brand/signature');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Could not read the brand.');
      setD(payload as Defaults);
      setWebsite(payload.website ? bareHost(String(payload.website)) : '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const html = useMemo(() => {
    if (!d) return '';
    const input: SignatureInput = {
      business: d.business,
      person: d.person,
      logoUrl: d.logoUrl ? absolute(d.logoUrl) : null,
      logoWidth: SIGNATURE_DEFAULTS.logoWidth,
      dark: d.dark,
      phone: d.phone,
      email: d.email,
      website: website.trim() || null,
      showTitle,
      title,
      showCompany,
      showEmail,
    };
    return renderSignatureBlock(input);
  }, [d, showTitle, title, showCompany, showEmail, website]);

  /**
   * Copies what a mail client wants, which is the rendered thing.
   *
   * Putting the markup on the clipboard as text pastes the markup. The
   * clipboard carries both flavours, and every client that matters takes the
   * HTML one.
   */
  const copy = async () => {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([html], { type: 'text/plain' }) }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('The browser would not let us reach the clipboard. Select the preview and copy it by hand.');
    }
  };

  if (loading) return <SignatureWaiting />;
  if (error && !d) return <Card><Empty>{error}</Empty></Card>;
  if (!d) return null;

  const check = (on: boolean, set: (v: boolean) => void, label: string, hint?: string) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontSize: 14.5, color: C.text }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 12.5, color: C.faint, marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
      <Card>
        <SectionLabel>What it says</SectionLabel>
        <p style={{ fontSize: 13.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.6 }}>
          Your name, your number and your website are in every version. The rest
          are yours to turn on.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {check(showTitle, setShowTitle, 'Title', 'Goes under your name.')}
          {showTitle && (
            <div style={{ paddingLeft: 26, maxWidth: 320 }}>
              <Field label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={INPUT}
                />
              </Field>
            </div>
          )}
          {check(showCompany, setShowCompany, 'Company name',
            showTitle ? 'Shares the line with your title.' : `Adds ${d.business}.`)}
          {check(showEmail, setShowEmail, 'Email', d.email ? `Adds ${d.email}.` : 'No email on this workspace yet.')}
        </div>
        <div style={{ marginTop: 14, maxWidth: 320 }}>
          <Field label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="yourbusiness.com"
              style={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionLabel>How it looks</SectionLabel>
        <div
          style={{
            border: `1px solid ${C.border}`, borderRadius: radius.lg,
            padding: 20, background: '#FFFFFF', overflowX: 'auto',
          }}
          /* The preview IS the artefact. Rendering it any other way would be
             a drawing of a signature rather than the signature. */
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Button onClick={copy}>{copied ? 'Copied' : 'Copy signature'}</Button>
          {d.brandSource === 'none' && (
            <span style={{ fontSize: 12.5, color: C.faint }}>
              No brand kit found, so this has no logo yet.
            </span>
          )}
        </div>
        {error && <p style={{ fontSize: 13, color: '#E01B1B', marginTop: 10 }}>{error}</p>}
      </Card>

      <Card>
        <SectionLabel>Putting it in Gmail</SectionLabel>
        {/* The reset in globals.css sets list-style: none on everything, so an
            ordered list of five steps that must be done in order was drawing
            as five unnumbered lines. Asked for back explicitly. */}
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.dim, lineHeight: 1.75, listStyleType: 'decimal' }}>
          {GMAIL_STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </Card>
    </div>
  );
}

/**
 * The tab, before the brand arrives.
 *
 * This was one line of text in an otherwise empty card - "Reading your
 * brand." - sitting alone above a blank screen for as long as the round trip
 * took. A sentence that does not move is indistinguishable from a sentence
 * that is stuck, and it was read as stuck more than once.
 *
 * So it draws the shape it is about to fill: the same three cards, the same
 * widths, the same order. Nothing jumps when the answer lands, and a wait
 * that is merely slow no longer looks like a wait that is over.
 */
function SignatureWaiting() {
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 760 }} role="status" aria-label="Reading your brand">
      <Card>
        <SectionLabel>What it says</SectionLabel>
        <Skeleton w="72%" h={11} style={{ margin: '4px 0 18px' }} />
        <div style={{ display: 'grid', gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Skeleton w={14} h={14} r={3} style={{ marginTop: 2, flex: '0 0 14px' }} />
              <span style={{ display: 'grid', gap: 6, flex: 1 }}>
                <Skeleton w={104} h={11} />
                <Skeleton w="44%" h={9} />
              </span>
            </div>
          ))}
        </div>
        <Skeleton w={320} h={40} r={radius.md} style={{ marginTop: 18, maxWidth: '100%' }} />
      </Card>

      <Card>
        <SectionLabel>How it looks</SectionLabel>
        {/* The preview box at the height a three-line signature draws. */}
        <div
          style={{
            border: `1px solid ${C.border}`, borderRadius: radius.lg,
            padding: 20, background: '#FFFFFF', display: 'flex',
            gap: 14, alignItems: 'center',
          }}
        >
          <Skeleton w={120} h={56} r={radius.sm} />
          <span style={{ display: 'grid', gap: 7, flex: 1, maxWidth: 220 }}>
            <Skeleton w="62%" h={12} />
            <Skeleton w="50%" h={10} />
            <Skeleton w="76%" h={10} />
          </span>
        </div>
        <Skeleton w={148} h={38} r={radius.md} style={{ marginTop: 14 }} />
      </Card>

      <Card>
        <SectionLabel>Putting it in Gmail</SectionLabel>
        <div style={{ display: 'grid', gap: 10 }}>
          {['78%', '86%', '92%', '80%', '58%'].map((w, i) => (
            <Skeleton key={i} w={w} h={11} />
          ))}
        </div>
      </Card>
    </div>
  );
}

const INPUT: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 11px', fontSize: 15, fontFamily: 'inherit',
  border: `1px solid ${C.border}`, borderRadius: radius.md, color: C.text,
  background: '#fff', boxSizing: 'border-box',
};

/** A signature is read far from here, so the logo needs the whole address. */
function absolute(path: string): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
