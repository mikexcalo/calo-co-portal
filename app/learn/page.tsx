'use client';

/**
 * What the product does, and how to use it.
 *
 * Features kept shipping and never being found: knowing that a preview link
 * takes comments requires somebody to have told you. The explanation lived in
 * a chat window, scrolled away, and got typed again slightly differently.
 *
 * A module rather than a help panel, because it is also what a client gets on
 * the day they are handed a login. Training and enablement are the same
 * problem seen from two sides.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEARN_AREAS, LESSONS } from '@/lib/spine/learn';
import { TOURS } from '@/lib/spine/tours';
import { startTour } from '@/components/spine/TourRunner';
import { Button, C, Card, Empty, Page, inputStyle } from '@/components/spine/ui';

export default function LearnPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<string | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return LESSONS.filter((l) => {
      if (area !== 'all' && l.area !== area) return false;
      if (!t) return true;
      return `${l.title} ${l.summary} ${l.body.join(' ')} ${l.area}`.toLowerCase().includes(t);
    });
  }, [q, area]);

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        border: `1px solid ${on ? C.accent : C.border}`,
        background: on ? C.accentSoft : 'transparent',
        color: on ? C.text : C.faint,
        borderRadius: 999, padding: '4px 13px', fontSize: 12.5,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <Page title="Learn" subtitle="What this can do, and how.">
      {/*
        Walkthroughs first.

        Reading about a screen is a poor second to standing on it. These take
        you through the real product with your own data, and they are timed, so
        "how long does onboarding take" has a measured answer.
      */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
        {TOURS.map((t) => (
          <Card key={t.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                    fontSize: 15, fontWeight: 600, color: C.text,
                  }}
                >
                  {t.title}
                </div>
                <div style={{ fontSize: 13, color: C.faint, marginTop: 2, lineHeight: 1.55 }}>
                  {t.summary}
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
                  {t.steps.length} steps · for {t.who.toLowerCase()}
                </div>
              </div>
              <Button onClick={() => startTour(t.id)}>Walk me through it</Button>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {chip('All', area === 'all', () => setArea('all'))}
        {LEARN_AREAS.map((a) => chip(a, area === a, () => setArea(a)))}
        <span style={{ flex: 1 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          style={{ ...inputStyle, maxWidth: 200, padding: '5px 11px', fontSize: 13 }}
        />
      </div>

      {shown.length === 0 ? (
        <Card><Empty>Nothing on that yet.</Empty></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {shown.map((l) => {
            const isOpen = open === l.id;
            return (
              <Card key={l.id}>
                <div
                  onClick={() => setOpen(isOpen ? null : l.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
                        fontSize: 15, fontWeight: 600, color: C.text,
                      }}
                    >
                      {l.title}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.faint }}>{l.area}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Close' : 'Read'}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: C.faint, marginTop: 3, lineHeight: 1.55 }}>
                    {l.summary}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 14 }}>
                    {l.body.map((para, i) => (
                      <p key={i} style={{ fontSize: 14, color: C.dim, lineHeight: 1.7, margin: '0 0 11px', maxWidth: '70ch' }}>
                        {para}
                      </p>
                    ))}

                    {l.caveat && (
                      <div
                        style={{
                          fontSize: 12.5, color: C.amber, lineHeight: 1.6,
                          padding: '9px 12px', borderRadius: 8, margin: '4px 0 12px',
                          background: C.amberSoft, border: `1px solid ${C.amber}44`,
                          maxWidth: '70ch',
                        }}
                      >
                        {l.caveat}
                      </div>
                    )}

                    {l.href && (
                      <Button variant="ghost" onClick={() => router.push(l.href as string)}>
                        Go there
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
