'use client';

/**
 * The terms that go on this proposal, and nothing by default.
 *
 * Three sentences about a monthly platform retainer used to be compiled into
 * the proposal page, so every proposal carried them whether or not they were
 * true of it. The fix is not a better default. It is that a default is the
 * problem: an unedited starter set printed under somebody's re-roof is the
 * same failure wearing a table.
 *
 * So this starts empty and stays empty until somebody chooses. "Start from…"
 * copies a saved set into the editor; from that moment the text belongs to
 * this proposal and editing it changes nothing anywhere else. "Save as a set"
 * is the only way a new one is created, which keeps the library something
 * people build on purpose rather than something that accumulates.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Field, inputStyle, radius, SectionLabel, Select } from './ui';
import { save as saveOrFail } from '@/lib/spine/save';
import { human } from '@/lib/spine/errors';

export interface TermsSection {
  heading: string;
  body: string;
}

export interface TermsSet {
  id: string;
  name: string;
  sections: TermsSection[];
}

/** Blank headings and blank bodies are dropped, not stored. */
export const cleanTerms = (sections: TermsSection[]): TermsSection[] =>
  sections
    .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
    .filter((s) => s.heading.length > 0 && s.body.length > 0);

export function TermsPicker({
  orgId,
  sections,
  onChange,
  setId,
  onSetId,
}: {
  orgId: string | null;
  sections: TermsSection[];
  onChange: (next: TermsSection[]) => void;
  /** Which saved set this started from. Provenance only. */
  setId: string | null;
  onSetId: (id: string | null) => void;
}) {
  const [sets, setSets] = useState<TermsSet[]>([]);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    const res = await supabase
      .from('proposal_terms')
      .select('id, name, sections')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .order('name');
    setSets(((res.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sections: Array.isArray(r.sections) ? (r.sections as TermsSection[]) : [],
    })));
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const startFrom = (id: string) => {
    const set = sets.find((s) => s.id === id);
    if (!set) return;
    /*
      A copy, immediately. From here the text is this proposal's, so editing
      it cannot reach back into the set - which is the same promise the
      frozen copy on the estimate makes to the customer, one step earlier.
    */
    onChange(set.sections.map((s) => ({ ...s })));
    onSetId(set.id);
    setNotice(`Copied from "${set.name}". Edits here are for this one only.`);
  };

  const saveAsSet = async () => {
    const cleaned = cleanTerms(sections);
    if (!orgId || !newName.trim() || cleaned.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await saveOrFail(
      supabase
        .from('proposal_terms')
        .insert({ org_id: orgId, name: newName.trim(), sections: cleaned })
        .select('id, name, sections')
        .maybeSingle(),
      'Saving the set'
    );
    setBusy(false);
    if (res.error || !res.data) {
      setError(human(res.error ?? 'That did not save.'));
      return;
    }
    const row = res.data as Record<string, unknown>;
    onSetId(String(row.id));
    setNaming(false);
    setNewName('');
    setNotice(`Saved as "${String(row.name)}". It will be in Start from next time.`);
    load();
  };

  const edit = (i: number, patch: Partial<TermsSection>) =>
    onChange(sections.map((s, n) => (n === i ? { ...s, ...patch } : s)));

  const usable = cleanTerms(sections).length > 0;

  return (
    <div style={{ marginTop: 26, maxWidth: 620 }}>
      <SectionLabel>Terms</SectionLabel>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <Select
            value=""
            onChange={startFrom}
            placeholder={sets.length ? 'Start from…' : 'Nothing saved yet'}
            disabled={!sets.length}
            options={sets.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        <Button variant="ghost" onClick={() => onChange([...sections, { heading: '', body: '' }])}>
          Add a section
        </Button>
        {usable && !naming && (
          <Button variant="ghost" onClick={() => setNaming(true)}>Save as a set</Button>
        )}
      </div>

      {naming && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Call it">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={inputStyle}
                placeholder="Monthly retainer"
                autoFocus
              />
            </Field>
          </div>
          <Button onClick={saveAsSet} disabled={busy || !newName.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={() => { setNaming(false); setNewName(''); }}>Cancel</Button>
        </div>
      )}

      {sections.length === 0 ? (
        /*
          A statement of fact with the next step in it. "Nothing" is the right
          answer for most proposals and the page shows nothing when it is, so
          this does not nag.
        */
        <div style={{ fontSize: 13.5, color: C.faint, lineHeight: 1.6 }}>
          No terms on this one. Start from a saved set, or add a section. Nothing is added for you.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sections.map((s, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${C.border}`, borderRadius: radius.lg,
                background: C.panel, padding: '12px 14px 14px',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  value={s.heading}
                  onChange={(e) => edit(i, { heading: e.target.value })}
                  style={{ ...inputStyle, fontWeight: 600 }}
                  placeholder="What happens when you approve"
                />
                <Button variant="danger" onClick={() => onChange(sections.filter((_, n) => n !== i))}>
                  Remove
                </Button>
              </div>
              <textarea
                value={s.body}
                onChange={(e) => edit(i, { body: e.target.value })}
                style={{ ...inputStyle, minHeight: 92, resize: 'vertical', lineHeight: 1.6 }}
                placeholder="One paragraph per idea. Blank lines separate them on the proposal."
              />
            </div>
          ))}
        </div>
      )}

      {notice && (
        <div style={{ fontSize: 13, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>{notice}</div>
      )}
      {error && (
        <div style={{ fontSize: 13.5, color: C.red, marginTop: 10, lineHeight: 1.5 }}>{error}</div>
      )}
      {setId && (
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>
          Whatever is above is what the customer sees. The set it came from is not changed by editing here.
        </div>
      )}
    </div>
  );
}
