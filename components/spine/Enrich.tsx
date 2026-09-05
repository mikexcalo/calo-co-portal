'use client';

/**
 * Fill in a company from its own site, and show what it found first.
 *
 * A record that starts as a name stays a name, because the moment to fill it in
 * never arrives. This makes it one field and one press: type the domain, and
 * what comes back is proposed rather than saved.
 *
 * WHY NOTHING IS WRITTEN AUTOMATICALLY
 *
 * The same rule as everywhere else here. A page title is usually the company
 * name and is sometimes a tagline; a meta description is usually a description
 * and is sometimes a keyword dump. Both are right often enough to be worth
 * offering and wrong often enough that writing them unseen would slowly fill a
 * CRM with plausible nonsense, which is worse than blanks because a blank tells
 * you it needs work.
 */

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, inputStyle } from './ui';

interface Found {
  website: string;
  name: string | null;
  description: string | null;
  phone: string | null;
}

export function Enrich({
  customerId,
  currentName,
  onSaved,
}: {
  customerId: string;
  currentName: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [take, setTake] = useState<Record<string, boolean>>({});

  const look = async () => {
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setFound(json.found as Found);
      // The website is always right, so it starts ticked. The guesses do not.
      setTake({ website: true });
    } catch {
      setError('Could not reach the lookup.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!found) return;
    setBusy(true);
    const patch: Record<string, unknown> = {};
    if (take.website) patch.website = found.website;
    if (take.name && found.name) patch.name = found.name;
    if (take.description && found.description) patch.notes = found.description;
    if (take.phone && found.phone) patch.phone = found.phone;
    const res = await supabase.from('customers').update(patch).eq('id', customerId);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setFound(null);
    setOpen(false);
    setDomain('');
    onSaved();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          border: `1px dashed ${C.border}`, background: 'transparent', width: '100%',
          borderRadius: 999, padding: '7px 14px', marginBottom: 12, textAlign: 'left',
          fontSize: 13, color: C.faint, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Fill this in from their website
      </button>
    );
  }

  const line = (key: string, label: string, value: string | null) =>
    value && (
      <label
        key={key}
        style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 0', cursor: 'pointer' }}
      >
        <input
          type="checkbox"
          checked={Boolean(take[key])}
          onChange={(e) => setTake({ ...take, [key]: e.target.checked })}
          style={{ marginTop: 3, cursor: 'pointer' }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ fontSize: 11.5, color: C.faint, display: 'block' }}>{label}</span>
          <span style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>{value}</span>
        </span>
      </label>
    );

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: found ? 12 : 0 }}>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') look(); }}
          placeholder={`${currentName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}
          autoFocus
          style={{ ...inputStyle, flex: '1 1 200px' }}
        />
        <Button onClick={look} disabled={busy || !domain.trim()}>
          {busy ? 'Looking…' : 'Look it up'}
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setFound(null); setError(null); }}>
          Close
        </Button>
      </div>

      {error && <div style={{ fontSize: 13, color: C.amber, lineHeight: 1.5 }}>{error}</div>}

      {found && (
        <>
          {/* Named as guesses, because a page title is the company name often
              enough to offer and a tagline often enough to check. */}
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 4 }}>
            From their homepage. Tick what is right; nothing saves until you do.
          </div>
          {line('website', 'Website', found.website)}
          {line('name', 'Name on the site', found.name)}
          {line('description', 'How they describe themselves', found.description)}
          {line('phone', 'Phone on the page', found.phone)}

          <div style={{ marginTop: 10 }}>
            <Button onClick={save} disabled={busy || !Object.values(take).some(Boolean)}>
              {busy ? 'Saving…' : 'Save what is ticked'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
