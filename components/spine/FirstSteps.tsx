'use client';

/**
 * What to do here, the first time you stand here.
 *
 * An empty screen that says "no clients yet" is a statement, not an
 * invitation. It is true, it is useless, and it is the moment somebody who
 * was handed a login decides this is not for them — which is exactly what
 * happened when Marcie landed and wrote in to say she did not know what she
 * was meant to do first.
 *
 * Shown only while the module really is empty, so nobody is taught twice.
 */

import { useRouter } from 'next/navigation';
import { Button, C, Card } from './ui';

export interface FirstStepsCopy {
  title: string;
  /** One line on why this screen is worth anything. */
  blurb: string;
  /** Two or three, in the order somebody would actually do them. */
  steps: string[];
  action?: { label: string; href: string };
}

export function FirstSteps({ copy }: { copy: FirstStepsCopy }) {
  const router = useRouter();

  return (
    <Card>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>
        {copy.title}
      </div>
      <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.6, margin: '6px 0 14px', maxWidth: '58ch' }}>
        {copy.blurb}
      </p>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {copy.steps.map((step, i) => (
          <li key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                flex: '0 0 auto', width: 20, height: 20, borderRadius: 999,
                border: `1px solid ${C.border}`, color: C.faint,
                fontSize: 11.5, display: 'grid', placeItems: 'center', marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 14, color: C.dim, lineHeight: 1.55, maxWidth: '56ch' }}>{step}</span>
          </li>
        ))}
      </ol>

      {copy.action && (
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => router.push(copy.action!.href)}>{copy.action.label}</Button>
        </div>
      )}
    </Card>
  );
}
