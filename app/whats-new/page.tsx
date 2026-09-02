'use client';

/**
 * Everything that exists, and where it is.
 *
 * Not a changelog. Enough has shipped in a short time that finding a thing is
 * now harder than using it, and somebody who cannot find a feature has the
 * same experience as somebody who does not have it.
 *
 * The sell line under some of them is deliberate. Half of what is here is also
 * something to charge for, and the sentence that makes it worth paying for is
 * easier to write while the thing is fresh than three months later.
 */

import { useRouter } from 'next/navigation';
import { SHIPPED } from '@/lib/spine/shipped';
import { C, Card, Page, SectionLabel } from '@/components/spine/ui';

export default function WhatsNewPage() {
  const router = useRouter();
  const total = SHIPPED.reduce((n, g) => n + g.items.length, 0);

  return (
    <Page
      title="Everything in here"
      subtitle={`${total} things, where to find them, and which ones are worth charging for.`}
    >
      {SHIPPED.map((g) => (
        <div key={g.group} style={{ marginBottom: 28 }}>
          <SectionLabel>{g.group}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map((i) => (
              <Card key={i.name}>
                <div
                  onClick={() => i.href && router.push(i.href)}
                  style={{ cursor: i.href ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{i.name}</span>
                    <span style={{ fontSize: 12.5, color: C.faint }}>{i.where}</span>
                  </div>
                  <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, margin: '6px 0 0', maxWidth: 680 }}>
                    {i.what}
                  </p>
                  {i.sells && (
                    <div
                      style={{
                        fontSize: 13, color: C.blue, marginTop: 8,
                        paddingLeft: 11, borderLeft: `2px solid ${C.accentSoft}`, lineHeight: 1.6,
                      }}
                    >
                      {i.sells}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </Page>
  );
}
