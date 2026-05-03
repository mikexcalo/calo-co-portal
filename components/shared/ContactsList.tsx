'use client';

import { useTheme } from '@/lib/theme';
import type { CrmContact } from '@/lib/types';

type ContactsListProps = {
  contacts: CrmContact[];
  onAddClick: () => void;
};

const avatarBgs = ['#e8d5b7', '#c4d4c8', '#d4c4d8', '#c4cdd8', '#d8c4c4'];
const avatarFgs = ['#6b4a1a', '#2d4a3a', '#4a2d4a', '#2d3a4a', '#4a2d2d'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function avatarColor(name: string): { bg: string; fg: string } {
  const code = name.charCodeAt(0) || 0;
  const idx = code % 5;
  return { bg: avatarBgs[idx], fg: avatarFgs[idx] };
}

export function ContactsList({ contacts, onAddClick }: ContactsListProps) {
  const { t } = useTheme();

  return (
    <div style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 8,
      padding: '12px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: contacts.length > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Contacts
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: t.text.tertiary,
            background: t.bg.surfaceHover, borderRadius: 8, padding: '1px 6px',
          }}>
            {contacts.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          style={{
            fontSize: 12, fontWeight: 500, color: t.text.tertiary,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '2px 4px', transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = t.text.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = t.text.tertiary; }}
        >
          + Add
        </button>
      </div>

      {/* Contact rows */}
      {contacts.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text.tertiary, padding: '4px 0' }}>
          No contacts yet. Click + Add to create one.
        </div>
      ) : (
        contacts.map((contact, i) => {
          const { bg, fg } = avatarColor(contact.name);
          return (
            <div
              key={contact.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderTop: i > 0 ? `0.5px solid ${t.border.default}` : 'none',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                background: bg, color: fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>
                {getInitials(contact.name)}
              </div>

              {/* Name + role */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contact.name}
                </div>
                {contact.role && (
                  <div style={{ fontSize: 11, color: t.text.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.role}
                  </div>
                )}
              </div>

              {/* Flags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                {contact.isPrimaryContact && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: t.accent.primary, background: 'rgba(37, 99, 235, 0.08)', borderRadius: 3, padding: '1px 6px' }}>
                    Primary
                  </span>
                )}
                {contact.isBillingContact && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#F59E0B', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 3, padding: '1px 6px' }}>
                    Billing
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
