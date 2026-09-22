/**
 * A spreadsheet, turned into something the reader can already handle.
 *
 * Uploads were widened to accept Excel and the reader was not, so a file could
 * be stored and then refused: John's price list went in, and pressing Scan and
 * sort answered "Drop a PDF, a photo, or paste text". Half a fix is worse than
 * none, because it looks like it worked right up until it matters.
 *
 * The extraction endpoint already reads plain text well. A spreadsheet is a
 * grid of text, so it becomes text here and goes down the path that works,
 * rather than teaching the far end a second file format.
 *
 * WHERE THIS RUNS AND WHY IT MATTERS
 *
 * In the browser, on a file the person sitting there chose themselves. The
 * parser carries a prototype-pollution advisory that npm has no fix for, and
 * the honest mitigation is that nothing here touches the server: the worst a
 * malicious spreadsheet reaches is the tab of the person who opened it. That
 * is a real limit, not a dismissal, and it is the reason this is not on an
 * endpoint anybody can post to.
 */

export async function sheetToText(file: File | Blob, name = 'spreadsheet'): Promise<string> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const book = XLSX.read(buf, { type: 'array' });

  const parts: string[] = [];
  for (const sheet of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_csv(book.Sheets[sheet], { blankrows: false });
    if (!rows.trim()) continue;
    // The sheet name is often the only place the supplier is written down.
    parts.push(book.SheetNames.length > 1 ? `--- ${sheet} ---\n${rows}` : rows);
  }

  const text = parts.join('\n\n').trim();
  if (!text) throw new Error(`${name} has no rows in it.`);

  /*
    Capped, because a price list can run to thousands of rows and the reader
    charges per document. The top of the sheet is where the headings and the
    supplier name live, which is what identifies it.
  */
  const LIMIT = 60_000;
  return text.length > LIMIT
    ? `${text.slice(0, LIMIT)}\n\n[...truncated, ${text.length.toLocaleString()} characters in total]`
    : text;
}

export const isSpreadsheet = (mime?: string | null, filename?: string | null): boolean => {
  const m = (mime ?? '').toLowerCase();
  const n = (filename ?? '').toLowerCase();
  return (
    m.includes('spreadsheetml') ||
    m.includes('ms-excel') ||
    m === 'text/csv' ||
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    n.endsWith('.csv')
  );
};
