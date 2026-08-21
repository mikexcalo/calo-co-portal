'use client';

import { useState } from 'react';
import { useOrg } from '@/lib/spine/org';
import { C } from './ui';

/**
 * Which business am I looking at right now.
 *
 * Deliberately prominent and always visible — the single most dangerous
 * mistake in a multi-business tool is logging Mammoth's hours against a
 * CALO&CO engagement because you didn't notice which one was active.
 */
export function OrgSwitcher() {
  const { org, orgs, loading, switchOrg } = useOrg();
  const [open, setOpen] = useState(false);

  if (loading || !org) return null;

  const single = orgs.length <= 1;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !single && setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '9px 12px',
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: C.panelAlt,
          color: C.text,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: single ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: org.kind === 'agency' ? C.blue : C.green,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {org.name}
        </span>
        {!single && <span style={{ color: C.faint, fontSize: 10 }}>▾</span>}
      </button>

      {open && !single && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 4,
              zIndex: 41,
              boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            }}
          >
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setOpen(false);
                  if (o.id !== org.id) switchOrg(o.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: o.id === org.id ? '#ffffff0d' : 'transparent',
                  color: o.id === org.id ? C.text : C.dim,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: o.kind === 'agency' ? C.blue : C.green,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{o.name}</span>
                <span style={{ fontSize: 10, color: C.faint }}>
                  {o.kind === 'agency' ? 'Agency' : 'Contractor'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
