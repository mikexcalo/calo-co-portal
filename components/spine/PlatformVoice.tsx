'use client';

/**
 * How the platform talks, as a thing you can point at.
 *
 * Nautilus and calo.company are two different voices and two different
 * typefaces, and until now only one of them was written down. The site has a
 * brand; the product had whatever got typed that afternoon — which is how a
 * screen ends up saying "collect for a fortnight" and "text is not
 * machine-readable (embedded fonts)" in the same week.
 *
 * The reference is Square, Stripe, Atlassian and Cash App: four companies
 * whose products carry real complexity and still read like a person
 * explaining something. What they share is not a word list. It is that the
 * interface says what happened, what it costs, and what to do, and then
 * stops.
 *
 * Every wrong example below is real copy from this product, most of it
 * removed today.
 */

import { C, Card, SectionLabel, radius } from './ui';

interface Rule {
  title: string;
  /** The principle, in one line. */
  rule: string;
  wrong: string;
  right: string;
  /** Why the wrong one is wrong, when it is not obvious. */
  note?: string;
}

const RULES: Rule[] = [
  {
    title: 'Say the thing, then stop',
    rule: 'One idea per line. If a sentence is reassuring you rather than telling you something, cut it.',
    wrong:
      'Nothing here is lost, it just has not been said who it is about. Answer that on any item and it moves onto their record.',
    right: 'Not filed yet',
    note: 'Two sentences of comfort above a heading that already said it.',
  },
  {
    title: 'Name what the button does',
    rule: 'A control says what will happen, and the result says it happened. Never leave the verb without its object.',
    wrong: 'Start collecting',
    right: 'Start collecting visitor counts — they show up under Traffic',
    note: 'Collecting what, and where does it go.',
  },
  {
    title: 'No word you would not say out loud',
    rule: 'Write it the way you would say it across a table. If it sounds like a document, rewrite it.',
    wrong: 'Collect for a fortnight before setting their traffic module live.',
    right: 'Give it two weeks before you show the client.',
  },
  {
    title: 'Never explain your own plumbing',
    rule: 'The reader does not have the codebase in their head. An internal limitation is not a feature description.',
    wrong:
      'Text is not machine-readable (embedded fonts), so it is stored as-is for reference rather than indexed.',
    right: 'How Mammoth runs a site: who does what, and who reports to whom.',
  },
  {
    title: 'An error says what happened and whose fault it is',
    rule: 'What went wrong, whether it was them, and whether trying again helps. Never apologise, never blame vaguely.',
    wrong: 'You do not have access to do that here. Ask whoever set this workspace up.',
    right: 'Could not save that site. Nothing to do with your account — it is on us.',
    note: 'That message appeared because a column was missing, not because of permissions.',
  },
  {
    title: 'Numbers carry their own meaning',
    rule: 'Show the figure and what it is. Do not narrate the arithmetic beside it.',
    wrong: '$60.00/hr · 50% off $120.00, friends and family',
    right: '$120.00  $60.00/hr · friends and family',
    note: 'A discount is a price with a line through it.',
  },
  {
    title: 'No heading that counts to zero',
    rule: 'A label over nothing is a label about nothing. Show the affordance instead.',
    wrong: 'THE PLAN (0 OF 0 DONE) · REMINDERS (0)',
    right: 'Remind me about this client',
  },
  {
    title: 'Plain words for money, always',
    rule: 'Owed, paid, unbilled, drafted. Never "outstanding receivables" and never a euphemism.',
    wrong: 'Recurring costs, normalized',
    right: 'What you pay every month',
  },
  {
    title: 'Second person, active, present',
    rule: 'You, not the user. Send, not will be sent. It is, not it would be.',
    wrong: 'An invoice will be generated and dispatched to the client.',
    right: 'It goes out on the 1st.',
  },
  {
    title: 'Empty states name the next move',
    rule: 'An empty screen that only reports emptiness wastes the one moment somebody is ready to act.',
    wrong: 'No prices yet.',
    right: 'No prices yet. Import the list you already have, or add one at a time.',
  },
];

const TYPE = [
  { role: 'Display and headings', family: 'Figtree', note: 'Weight 600, tracking -0.021em' },
  { role: 'Body and interface', family: 'Inter', note: 'The reading face. Everything not a heading' },
  { role: 'Numbers and code', family: 'Geist Mono', note: 'Tabular figures wherever digits line up' },
];

export function PlatformVoice() {
  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 820 }}>

      <Card>
        <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.65, maxWidth: '62ch' }}>
          Nautilus does not sound like calo.company, and it should not. The site is
          selling; the product is being worked in, often by somebody who did not
          choose it and is halfway through something else.
        </div>
        <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.65, marginTop: 10, maxWidth: '62ch' }}>
          The reference is Square, Stripe, Atlassian and Cash App — four companies
          carrying real complexity whose screens still read like a person explaining
          something. What they share is not a word list. It is that the interface
          says what happened, what it costs and what to do, and then stops.
        </div>
      </Card>

      <div>
        <SectionLabel>The rules ({RULES.length})</SectionLabel>
        <div style={{ display: 'grid', gap: 10 }}>
          {RULES.map((r) => (
            <Card key={r.title}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{r.title}</div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 3, lineHeight: 1.55, maxWidth: '60ch' }}>
                {r.rule}
              </div>

              <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: C.red, flexShrink: 0, paddingTop: 2, width: 40 }}>Not</span>
                  <span style={{ fontSize: 13, color: C.faint, lineHeight: 1.5, textDecoration: 'line-through', textDecorationColor: C.border }}>
                    {r.wrong}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: C.green, flexShrink: 0, paddingTop: 2, width: 40 }}>This</span>
                  <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{r.right}</span>
                </div>
              </div>

              {r.note && (
                <div style={{ fontSize: 12.5, color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                  {r.note}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Platform type</SectionLabel>
        <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 9, lineHeight: 1.55, maxWidth: '58ch' }}>
          Not the brand faces. These are the product&apos;s, chosen to be legible at
          13px on a laptop somebody is working on, and they are set in code rather
          than here.
        </div>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {TYPE.map((t, i) => (
            <div
              key={t.family}
              style={{
                display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap',
                padding: '13px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontSize: 16, color: C.text, minWidth: 120 }}>{t.family}</span>
              <span style={{ fontSize: 13, color: C.dim, flex: 1, minWidth: 180 }}>{t.role}</span>
              <span style={{ fontSize: 12, color: C.faint }}>{t.note}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ borderStyle: 'dashed' }}>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6, maxWidth: '60ch' }}>
          One day the platform and the site will sound the same and share a type
          scale. Until then this page is the product&apos;s half, and the fact that
          they differ is a decision rather than a drift.
        </div>
      </Card>

    </div>
  );
}
