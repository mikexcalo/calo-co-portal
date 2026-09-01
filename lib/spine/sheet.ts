/**
 * Reading a spreadsheet of contacts.
 *
 * Deliberately not a model call. A spreadsheet with a header row saying
 * "Name, Email, Phone" is not a comprehension problem, it is a column-matching
 * problem — and sending it to a model would cost money per import, be slower,
 * and occasionally hallucinate an email address that was never in the file.
 * That last one is the real argument: a wrong phone number invented
 * confidently is worse than an empty field.
 *
 * So: parse it here, for free, every time. The model is offered only when this
 * genuinely cannot work out the columns, and even then the person approves
 * every row before it becomes data.
 */

export interface SheetRow {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  website?: string;
  contact_name?: string;
  notes?: string;
  /** Columns we recognised nothing for, kept so nothing is silently dropped. */
  extra?: Record<string, string>;
}

export interface ParseResult {
  rows: SheetRow[];
  headers: string[];
  mapping: Record<string, string | null>;
  /** Rows the file contained that produced nothing usable. */
  skipped: number;
  /** True when we could not find a name column and a person should intervene. */
  needsHelp: boolean;
}

/**
 * Split a line of CSV, honouring quotes.
 *
 * Written out rather than pulled from a library because the failure mode
 * matters: a naive split on commas turns `"Smith, John"` into two people, and
 * a contact list is exactly the kind of file full of commas inside quotes.
 */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, '').trim());
}

/** Tabs if the first line has more of them than commas — pasted from Excel. */
function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas) return ';'; // European exports
  return ',';
}

/**
 * Which of our fields a column heading means.
 *
 * Matched loosely on purpose. Real exports say "E-mail Address", "Mobile",
 * "Client Name", "Co." — insisting on exact names would make this useless on
 * every file that did not come out of this app.
 */
const PATTERNS: Array<[keyof SheetRow, RegExp]> = [
  ['email',        /^(e[-\s]?mail|email\s*address|mail)$/i],
  ['phone',        /^(phone|telephone|tel|mobile|cell|phone\s*number|contact\s*number)$/i],
  ['company',      /^(company|business|organization|organization|firm|co\.?)$/i],
  ['address',      /^(address|street|location|mailing\s*address|address\s*1|full\s*address)$/i],
  ['website',      /^(website|web|url|site|homepage)$/i],
  ['contact_name', /^(contact|contact\s*name|primary\s*contact|attn)$/i],
  ['notes',        /^(notes?|comments?|description|details)$/i],
  ['name',         /^(name|full\s*name|customer|customer\s*name|client|client\s*name|account)$/i],
];

/** First and last name arriving in separate columns, which is very common. */
const FIRST = /^(first|first\s*name|given\s*name|forename)$/i;
const LAST = /^(last|last\s*name|surname|family\s*name)$/i;

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const looksLikePhone = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d.length >= 7 && d.length <= 15 && /^[\d\s()+.-]+$/.test(v);
};

export function parseContacts(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], headers: [], mapping: {}, skipped: 0, needsHelp: true };
  }

  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);

  const mapping: Record<string, string | null> = {};
  let firstIdx = -1;
  let lastIdx = -1;

  headers.forEach((h, i) => {
    if (FIRST.test(h)) { firstIdx = i; mapping[h] = 'name (first)'; return; }
    if (LAST.test(h))  { lastIdx = i;  mapping[h] = 'name (last)';  return; }
    const hit = PATTERNS.find(([, re]) => re.test(h));
    mapping[h] = hit ? hit[0] : null;
  });

  const hasName =
    Object.values(mapping).includes('name') || (firstIdx >= 0 || lastIdx >= 0);

  /**
   * With no recognisable header row the file probably starts straight into
   * data, so the first line is a contact rather than a set of labels. Reading
   * it as data and guessing fields from the values beats discarding somebody.
   */
  const bodyLines = hasName ? lines.slice(1) : lines;

  const rows: SheetRow[] = [];
  let skipped = 0;

  for (const line of bodyLines) {
    const cells = splitLine(line, delim);
    const row: SheetRow = { name: '' };
    const extra: Record<string, string> = {};

    if (firstIdx >= 0 || lastIdx >= 0) {
      row.name = [cells[firstIdx] ?? '', cells[lastIdx] ?? ''].join(' ').trim();
    }

    cells.forEach((v, i) => {
      const value = (v ?? '').trim();
      if (!value) return;
      const field = hasName ? mapping[headers[i]] : null;

      if (field && field !== 'name (first)' && field !== 'name (last)') {
        (row as unknown as Record<string, string>)[field] = value;
        return;
      }
      if (field === 'name (first)' || field === 'name (last)') return;

      // Unlabelled column: work it out from the value itself rather than
      // discarding it.
      if (!row.email && looksLikeEmail(value)) { row.email = value; return; }
      if (!row.phone && looksLikePhone(value)) { row.phone = value; return; }
      if (!row.name && /[A-Za-z]{2,}/.test(value) && !looksLikeEmail(value)) {
        row.name = value;
        return;
      }
      if (hasName && headers[i]) extra[headers[i]] = value;
    });

    // A row with no name but a real email still describes somebody. Use the
    // part before the @ rather than throwing the contact away.
    if (!row.name && row.email) row.name = row.email.split('@')[0].replace(/[._-]+/g, ' ');

    if (!row.name && !row.email && !row.phone) { skipped++; continue; }
    if (Object.keys(extra).length) row.extra = extra;
    rows.push(row);
  }

  return {
    rows,
    headers,
    mapping,
    skipped,
    // Worth a person's attention if we got nothing, or if most rows came out
    // nameless — both mean the columns were probably read wrong.
    needsHelp:
      rows.length === 0 ||
      rows.filter((r) => r.name).length < rows.length * 0.5,
  };
}

/** Obvious duplicates within one file, and against what is already stored. */
export function findDuplicates(
  rows: SheetRow[],
  existing: Array<{ name: string; email: string | null }>
): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();

  const key = (name: string, email?: string | null) =>
    (email ?? '').trim().toLowerCase() || name.trim().toLowerCase();

  for (const e of existing) seen.add(key(e.name, e.email));

  rows.forEach((r, i) => {
    const k = key(r.name, r.email);
    if (seen.has(k)) dupes.add(i);
    else seen.add(k);
  });

  return dupes;
}
