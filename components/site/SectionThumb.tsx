'use client';

/**
 * What a section looks like, at a glance.
 *
 * The module listed sections by name, so choosing between Grid and Stacked, or
 * finding the one you meant in a list of six, meant opening each in turn and
 * reading the fields. A wireframe answers it without a click.
 *
 * Deliberately a diagram rather than a rendered miniature. A real render at
 * this size is an unreadable grey smear, and the thing you are actually asking
 * is "which shape is this", which lines and blocks answer better than type
 * nobody can read.
 */

import { C } from '@/components/spine/ui';

const bar = (w: string, h: number, tone: 'ink' | 'mid' | 'faint' = 'mid') => ({
  width: w,
  height: h,
  borderRadius: h > 5 ? 3 : 2,
  background: tone === 'ink' ? C.text : tone === 'mid' ? C.borderStrong : C.border,
});

export function SectionThumb({ kind, variant }: { kind: string; variant: string }) {
  const frame: React.CSSProperties = {
    width: 96,
    height: 62,
    flexShrink: 0,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.panel,
    padding: 7,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflow: 'hidden',
  };

  const centered: React.CSSProperties = { alignItems: 'center', justifyContent: 'center' };

  if (kind === 'hero') {
    if (variant === 'split') {
      return (
        <div style={{ ...frame, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={bar('100%', 7, 'ink')} />
            <div style={bar('80%', 3)} />
            <div style={{ ...bar('44%', 8, 'ink'), borderRadius: 999, marginTop: 2 }} />
          </div>
          <div style={{ width: 34, height: '100%', borderRadius: 4, background: C.panelAlt }} />
        </div>
      );
    }
    return (
      <div style={{ ...frame, ...centered }}>
        <div style={bar('78%', 8, 'ink')} />
        <div style={bar('56%', 3)} />
        <div style={{ ...bar('38%', 8, 'ink'), borderRadius: 999, marginTop: 3 }} />
      </div>
    );
  }

  if (kind === 'proof') {
    if (variant === 'quote') {
      return (
        <div style={{ ...frame, ...centered }}>
          <div style={bar('86%', 4)} />
          <div style={bar('72%', 4)} />
          <div style={{ ...bar('30%', 3, 'faint'), marginTop: 4 }} />
        </div>
      );
    }
    if (variant === 'numbers') {
      return (
        <div style={{ ...frame, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              <div style={bar('16px', 9, 'ink')} />
              <div style={bar('22px', 2, 'faint')} />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ ...frame, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
        {[0, 1, 2].map((i) => <div key={i} style={bar('20px', 5)} />)}
      </div>
    );
  }

  if (kind === 'services' || kind === 'principles') {
    const cols = variant === 'stack' || variant === 'list' ? 1 : 2;
    return (
      <div style={frame}>
        <div style={bar('64%', 6, 'ink')} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, marginTop: 2 }}>
          {Array.from({ length: cols === 1 ? 3 : 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={bar('80%', 3, 'ink')} />
              <div style={bar('100%', 2, 'faint')} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'founder') {
    if (variant === 'letter') {
      return (
        <div style={frame}>
          <div style={bar('40%', 6, 'ink')} />
          <div style={bar('100%', 2, 'faint')} />
          <div style={bar('92%', 2, 'faint')} />
          <div style={bar('74%', 2, 'faint')} />
        </div>
      );
    }
    return (
      <div style={{ ...frame, flexDirection: 'row', gap: 6 }}>
        <div style={{ width: 22, height: 30, borderRadius: 4, background: C.panelAlt, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={bar('70%', 5, 'ink')} />
          <div style={bar('100%', 2, 'faint')} />
          <div style={bar('86%', 2, 'faint')} />
        </div>
      </div>
    );
  }

  if (kind === 'contact') {
    return (
      <div style={{ ...frame, ...centered }}>
        <div style={bar('62%', 7, 'ink')} />
        <div style={bar('44%', 2, 'faint')} />
        <div
          style={{
            ...bar('40%', 9, variant === 'email' ? 'faint' : 'ink'),
            borderRadius: 999,
            marginTop: 3,
            border: variant === 'email' ? `1px solid ${C.text}` : undefined,
            background: variant === 'email' ? 'transparent' : C.text,
          }}
        />
      </div>
    );
  }

  return <div style={frame} />;
}
