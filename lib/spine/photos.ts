'use client';

/**
 * Filing a photo against a job, in one place.
 *
 * This was inside Photos.tsx, which was fine while the only way to add a
 * picture was the panel on a job page. The capture sheet adds a second way
 * in, and a second copy of "upload to storage, write the row, clean up the
 * file if the row fails" is how the two drift: one of them learns about HEIC,
 * the other does not, and nobody finds out until somebody's photo is missing.
 *
 * So both call this. It does no rendering and holds no state, which is what
 * makes it shareable.
 */

import supabase from '@/lib/supabase';
import { human } from './errors';
import { save as saveOrFail } from './save';

export const PHOTO_MAX_BYTES = 15_000_000;

/** What a phone camera actually produces, plus what a browser will show. */
export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export interface PhotoTarget {
  orgId: string;
  customerId?: string | null;
  jobId?: string | null;
}

/**
 * Upload some images and file them.
 *
 * Returns the first problem rather than throwing, because every caller wants
 * to put it on the screen next to the button that was pressed. `onProgress`
 * counts down the ones still going, for callers that show it.
 */
export async function uploadPhotos(
  target: PhotoTarget,
  files: FileList | File[],
  onProgress?: (remaining: number) => void
): Promise<{ error: string | null; saved: number }> {
  const list = Array.from(files);

  const bad = list.filter(
    (f) => !PHOTO_TYPES.includes(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)
  );
  if (bad.length) {
    return { error: `${bad.map((f) => f.name).join(', ')}: not an image we can show.`, saved: 0 };
  }

  const tooBig = list.filter((f) => f.size > PHOTO_MAX_BYTES);
  if (tooBig.length) {
    return { error: `${tooBig.map((f) => f.name).join(', ')}: larger than 15MB.`, saved: 0 };
  }

  let saved = 0;
  onProgress?.(list.length);

  for (const file of list) {
    // Path includes the org so a stray listing can never span businesses, and
    // a timestamp so two photos named IMG_0001 do not overwrite one another.
    // Phones produce that name constantly.
    const safe = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${target.orgId}/photos/${Date.now()}-${safe}`;

    const up = await supabase.storage.from('documents').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (up.error) return { error: human(up.error.message), saved };

    const row = await saveOrFail(
      supabase.from('documents').insert({
        org_id: target.orgId,
        customer_id: target.customerId ?? null,
        job_id: target.jobId ?? null,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || 'image/jpeg',
        size_bytes: file.size,
        kind: 'photo',
        // Nothing to review: no extraction ran.
        status: 'filed',
      })
    );
    if (row.error) {
      // Don't leave the file orphaned in storage if the record failed.
      await supabase.storage.from('documents').remove([path]);
      return { error: human(row.error.message), saved };
    }

    saved += 1;
    onProgress?.(list.length - saved);
  }

  return { error: null, saved };
}
