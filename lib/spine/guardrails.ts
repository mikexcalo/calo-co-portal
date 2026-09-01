/**
 * Checking copy against a brand's own rules.
 *
 * The template is explicit about why this exists: a working name reached the
 * live homepage, and "an automated check finds this, a human reviewer does
 * not". That is the honest case for automating it. People do not forget rules
 * because they are careless; they forget because they are six weeks and four
 * documents away from the conversation where the rule was set.
 *
 * Deliberately no model call. A banned-phrase list is string matching, and
 * spending tokens on it would make checking cost money, which means people
 * check less, which defeats the point. Free means it can run on every draft.
 */

export interface Rule {
  term: string;
  reason?: string;
}

export interface Violation {
  term: string;
  reason?: string;
  /** Character offset, so the caller can show it in place. */
  index: number;
  /** The line it appears on, and enough either side to recognize it. */
  context: string;
}

/**
 * Constructions worth catching that no list of banned words would hold.
 *
 * These are house rules from Colette's kit, and they generalise: nearly every
 * brand that writes rules ends up banning the em-dash and unsourced numbers.
 * Each is opt-in per brand rather than applied to everybody.
 */
export const CONSTRUCTIONS: Array<{ id: string; label: string; reason: string; test: RegExp }> = [
  {
    id: 'em_dash',
    label: 'Em-dash',
    reason: 'Use a comma or a full stop.',
    test: /[—–]/g,
  },
  {
    id: 'unsourced_number',
    label: 'Unsourced number',
    reason: 'A percentage or multiple needs a source and a date, or it is a gap.',
    test: /\b\d{1,3}(\.\d+)?\s?%|\b\d+x\b/gi,
  },
  {
    id: 'weasel',
    label: 'Weasel word',
    reason: 'Says nothing. Name the thing instead.',
    test: /\b(seamless|robust|leverage|synerg\w+|best-in-class|world-class|cutting-edge|revolutionary)\b/gi,
  },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function contextAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

/**
 * Every violation, not just the first.
 *
 * Returning one at a time would mean fixing, re-running, fixing, re-running,
 * which is how a check becomes something people stop running.
 */
export function checkCopy(
  text: string,
  rules: Rule[],
  constructions: string[] = ['em_dash']
): Violation[] {
  const found: Violation[] = [];

  for (const rule of rules) {
    const term = (rule.term ?? '').trim();
    if (!term) continue;

    /**
     * Word boundaries for words, plain search for punctuation.
     *
     * Without this, banning "data" would flag "database" and "validate", and a
     * check that cries wolf is a check people turn off.
     */
    const isWordy = /^[\w\s'’-]+$/.test(term);
    const pattern = isWordy
      ? new RegExp(`\\b${escape(term)}\\b`, 'gi')
      : new RegExp(escape(term), 'g');

    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      found.push({
        term,
        reason: rule.reason,
        index: m.index,
        context: contextAround(text, m.index, m[0].length),
      });
      if (m.index === pattern.lastIndex) pattern.lastIndex++;
    }
  }

  for (const c of CONSTRUCTIONS) {
    if (!constructions.includes(c.id)) continue;
    const pattern = new RegExp(c.test.source, c.test.flags);
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      found.push({
        term: `${c.label}: ${m[0]}`,
        reason: c.reason,
        index: m.index,
        context: contextAround(text, m.index, m[0].length),
      });
      if (m.index === pattern.lastIndex) pattern.lastIndex++;
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/**
 * Two short sentences back to back, which Colette bans by name.
 *
 * Kept separate because it is a rhythm rule rather than a term, and because it
 * is the one rule here likely to produce a judgement call rather than a
 * verdict. Reported as something to look at, not as a violation.
 */
export function shortSentencePairs(text: string, maxWords = 5): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const flagged: string[] = [];
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = sentences[i].split(/\s+/).length;
    const b = sentences[i + 1].split(/\s+/).length;
    if (a <= maxWords && b <= maxWords) {
      flagged.push(`${sentences[i]} ${sentences[i + 1]}`);
    }
  }
  return flagged;
}
