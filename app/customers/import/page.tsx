'use client';

/**
 * Bringing a contact list in.
 *
 * Nobody types two hundred people one at a time, and asking them to is how a
 * product gets abandoned in week one — the data is already in a spreadsheet,
 * and any tool that cannot accept it is asking to be the second place things
 * get typed.
 *
 * Three principles here:
 *
 *  - The parsing is free and local. A header row saying "Name, Email, Phone"
 *    is column matching, not comprehension. Sending it to a model would cost
 *    money per import and could invent a phone number that was never in the
 *    file, which is worse than an empty field.
 *  - Nothing is saved until it is seen. The same approval gate as every other
 *    import in here — you read the rows, you fix what is wrong, you decide.
 *  - Duplicates are found before the import, not discovered afterwards as two
 *    of everybody.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Processing } from '@/components/spine/Processing';
import { findDuplicates, parseContacts, type SheetRow } from '@/lib/spine/sheet';
import {
  Button,
  C,
  Card,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
} from '@/components/spine/ui';

type Stage = 'drop' | 'review' | 'done';

export default function ImportCustomersPage() {
  const router = useRouter();
  const { org, vocab } = useOrg();

  const [stage, setStage] = useState<Stage>('drop');
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [dupes, setDupes] = useState<Set<number>>(new Set());
  const [sourceName, setSourceName] = useState('');
  const [skippedCount, setSkippedCount] = useState(0);
  const [needsHelp, setNeedsHelp] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const [pasted, setPasted] = useState('');
  const [reading, setReading] = useState(false);

  const ingest = useCallback(
    async (text: string, name: string) => {
      setError(null);
      setReading(true);
      const parsed = parseContacts(text);

      if (parsed.rows.length === 0) {
        setReading(false);
        setError(
          "We couldn't find any contacts in that. Check there's one row per person, with at least a name or an email."
        );
        return;
      }

      const existing = await supabase.from('customers').select('name, email');
      const dup = findDuplicates(parsed.rows, existing.data ?? []);
      setDupes(dup);
      // Unticked from the start. The notice says they are excluded, and a
      // notice that does not match the checkboxes is worse than no notice.
      setSkip(new Set(dup));
      setRows(parsed.rows);
      setSkippedCount(parsed.skipped);
      setNeedsHelp(parsed.needsHelp);
      setSourceName(name);
      setStage('review');
      setReading(false);
    },
    []
  );

  const onFile = async (file: File) => {
    if (file.size > 5_000_000) {
      setError('That file is over 5MB. Export just the columns you need and try again.');
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      setError(
        "We can't read Excel files directly yet. In Excel, choose File then Save As then CSV, and drop that instead. Copying the cells and pasting them below works too."
      );
      return;
    }
    await ingest(await file.text(), file.name);
  };

  const edit = (i: number, field: keyof SheetRow, value: string) =>
    setRows((p) => p.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  const toggle = (i: number) =>
    setSkip((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const keeping = useMemo(() => rows.filter((_, i) => !skip.has(i)), [rows, skip]);

  const confirm = async () => {
    if (!org || keeping.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // The batch exists first, so every row can point at it. If this import
      // turns out to be wrong, "undo that spreadsheet" is one decision rather
      // than two hundred.
      const batch = await supabase
        .from('import_batches')
        .insert({
          org_id: org.id,
          kind: 'customers',
          source_name: sourceName || 'Pasted list',
          row_count: keeping.length,
        })
        .select()
        .single();
      if (batch.error) throw new Error(batch.error.message);

      const payload = keeping.map((r) => ({
        org_id: org.id,
        import_batch_id: batch.data.id,
        name: r.name.trim(),
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        address: r.address?.trim() || null,
        website: r.website?.trim() || null,
        contact_name: r.contact_name?.trim() || null,
        // Anything we recognised but had no column for is kept as a note
        // rather than dropped, because a discarded column is invisible and
        // people only notice months later.
        notes:
          [r.notes, r.extra ? Object.entries(r.extra).map(([k, v]) => `${k}: ${v}`).join('\n') : '']
            .filter(Boolean)
            .join('\n') || null,
      }));

      const res = await supabase.from('customers').insert(payload);
      if (res.error) throw new Error(res.error.message);

      setImported(payload.length);
      setStage('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cell: React.CSSProperties = {
    ...inputStyle,
    fontSize: 13.5,
    padding: '7px 9px',
  };

  return (
    <Page
      title={`Import ${vocab.customerPlural.toLowerCase()}`}
      subtitle="Bring in the list you already have. Nothing saves until you approve it."
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16, maxWidth: 700 }}>
          <div style={{ color: C.red, fontSize: 14, lineHeight: 1.6 }}>{error}</div>
        </Card>
      )}

      {reading && (
        <div style={{ maxWidth: 700, marginBottom: 14 }}>
          <Processing stage="reading" stages={['reading']} />
        </div>
      )}

      {stage === 'drop' && (
        <>
          <Card style={{ maxWidth: 700 }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              style={{
                border: `2px dashed ${dragging ? C.blue : C.borderStrong}`,
                background: dragging ? C.blueSoft : C.panelAlt,
                borderRadius: 12,
                padding: '38px 24px',
                textAlign: 'center',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <div style={{ fontSize: 16.5, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Drop a CSV here
              </div>
              <p style={{ fontSize: 14, color: C.dim, margin: '0 0 16px', lineHeight: 1.6 }}>
                One row per person. We&apos;ll match your columns whatever they&apos;re called.
              </p>
              <label>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    background: C.blue,
                    color: '#fff',
                    borderRadius: 7,
                    padding: '9px 18px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Choose a file
                </span>
              </label>
            </div>
          </Card>

          <Card style={{ maxWidth: 700, marginTop: 14 }}>
            <SectionLabel>Or paste it</SectionLabel>
            <p style={{ fontSize: 14, color: C.dim, margin: '8px 0 12px', lineHeight: 1.6 }}>
              Copy the cells straight from Excel, Numbers or Google Sheets and paste them below. No need to export a file.
            </p>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'Name\tEmail\tPhone\nJane Alvarez\tjane@example.com\t512-555-0134'}
              rows={6}
              style={{
                ...inputStyle,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13.5,
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: 10 }}>
              <Button
                onClick={() => ingest(pasted, 'Pasted list')}
                disabled={pasted.trim().length < 3}
              >
                Read this
              </Button>
            </div>
          </Card>
        </>
      )}

      {stage === 'review' && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16.5, fontWeight: 600, color: C.text }}>
                  Found {rows.length} {rows.length === 1 ? 'contact' : 'contacts'}
                  {sourceName ? ` in ${sourceName}` : ''}
                </div>
                <div style={{ fontSize: 13.5, color: C.dim, marginTop: 4, lineHeight: 1.6 }}>
                  Fix anything wrong right here, not back in the spreadsheet. Nothing saves until you press import.
                  {skippedCount > 0 && ` ${skippedCount} empty ${skippedCount === 1 ? 'row was' : 'rows were'} ignored.`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Button variant="ghost" onClick={() => setStage('drop')}>Start over</Button>
                <Button onClick={confirm} disabled={busy || keeping.length === 0}>
                  {busy ? 'Importing…' : `Import ${keeping.length}`}
                </Button>
              </div>
            </div>

            {needsHelp && (
              <div
                style={{
                  background: C.amberSoft,
                  border: `1px solid ${C.amber}44`,
                  borderRadius: 8,
                  padding: '11px 13px',
                  marginTop: 14,
                  fontSize: 13.5,
                  color: C.text,
                  lineHeight: 1.6,
                }}
              >
                Some rows came through without a name. That usually means a column was matched wrong, so check a few before importing.
              </div>
            )}

            {dupes.size > 0 && (
              <div
                style={{
                  background: C.blueSoft,
                  border: `1px solid ${C.blue}33`,
                  borderRadius: 8,
                  padding: '11px 13px',
                  marginTop: 10,
                  fontSize: 13.5,
                  color: C.text,
                  lineHeight: 1.6,
                }}
              >
                {dupes.size} {dupes.size === 1 ? 'looks like someone' : 'look like people'} you
                already have, so they&apos;re unticked below. Tick any back on if they&apos;re genuinely different people.
              </div>
            )}
          </Card>

          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10, background: C.panel }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr style={{ background: C.panelAlt }}>
                  {['', 'Name', 'Email', 'Phone', 'Address', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left',
                        padding: '9px 12px',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: C.faint,
                        fontWeight: 600,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isDupe = dupes.has(i);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        opacity: skip.has(i) ? 0.4 : 1,
                        background: isDupe && !skip.has(i) ? C.blueSoft : 'transparent',
                      }}
                    >
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          type="checkbox"
                          checked={!skip.has(i)}
                          onChange={() => toggle(i)}
                          aria-label={`Include ${r.name || 'row ' + (i + 1)}`}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 160 }}>
                        <input value={r.name ?? ''} onChange={(e) => edit(i, 'name', e.target.value)} style={cell} />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 180 }}>
                        <input value={r.email ?? ''} onChange={(e) => edit(i, 'email', e.target.value)} style={cell} />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 130 }}>
                        <input value={r.phone ?? ''} onChange={(e) => edit(i, 'phone', e.target.value)} style={cell} />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 180 }}>
                        <input value={r.address ?? ''} onChange={(e) => edit(i, 'address', e.target.value)} style={cell} />
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        {isDupe && <Pill tone="blue">Already have</Pill>}
                        {!r.name && <Pill tone="amber">No name</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button onClick={confirm} disabled={busy || keeping.length === 0}>
              {busy ? 'Importing…' : `Import ${keeping.length} ${keeping.length === 1 ? vocab.customer.toLowerCase() : vocab.customerPlural.toLowerCase()}`}
            </Button>
            <Button variant="ghost" onClick={() => setStage('drop')}>Start over</Button>
          </div>
        </>
      )}

      {stage === 'done' && (
        <Card style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            {imported} {imported === 1 ? vocab.customer.toLowerCase() : vocab.customerPlural.toLowerCase()} imported
          </div>
          <p style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.7, margin: '0 0 18px' }}>
            They&apos;re in. You can attach {vocab.jobPlural.toLowerCase()} and invoices to them now.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => router.push('/customers')}>
              See them
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStage('drop');
                setRows([]);
                setPasted('');
              }}
            >
              Import another list
            </Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
