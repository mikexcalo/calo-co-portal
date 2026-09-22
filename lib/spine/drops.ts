/**
 * Reading and writing the things that arrived without a home.
 *
 * One row shape, two ways in. `addDrop` with a target files it on arrival;
 * without one it waits in the inbox. Nothing else in the app needs to know
 * which door it came through.
 */

import supabase from '@/lib/supabase';

const BUCKET = 'documents';

export type DropKind = 'file' | 'image' | 'link' | 'note';

export interface Drop {
  id: string;
  org_id: string;
  kind: DropKind;
  title: string | null;
  body: string | null;
  storage_path: string | null;
  mime: string | null;
  bytes: number | null;
  person_id: string | null;
  customer_id: string | null;
  job_id: string | null;
  meta: Record<string, unknown>;
  filed_at: string | null;
  created_at: string;
}

/** At most one of these. A thing is about one subject. */
export interface DropTarget {
  person_id?: string | null;
  customer_id?: string | null;
  job_id?: string | null;
}

const targeted = (t: DropTarget | undefined) =>
  Boolean(t && (t.person_id || t.customer_id || t.job_id));

export async function addDrop(
  orgId: string,
  input: {
    kind: DropKind;
    title?: string | null;
    body?: string | null;
    file?: File | null;
    meta?: Record<string, unknown>;
  },
  target?: DropTarget
): Promise<Drop> {
  let storage_path: string | null = null;

  if (input.file) {
    const ext = input.file.name.split('.').pop()?.toLowerCase() || 'bin';
    storage_path = `${orgId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(storage_path, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
    /*
      Say which file, and why.

      "Upload failed: mime type application/vnd.openxmlformats-officedocument
      .wordprocessingml.document is not supported" is what John saw on his
      first real use of this. He read it as "it did not work", assumed it was
      him, and emailed the files instead.

      The two things that actually stop an upload are the type and the size,
      and both are worth saying in words somebody can act on.
    */
    if (up.error) {
      const msg = up.error.message.toLowerCase();
      if (msg.includes('mime') || msg.includes('not supported')) {
        throw new Error(
          `${input.file.name} is a kind of file this cannot take yet. Anything you can print, ` +
            'photograph or export as a PDF will go through.'
        );
      }
      if (msg.includes('size') || msg.includes('large') || msg.includes('exceed')) {
        throw new Error(`${input.file.name} is over 25MB. Anything smaller goes straight in.`);
      }
      throw new Error(`${input.file.name} did not upload. ${up.error.message}`);
    }
  }

  const { data: auth } = await supabase.auth.getUser();

  const row = {
    org_id: orgId,
    added_by: auth?.user?.id ?? null,
    kind: input.kind,
    title: input.title ?? null,
    body: input.body ?? null,
    storage_path,
    mime: input.file?.type ?? null,
    bytes: input.file?.size ?? null,
    person_id: target?.person_id ?? null,
    customer_id: target?.customer_id ?? null,
    job_id: target?.job_id ?? null,
    meta: input.meta ?? {},
    // Filed on arrival when it was dropped onto something.
    filed_at: targeted(target) ? new Date().toISOString() : null,
  };

  const res = await supabase.from('drops').insert(row).select('*').single();
  if (res.error) {
    // Never leave a file in storage with no row pointing at it.
    if (storage_path) await supabase.storage.from(BUCKET).remove([storage_path]).catch(() => {});
    throw new Error(res.error.message);
  }
  return res.data as Drop;
}

export async function listDrops(opts: {
  orgId: string;
  unfiledOnly?: boolean;
  target?: DropTarget;
}): Promise<Drop[]> {
  let q = supabase.from('drops').select('*').eq('org_id', opts.orgId);
  if (opts.unfiledOnly) q = q.is('filed_at', null);
  if (opts.target?.person_id) q = q.eq('person_id', opts.target.person_id);
  if (opts.target?.customer_id) q = q.eq('customer_id', opts.target.customer_id);
  if (opts.target?.job_id) q = q.eq('job_id', opts.target.job_id);
  const res = await q.order('created_at', { ascending: false }).limit(200);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as Drop[];
}

/**
 * Answering "who is this about", which is the only question the inbox asks.
 *
 * Called with an empty target it simply marks the thing dealt with — which is
 * what happens when a drop has been read into real records and no longer
 * needs anybody to decide about it.
 */
export async function fileDrop(id: string, target: DropTarget): Promise<void> {
  const res = await supabase
    .from('drops')
    .update({
      person_id: target.person_id ?? null,
      customer_id: target.customer_id ?? null,
      job_id: target.job_id ?? null,
      filed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (res.error) throw new Error(res.error.message);
}

export async function removeDrop(d: Drop): Promise<void> {
  if (d.storage_path) {
    await supabase.storage.from(BUCKET).remove([d.storage_path]).catch(() => {});
  }
  const res = await supabase.from('drops').delete().eq('id', d.id);
  if (res.error) throw new Error(res.error.message);
}

/** A viewable URL, valid for an hour. The bucket is private and stays private. */
export async function dropUrl(d: Drop): Promise<string | null> {
  if (!d.storage_path) return null;
  const res = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600);
  return res.data?.signedUrl ?? null;
}
