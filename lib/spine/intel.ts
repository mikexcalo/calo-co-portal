/**
 * Getting what you know into the system with as little ceremony as possible.
 *
 * The drop is the moment this either works or does not. Somebody has just come
 * off a call with a notebook full of scrawl and half a transcript in their
 * clipboard, and any step between them and getting it in is a step where it
 * ends up in a Google Doc instead. So: paste it, or drag the photo in, and the
 * file type is our problem rather than theirs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** What Anthropic's vision will actually accept. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Five megabytes, which is the API's own ceiling per image.
 *
 * A phone photo of a notebook page is usually two to four, so this rarely
 * bites, and when it does the message says what to do about it.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isReadableImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type);
}

/** Anything we can just read as characters. Transcripts arrive as all of these. */
export function isPlainText(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /\.(txt|md|vtt|srt|csv|rtf|json)$/i.test(file.name)
  );
}

export interface DropFile {
  file: File;
  kind: 'image' | 'text';
}

export function sortFiles(files: File[]): { usable: DropFile[]; rejected: string[] } {
  const usable: DropFile[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (isReadableImage(file)) {
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name} is over 5MB. Screenshot it smaller or split the page.`);
        continue;
      }
      usable.push({ file, kind: 'image' });
    } else if (isPlainText(file)) {
      usable.push({ file, kind: 'text' });
    } else {
      /**
       * Named, not silently dropped.
       *
       * A PDF that vanishes without comment is the worst outcome here: the
       * person believes the brief is in and it is not. Saying so costs a line.
       */
      rejected.push(`${file.name} cannot be read yet. Paste the text, or screenshot the page.`);
    }
  }

  return { usable, rejected };
}

export function readText(file: File): Promise<string> {
  return file.text();
}

/** Base64 without the data: prefix, which is what the API wants. */
export async function readImage(file: File): Promise<{ media_type: string; data: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  // Chunked, because spreading a few million bytes into String.fromCharCode
  // overflows the call stack on exactly the large photos this is for.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { media_type: file.type, data: btoa(binary) };
}

/**
 * Stored privately, under the brand it belongs to.
 *
 * Same bucket as the rest of a client's material, which means the same rule:
 * no public URL, signed at the moment somebody signed in asks for it.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  brandId: string,
  file: File
): Promise<string | null> {
  const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-60);
  const path = `intel/${brandId}/${Date.now()}-${safe}`;
  const res = await supabase.storage.from('client-assets').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  return res.error ? null : path;
}

export interface SavedDrop {
  kind: string;
  title: string | null;
  body: string;
  image_path: string | null;
  source: string | null;
}

/**
 * Turn whatever was dropped into rows, keeping one row per source.
 *
 * One row per file rather than one merged blob, because a photograph of page
 * two and a pasted transcript are separately checkable and separately wrong.
 * Merging them means a bad reading of one poisons the record of the other.
 */
export async function buildDrops(
  supabase: SupabaseClient,
  brandId: string,
  opts: { text?: string; kind?: string; source?: string; files?: DropFile[] }
): Promise<{ drops: SavedDrop[]; failed: string[] }> {
  const drops: SavedDrop[] = [];
  const failed: string[] = [];

  const pasted = (opts.text ?? '').trim();
  if (pasted) {
    drops.push({
      kind: opts.kind ?? 'note',
      title: null,
      body: pasted,
      image_path: null,
      source: opts.source?.trim() || null,
    });
  }

  for (const f of opts.files ?? []) {
    if (f.kind === 'text') {
      const body = (await readText(f.file)).trim();
      if (!body) {
        failed.push(`${f.file.name} was empty.`);
        continue;
      }
      drops.push({
        kind: 'transcript',
        title: f.file.name,
        body,
        image_path: null,
        source: opts.source?.trim() || f.file.name,
      });
    } else {
      const path = await uploadImage(supabase, brandId, f.file);
      if (!path) {
        failed.push(`${f.file.name} did not upload.`);
        continue;
      }
      drops.push({
        kind: 'image',
        title: f.file.name,
        body: '',
        image_path: path,
        source: opts.source?.trim() || f.file.name,
      });
    }
  }

  return { drops, failed };
}
