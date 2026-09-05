'use client';

/**
 * What the market wants, kept whole.
 *
 * A sales agency runs on knowledge that belongs to nobody in particular. That
 * P&D tail-off is 36% of the shrimp market is true whichever principal is being
 * sold that week, so filing it under one of them means copying it or losing it
 * the day a fourth signs, and copied reference goes stale in one direction
 * only: silently.
 *
 * WHY THERE IS NO SCHEMA HERE
 *
 * The obvious build is a table of species, origins and star ratings. Resisted,
 * for three reasons. There was exactly one document to design it from. The next
 * one is already promised and is a shrimp matrix with counts and forms rather
 * than countries and species, so a squid-shaped schema breaks on arrival. And
 * the value is not the numbers: it is "I would avoid Peru" and "do not move on
 * squid until anchor distribution", which no rating column carries and which is
 * the part a distributor is paying for.
 *
 * So: documents, with a subject, a source and a date the data is from, stored
 * as plain text and rendered as markdown. That is the wheel every tool of this
 * kind already settled on for the same problem: nothing becomes a schema, the
 * next document does not have to fit the shape of the last one, and a table
 * still reads as a table.
 *
 * The first version showed the raw text in a monospace box, which kept the
 * alignment and made the most valuable material in the product unreadable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import { Button, C, Card, Empty, Page, SectionLabel, inputStyle } from '@/components/spine/ui';
import { Glyph } from '@/components/spine/icons';
import { Doc, CopyDoc } from '@/components/spine/Doc';

interface RefDoc {
  id: string;
  title: string;
  subject: string | null;
  source: string | null;
  as_of: string | null;
  body: string;
}

const blank = { title: '', subject: '', source: '', as_of: '', body: '' };

export default function MarketPage() {
  const { org } = useOrg();
  const [docs, setDocs] = useState<RefDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await supabase
      .from('reference_docs')
      .select('id, title, subject, source, as_of, body')
      .order('subject')
      .order('title');
    if (res.error) setError(res.error.message);
    else setDocs((res.data ?? []) as RefDoc[]);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Searches the body, not just the title.
   *
   * The thing you come here for is a number somebody just asked you about on a
   * call. Nobody remembers which document holds "18 million pounds", and a
   * search that only reads titles would find nothing and teach you not to look.
   */
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return docs;
    return docs.filter((d) =>
      `${d.title} ${d.subject ?? ''} ${d.source ?? ''} ${d.body}`.toLowerCase().includes(t)
    );
  }, [docs, q]);

  /** Grouped by subject, in the order they come back. */
  const groups = useMemo(() => {
    const out = new Map<string, RefDoc[]>();
    shown.forEach((d) => {
      const g = d.subject?.trim() || 'General';
      out.set(g, [...(out.get(g) ?? []), d]);
    });
    return Array.from(out.entries());
  }, [shown]);

  const save = async () => {
    if (!org || !draft?.title.trim() || !draft.body.trim()) return;
    setBusy(true);
    const res = await supabase.from('reference_docs').insert({
      org_id: org.id,
      title: draft.title.trim(),
      subject: draft.subject.trim() || null,
      source: draft.source.trim() || null,
      as_of: draft.as_of || null,
      body: draft.body,
    });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setDraft(null);
    load();
  };

  return (
    <Page
      title="Market"
      subtitle="What the market wants, and where the judgment behind it came from."
      action={
        draft ? undefined : <Button onClick={() => setDraft({ ...blank })}>Add a document</Button>
      }
    >
      {draft && (
        <Card>
          <SectionLabel>New document</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What it is. Say the thing, not the word report."
              style={{ ...inputStyle, fontWeight: 500 }}
            />
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Subject, one word"
                style={{ ...inputStyle, flex: '1 1 140px' }}
              />
              <input
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                placeholder="Where it came from"
                style={{ ...inputStyle, flex: '2 1 220px' }}
              />
              <input
                type="date"
                value={draft.as_of}
                onChange={(e) => setDraft({ ...draft, as_of: e.target.value })}
                style={{ ...inputStyle, flex: '0 1 170px' }}
              />
            </div>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={14}
              placeholder="Paste it in. Markdown: ## for a heading, | for a table, - for a list. Anything else reads as a paragraph."
              style={{
                ...inputStyle,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12.5, lineHeight: 1.65, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={save} disabled={busy || !draft.title.trim() || !draft.body.trim()}>
                {busy ? 'Saving…' : 'Save it'}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {!loaded ? (
        <Empty>Loading…</Empty>
      ) : error ? (
        <Card>
          <div style={{ fontSize: 13.5, color: C.red, lineHeight: 1.6 }}>
            Could not read the library, so this is not an empty one. {error}
          </div>
        </Card>
      ) : docs.length === 0 ? (
        <Card>
          <Empty>
            Nothing filed yet. This is for the things that stay true across every client:
            category shares, what sells where, which origins to avoid and why.
          </Empty>
        </Card>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search inside every document, not just the titles"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {shown.length === 0 && (
            <Card><Empty>Nothing in the library says that.</Empty></Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(([subject, items]) => (
              <div key={subject}>
                <SectionLabel>{subject}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((d) => {
                    const isOpen = open === d.id;
                    return (
                      <Card key={d.id}>
                        <div
                          onClick={() => setOpen(isOpen ? null : d.id)}
                          style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}
                        >
                          <Glyph name="book" size={15} color={C.faint} />
                          <span style={{ fontSize: 14.5, color: C.text, flex: 1, minWidth: 180 }}>
                            {d.title}
                          </span>
                          {/* Attribution beside the title, because an
                              unattributed market share is a rumor and the
                              difference matters when it gets quoted at a buyer. */}
                          {d.source && (
                            <span style={{ fontSize: 12.5, color: C.faint }}>{d.source}</span>
                          )}
                          {d.as_of && (
                            <span style={{ fontSize: 12, color: C.faint }}>{d.as_of}</span>
                          )}
                          <CopyDoc source={d.body} />
                          <span style={{ fontSize: 12, color: C.blue }}>{isOpen ? 'Close' : 'Read'}</span>
                        </div>

                        {/*
                          Read, not stared at.

                          This was the raw text in a monospace box, which kept
                          the alignment of a table nobody could scan and made
                          the most valuable material in the product unreadable
                          and unusable. Same text in the database; it is
                          rendered now, and the source is what Copy puts on the
                          clipboard so a number can be quoted at a buyer.
                        */}
                        {isOpen && (
                          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                            <Doc source={d.body} />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
