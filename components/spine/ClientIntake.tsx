'use client';

/**
 * Add a client from whatever you actually have.
 *
 * You come back from a meeting with a photo of a scribbled page, a card, and
 * a price sheet. The alternative to this is typing all of it into four
 * screens, which is why it usually stays in the photo roll.
 *
 * Three steps, and the middle one is the point: drop it, check it, keep it.
 * Nothing is written until somebody has read every field and pressed the
 * button. A wrong price that files itself becomes a wrong estimate, then a
 * wrong invoice, then a conversation with a customer about being overcharged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';
import { Button, C, Card, SectionLabel, inputStyle } from './ui';

interface Contact { name: string; title: string; email: string; phone: string }
interface Price { name: string; unit: string; price: string }

export interface IntakeSeed {
  /** Already-written text — a pasted note, a scribble transcribed. */
  text?: string;
  /** A file already in storage, as base64 plus its type. */
  data?: string;
  mediaType?: string;
  /** Shown while it reads, so somebody knows which thing is being read. */
  label?: string;
}

export function ClientIntake({
  orgId,
  seed,
  onSaved,
  onClose,
}: {
  orgId: string;
  /** Skip the drop zone and read this instead. */
  seed?: IntakeSeed;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [cents, setCents] = useState<number | null>(null);
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [paste, setPaste] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  /**
   * Whose prices these are.
   *
   * A builder drops what he charges. A distributor drops a supplier's sheet.
   * Filed as the same thing, an estimate would quote a customer at cost, so
   * the question is asked once, here, while somebody is already looking.
   */
  const [belongsTo, setBelongsTo] = useState<'ours' | 'supplier'>('ours');
  const [supplier, setSupplier] = useState('');

  const send = useCallback(async (payload: { data?: string; mediaType?: string; text?: string }) => {
    setReading(true); setError('');
    try {
      const res = await fetch('/api/customers/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.intake) { setError(body.error ?? 'Nothing readable in that.'); setReading(false); return; }
      const i = body.intake;
      setName(i.name ?? ''); setWebsite(i.website ?? '');
      setAddress(i.address ?? ''); setNotes(i.notes ?? '');
      setContacts((i.contacts ?? []).map((c: Record<string, string | null>) => ({
        name: c.name ?? '', title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '',
      })));
      setPrices((i.prices ?? []).map((p: Record<string, unknown>) => ({
        name: String(p.name ?? ''), unit: String(p.unit ?? ''),
        price: p.price == null ? '' : String(p.price),
      })));
      setCents(typeof body.cents === 'number' ? body.cents : null);
      setRead(true);
    } catch (e) {
      setError(human(e, 'That could not be read.'));
    }
    setReading(false);
  }, []);

  /**
   * Something already on the shelf.
   *
   * A drop that has been sitting in Drops is the same problem as a fresh
   * file: it is content nobody has turned into records yet. Seeded, this
   * opens straight into reading rather than asking for the file again.
   */
  useEffect(() => {
    if (!seed) return;
    if (seed.text?.trim()) { send({ text: seed.text }); return; }
    if (seed.data && seed.mediaType) send({ data: seed.data, mediaType: seed.mediaType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.text, seed?.data]);

  const take = useCallback(async (file: File) => {
    const ok = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!ok) { setError('Drop a PDF or a photo, or paste the text.'); return; }
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('unreadable'));
      r.onload = () => resolve(String(r.result ?? '').split(',')[1] ?? '');
      r.readAsDataURL(file);
    });
    await send({ data: b64, mediaType: file.type });
  }, [send]);

  /** Everything at once, and nothing before the button. */
  async function keep() {
    if (!name.trim()) { setError('Give the business a name.'); return; }
    setBusy(true); setError('');
    try {
      const made = await saveOrFail(
        supabase.from('customers').insert({
          org_id: orgId,
          name: name.trim(),
          website: website.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        }).select('id').single(),
        'The client'
      );
      const customerId = (made.data as { id: string } | null)?.id;
      if (made.error || !customerId) { setBusy(false); return; }

      const people = contacts.filter((c) => c.name.trim() || c.email.trim());
      if (people.length) {
        await saveOrFail(
          supabase.from('customer_contacts').insert(
            people.map((c) => ({
              org_id: orgId, customer_id: customerId,
              name: c.name.trim() || c.email.trim(),
              title: c.title.trim() || null,
              email: c.email.trim() || null,
              phone: c.phone.trim() || null,
              relationship: 'client',
            }))
          ),
          'The people'
        );
      }

      const items = prices.filter((p) => p.name.trim());
      if (items.length) {
        await saveOrFail(
          supabase.from('price_items').insert(
            items.map((p) => ({
              org_id: orgId,
              name: p.name.trim(),
              unit: p.unit.trim() || null,
              unit_price: parseFloat(p.price) || 0,
            }))
          ),
          'The prices'
        );
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(human(e));
    }
    setBusy(false);
  }

  const field = (v: string, set: (s: string) => void, ph: string) => (
    <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} style={inputStyle} />
  );

  return (
    <Card style={{ marginBottom: 14 }}>
      {seed && !read ? (
        <>
          <SectionLabel>Reading</SectionLabel>
          <p style={{ fontSize: 13, color: C.faint, margin: '6px 0 0' }}>
            {error || `Reading ${seed.label ?? 'what you dropped'}…`}
          </p>
          {error && (
            <div style={{ marginTop: 12 }}>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
            </div>
          )}
        </>
      ) : !read ? (
        <>
          <SectionLabel>Drop what you have</SectionLabel>
          <p style={{ fontSize: 13, color: C.faint, margin: '6px 0 12px', maxWidth: '62ch' }}>
            A photo of notes, a business card, a price sheet, a PDF. It reads the business, the
            people and the prices, and shows you everything before anything is saved.
          </p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) take(f); }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
            style={{
              border: `1px dashed ${C.border}`, borderRadius: 10, padding: 22,
              textAlign: 'center', cursor: 'pointer', fontSize: 13, color: C.faint,
            }}
          >
            {reading ? 'Reading…' : 'Drop a file here, or click to choose one'}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ''; }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Or paste notes, an email, anything written down"
              style={inputStyle}
            />
            <Button variant="ghost" onClick={() => send({ text: paste })} disabled={reading || !paste.trim()}>
              Read it
            </Button>
          </div>

          {error && <p style={{ fontSize: 12.5, color: C.red, margin: '10px 0 0' }}>{error}</p>}
          <div style={{ marginTop: 12 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>Check this before it saves</SectionLabel>
          <p style={{ fontSize: 13, color: C.faint, margin: '6px 0 14px', maxWidth: '62ch' }}>
            Everything below was read off what you dropped. Correct anything wrong, delete anything
            it invented, then keep it.
            {cents != null && ` Reading that cost ${cents < 1 ? 'under a cent' : `${cents.toFixed(1)}c`}.`}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {field(name, setName, 'Business name')}
            {field(website, setWebsite, 'Website')}
            {field(address, setAddress, 'Address')}
          </div>
          <div style={{ marginTop: 8 }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was said about them"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {contacts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel>People ({contacts.length})</SectionLabel>
              {contacts.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)) 28px', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  {(['name', 'title', 'email', 'phone'] as const).map((k) => (
                    <input
                      key={k}
                      value={c[k]}
                      placeholder={k[0].toUpperCase() + k.slice(1)}
                      onChange={(e) => setContacts((p) => p.map((x, n) => (n === i ? { ...x, [k]: e.target.value } : x)))}
                      style={{ ...inputStyle, fontSize: 13 }}
                    />
                  ))}
                  <button
                    onClick={() => setContacts((p) => p.filter((_, n) => n !== i))}
                    title="Drop this one"
                    style={{ background: 'transparent', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {prices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionLabel>Prices ({prices.length})</SectionLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 10px' }}>
                {([
                  { id: 'ours' as const, label: 'What you charge' },
                  { id: 'supplier' as const, label: 'What a supplier charges you' },
                ]).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setBelongsTo(o.id)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                      fontFamily: 'inherit',
                      border: `1px solid ${belongsTo === o.id ? C.ink : C.border}`,
                      background: belongsTo === o.id ? C.panelAlt : 'transparent',
                      color: belongsTo === o.id ? C.text : C.dim,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
                {belongsTo === 'supplier' && (
                  <input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Who charges it"
                    style={{ ...inputStyle, fontSize: 13, maxWidth: 200 }}
                  />
                )}
              </div>
              <p style={{ fontSize: 12, color: C.faint, margin: '0 0 6px' }}>
                {belongsTo === 'ours'
                  ? 'Estimates pick from these.'
                  : 'Kept for reference. Estimates never quote from a supplier sheet.'}
              </p>
              {prices.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 28px', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <input value={p.name} placeholder="What it is" onChange={(e) => setPrices((x) => x.map((y, n) => (n === i ? { ...y, name: e.target.value } : y)))} style={{ ...inputStyle, fontSize: 13 }} />
                  <input value={p.unit} placeholder="Unit" onChange={(e) => setPrices((x) => x.map((y, n) => (n === i ? { ...y, unit: e.target.value } : y)))} style={{ ...inputStyle, fontSize: 13 }} />
                  <input value={p.price} placeholder="0.00" inputMode="decimal" onChange={(e) => setPrices((x) => x.map((y, n) => (n === i ? { ...y, price: e.target.value } : y)))} style={{ ...inputStyle, fontSize: 13 }} />
                  <button
                    onClick={() => setPrices((x) => x.filter((_, n) => n !== i))}
                    title="Drop this one"
                    style={{ background: 'transparent', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: 12.5, color: C.red, margin: '12px 0 0' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
            <Button onClick={keep} disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Looks good — keep it'}
            </Button>
            <button onClick={() => { setRead(false); setError(''); }} style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              Start again
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
