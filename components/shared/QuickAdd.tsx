'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';

interface Command {
  id: string;
  label: string;
  section: 'Actions' | 'Navigate';
  action: () => void;
}

export function QuickAdd() {
  const { t } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'add-client', label: 'Add client', section: 'Actions', action: () => { router.push('/clients?action=add'); setOpen(false); } },
    { id: 'add-contact', label: 'Add contact', section: 'Actions', action: () => { router.push('/contacts?action=add-contact'); setOpen(false); } },
    { id: 'drop-notes', label: 'Drop notes (AI batch contacts)', section: 'Actions', action: () => { router.push('/contacts?action=drop-notes'); setOpen(false); } },
    { id: 'go-dashboard', label: 'Go to Dashboard', section: 'Navigate', action: () => { router.push('/'); setOpen(false); } },
    { id: 'go-clients', label: 'Go to Clients', section: 'Navigate', action: () => { router.push('/clients'); setOpen(false); } },
    { id: 'go-contacts', label: 'Go to Contacts', section: 'Navigate', action: () => { router.push('/contacts'); setOpen(false); } },
    { id: 'go-invoices', label: 'Go to Invoices', section: 'Navigate', action: () => { router.push('/invoices'); setOpen(false); } },
    { id: 'go-financials', label: 'Go to Financials', section: 'Navigate', action: () => { router.push('/financials'); setOpen(false); } },
    { id: 'go-design', label: 'Go to Design Studio', section: 'Navigate', action: () => { router.push('/design'); setOpen(false); } },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  // Group by section
  const sections = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {});
  const flatFiltered = Object.values(sections).flat();

  useEffect(() => { setActiveIdx(0); }, [query]);

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatFiltered[activeIdx]) {
      e.preventDefault();
      flatFiltered[activeIdx].action();
    }
  };

  if (!open) return null;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} onClick={() => setOpen(false)} />
      <div style={{
        position: 'fixed', top: '22%', left: '50%', transform: 'translateX(-50%)',
        width: 520, maxHeight: '60vh', background: t.bg.surface,
        border: `1px solid ${t.border.default}`, borderRadius: 12,
        boxShadow: t.shadow.elevated, zIndex: 201, overflow: 'hidden',
      }}>
        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border.default}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{
              width: '100%', background: 'transparent', border: 'none',
              fontSize: 15, color: t.text.primary, fontFamily: 'inherit',
              outline: 'none', padding: 0,
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 'calc(60vh - 56px)', overflowY: 'auto', padding: '8px 0' }}>
          {flatFiltered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: t.text.tertiary }}>
              No matching commands
            </div>
          ) : (
            Object.entries(sections).map(([section, cmds]) => (
              <div key={section}>
                <div style={{ padding: '6px 16px 4px', fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {section}
                </div>
                {cmds.map((cmd) => {
                  const globalIdx = flatFiltered.indexOf(cmd);
                  const isActive = globalIdx === activeIdx;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px', border: 'none',
                        background: isActive ? t.bg.surfaceHover : 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        fontSize: 13, color: isActive ? t.text.primary : t.text.secondary,
                        transition: 'background 50ms',
                      }}
                    >
                      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {cmd.section === 'Actions' ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
                        )}
                      </span>
                      {cmd.label}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
