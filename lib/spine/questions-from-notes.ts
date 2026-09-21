/**
 * Split a stored note into the questions it answers.
 *
 * Lives here, and not beside the component that renders it, for a reason that
 * cost an outage: Faq.tsx is a 'use client' module, so every one of its
 * exports becomes a client reference. The estimate page is a server component,
 * and calling a client reference during a server render throws — so the whole
 * page failed and the route served its loading fallback forever. The invoice
 * page, which imports none of this, carried on working, which is what made it
 * obvious where to look.
 *
 * Plain module, no directive, safe on both sides of the line.
 *
 * The copy is written as a heading line, a blank line, then its paragraphs, so
 * that is the rule — rather than a second structure somebody has to keep in
 * step with the first. A heading is a short line with no closing punctuation
 * and a blank line under it. Anything following no convention at all comes
 * back as a single block and still renders.
 */

export interface Question {
  q: string;
  a: string;
}

export function asQuestions(notes: string | null | undefined): Question[] {
  const text = (notes ?? '').trim();
  if (!text) return [];

  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: Question[] = [];

  for (const b of blocks) {
    const oneLine = !b.includes('\n');
    const heading = oneLine && b.length <= 60 && !/[.!?:,]$/.test(b);
    if (heading) out.push({ q: b, a: '' });
    else if (out.length) out[out.length - 1].a += (out[out.length - 1].a ? '\n\n' : '') + b;
    else out.push({ q: 'The detail', a: b });
  }

  return out.filter((x) => x.a);
}
