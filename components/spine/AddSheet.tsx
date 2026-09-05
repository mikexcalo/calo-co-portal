'use client';

/**
 * What "+ Add" opens on a phone.
 *
 * Every intake route in the product, one tap from anywhere, in the order a
 * contractor actually reaches for them. Photographing a receipt is first
 * because it happens in a merchant's car park with the engine running, and
 * every second between the thought and the camera is a receipt that ends up
 * in the glovebox instead.
 *
 * A sheet rather than a menu: it comes up from the bottom, where the thumb
 * already is, and the targets are big enough to hit without looking.
 */

import { useRouter } from 'next/navigation';
import { C, radius } from './ui';

interface Item {
  label: string;
  detail: string;
  href: string;
  glyph: React.ReactNode;
}

const g = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export function AddSheet({
  onClose,
  vocab,
}: {
  onClose: () => void;
  vocab: { job: string; customer: string };
}) {
  const router = useRouter();

  const items: Item[] = [
    {
      label: 'Photograph a receipt',
      detail: 'It becomes a job cost',
      href: '/documents',
      glyph: g(<><path d="M2 5.2h2.6l1-1.6h4.8l1 1.6H14v7.4H2z" /><circle cx="8" cy="8.6" r="2.2" /></>),
    },
    {
      label: `New ${vocab.job.toLowerCase()}`,
      detail: 'A lead or a booked job',
      href: '/jobs/new',
      glyph: g(<><rect x="2.2" y="2" width="11.6" height="7.2" rx="1.1" /><path d="M8 9.2V14" /><path d="M5.6 14h4.8" /></>),
    },
    {
      label: `New ${vocab.customer.toLowerCase()}`,
      detail: 'Someone you just met',
      href: '/customers',
      glyph: g(<><path d="M2.2 11.4a5.8 5.8 0 0 1 11.6 0" /><path d="M6.2 6.1V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v2.7" /></>),
    },
    {
      label: 'Write a note',
      detail: 'What was just said',
      href: '/notes',
      glyph: g(<><path d="M3.2 2.2h9.6v11.6H3.2z" /><path d="M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3" /></>),
    },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(12,16,22,.5)', zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-label="Add something"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          background: C.panel,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '10px 12px calc(18px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -12px 34px rgba(0,0,0,.16)',
        }}
      >
        {/* The grab handle every phone sheet has. It says "this came from the
            bottom and goes back there" without a word of explanation. */}
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            background: C.border,
            margin: '0 auto 14px',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((i) => (
            <button
              key={i.href + i.label}
              onClick={() => {
                onClose();
                router.push(i.href);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderRadius: 999,
                padding: '14px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: 56,
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: 10,
                  background: C.accentSoft,
                  color: C.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i.glyph}
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 500, color: C.text }}>
                  {i.label}
                </span>
                <span style={{ display: 'block', fontSize: 13.5, color: C.faint, marginTop: 1 }}>
                  {i.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
