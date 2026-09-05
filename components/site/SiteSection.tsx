/**
 * The templates. Code, written once, reused for every site.
 *
 * This file is the whole reason the fifth client's site costs a fraction of
 * the first: their hero is a row in a table, and this is what draws it.
 *
 * Deliberately plain markup with no dependency on the app's own styling, since
 * these render on a public page that has none of it loaded. Set in the site's
 * own faces rather than the platform's, because what you are reviewing is the
 * website, not the tool.
 */

import type { CSSProperties } from 'react';

const INK = '#141414';
const MUTED = '#5B6069';
const LINE = '#E7E8EB';

const DISPLAY = "'Ancizar Serif', Georgia, 'Times New Roman', serif";
const BODY = "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif";

const wrap: CSSProperties = { maxWidth: 1040, margin: '0 auto', padding: '0 24px' };
const lines = (s?: string) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

export function SiteSection({
  kind,
  variant,
  data,
}: {
  kind: string;
  variant: string;
  data: Record<string, string>;
}) {
  const d = (k: string) => (data[k] ?? '').trim();

  /* ------------------------------------------------------------------ hero */
  if (kind === 'hero') {
    const split = variant === 'split' && d('image');
    return (
      <section style={{ ...wrap, padding: '84px 24px 64px', fontFamily: BODY }}>
        <div
          style={{
            display: split ? 'grid' : 'block',
            gridTemplateColumns: split ? 'minmax(0,1.05fr) minmax(0,.95fr)' : undefined,
            gap: 48, alignItems: 'center',
            textAlign: split ? 'left' : 'center',
          }}
        >
          <div>
            {d('eyebrow') && (
              <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 18 }}>
                {d('eyebrow')}
              </div>
            )}
            <h1
              style={{
                fontFamily: DISPLAY, fontSize: 'clamp(34px, 5.3vw, 63px)',
                lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, color: INK,
                maxWidth: split ? undefined : '18ch',
                marginLeft: split ? undefined : 'auto', marginRight: split ? undefined : 'auto',
              }}
            >
              {d('headline') || 'Your headline'}
            </h1>
            {d('sub') && (
              <p
                style={{
                  fontSize: 17, lineHeight: 1.6, color: MUTED, margin: '20px 0 0',
                  maxWidth: '46ch',
                  marginLeft: split ? undefined : 'auto', marginRight: split ? undefined : 'auto',
                }}
              >
                {d('sub')}
              </p>
            )}
            {d('cta') && (
              <a
                href={d('cta_url') || '#'}
                style={{
                  display: 'inline-block', marginTop: 28, background: INK, color: '#fff',
                  padding: '12px 26px', borderRadius: 999, fontSize: 15, textDecoration: 'none',
                }}
              >
                {d('cta')}
              </a>
            )}
          </div>
          {split && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={d('image')} alt="" style={{ width: '100%', borderRadius: 14, display: 'block' }} />
          )}
        </div>
      </section>
    );
  }

  /* ----------------------------------------------------------------- proof */
  if (kind === 'proof') {
    const items = lines(d('items'));
    return (
      <section style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, fontFamily: BODY }}>
        <div style={{ ...wrap, padding: '40px 24px' }}>
          {d('heading') && (
            <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 22, textAlign: 'center' }}>
              {d('heading')}
            </div>
          )}

          {variant === 'quote' ? (
            <figure style={{ margin: 0, textAlign: 'center', maxWidth: '60ch', marginInline: 'auto' }}>
              <blockquote style={{ fontFamily: DISPLAY, fontSize: 25, lineHeight: 1.45, margin: 0, color: INK }}>
                {d('quote') || 'What one client said.'}
              </blockquote>
              {d('attribution') && (
                <figcaption style={{ fontSize: 13.5, color: MUTED, marginTop: 14 }}>{d('attribution')}</figcaption>
              )}
            </figure>
          ) : variant === 'numbers' ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 26, textAlign: 'center' }}>
              {items.map((it, i) => {
                const [big, ...rest] = it.split('·').map((x) => x.trim());
                return (
                  <div key={i}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 36, color: INK, lineHeight: 1 }}>{big}</div>
                    <div style={{ fontSize: 13.5, color: MUTED, marginTop: 7 }}>{rest.join(' · ')}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {items.map((it, i) => (
                <span key={i} style={{ fontSize: 16, color: MUTED, letterSpacing: '.01em' }}>{it}</span>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  /* -------------------------------------------------------------- services */
  if (kind === 'services') {
    const items = lines(d('items'));
    const grid = variant !== 'stack';
    return (
      <section style={{ ...wrap, padding: '72px 24px', fontFamily: BODY }}>
        {d('heading') && (
          <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(26px,3.4vw,38px)', margin: 0, color: INK, letterSpacing: '-0.015em' }}>
            {d('heading')}
          </h2>
        )}
        {d('intro') && (
          <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6, margin: '14px 0 0', maxWidth: '52ch' }}>{d('intro')}</p>
        )}
        <div
          style={{
            display: 'grid', marginTop: 34, gap: grid ? 26 : 20,
            gridTemplateColumns: grid ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
          }}
        >
          {items.map((it, i) => {
            const [title, ...rest] = it.split('·').map((x) => x.trim());
            return (
              <div key={i} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
                <div style={{ fontSize: 17, color: INK, fontWeight: 500 }}>{title}</div>
                {rest.length > 0 && (
                  <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, marginTop: 7 }}>{rest.join(' · ')}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------------- founder */
  if (kind === 'founder') {
    const portrait = variant === 'portrait' && d('image');
    return (
      <section style={{ background: '#FAFAFB', borderTop: `1px solid ${LINE}`, fontFamily: BODY }}>
        <div
          style={{
            ...wrap, padding: '68px 24px',
            display: portrait ? 'grid' : 'block',
            gridTemplateColumns: portrait ? '200px minmax(0,1fr)' : undefined,
            gap: 40, alignItems: 'start',
          }}
        >
          {portrait && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={d('image')} alt={d('name')} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
          )}
          <div style={{ maxWidth: '58ch' }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 24, color: INK }}>{d('name') || 'Who you are'}</div>
            {d('role') && <div style={{ fontSize: 13.5, color: MUTED, marginTop: 3 }}>{d('role')}</div>}
            {d('body') && (
              <p style={{ fontSize: 16.5, lineHeight: 1.7, color: INK, marginTop: 18, whiteSpace: 'pre-line' }}>{d('body')}</p>
            )}
            {d('link') && (
              <a href={d('link')} style={{ display: 'inline-block', marginTop: 16, fontSize: 15, color: INK }}>
                More about {d('name') || 'them'} →
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------ principles */
  if (kind === 'principles') {
    const items = lines(d('items'));
    const grid = variant !== 'list';
    return (
      <section style={{ background: '#FAFAFB', borderTop: `1px solid ${LINE}`, fontFamily: BODY }}>
        <div style={{ ...wrap, padding: '72px 24px' }}>
          {d('heading') && (
            <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(26px,3.4vw,38px)', margin: 0, color: INK, letterSpacing: '-0.015em', maxWidth: '20ch' }}>
              {d('heading')}
            </h2>
          )}
          {d('intro') && (
            <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6, margin: '14px 0 0' }}>{d('intro')}</p>
          )}
          <div
            style={{
              display: 'grid', marginTop: 34, gap: 26,
              gridTemplateColumns: grid ? 'repeat(auto-fit, minmax(230px, 1fr))' : '1fr',
            }}
          >
            {items.map((it, i) => {
              const [title, ...rest] = it.split('·').map((x) => x.trim());
              return (
                <div key={i}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 19, color: INK }}>{title}</div>
                  {rest.length > 0 && (
                    <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, marginTop: 8 }}>{rest.join(' · ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------------- contact */
  if (kind === 'contact') {
    return (
      <section style={{ borderTop: `1px solid ${LINE}`, fontFamily: BODY }}>
        <div style={{ ...wrap, padding: '76px 24px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(28px,3.8vw,44px)', margin: 0, color: INK, letterSpacing: '-0.015em' }}>
            {d('heading') || 'Start here'}
          </h2>
          {d('sub') && (
            <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6, margin: '16px auto 0', maxWidth: '44ch' }}>{d('sub')}</p>
          )}
          {d('cta') && (
            <a
              href={d('cta_url') || '#'}
              style={{
                display: 'inline-block', marginTop: 26,
                background: variant === 'email' ? 'transparent' : INK,
                color: variant === 'email' ? INK : '#fff',
                border: variant === 'email' ? `1px solid ${INK}` : 'none',
                padding: '12px 26px', borderRadius: 999, fontSize: 15, textDecoration: 'none',
              }}
            >
              {d('cta')}
            </a>
          )}
        </div>
      </section>
    );
  }

  return null;
}
