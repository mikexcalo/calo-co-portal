'use client';

/**
 * Photos of the work, filed against the customer.
 *
 * The gap: a contractor finishes a bathroom and takes eight pictures. They sit
 * in a camera roll with four thousand others, and by the time they are wanted
 * — for a warranty argument, a portfolio, or the next estimate for the same
 * house — nobody can find them.
 *
 * Deliberately not the receipts pipeline. A receipt is read once and turned
 * into a number; a photo is looked at. No extraction runs here, so no model
 * tokens are spent and there is no approval screen to sit through. Drop them
 * and they are filed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, SectionLabel } from './ui';
import { Confirm } from './Confirm';
import { Processing } from './Processing';

interface Photo {
  id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
  url?: string;
}

const MAX_BYTES = 15_000_000;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function Photos({
  orgId,
  customerId,
  jobId,
}: {
  orgId: string;
  customerId?: string;
  jobId?: string;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Photo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from('documents')
      .select('id, storage_path, file_name, created_at')
      .eq('org_id', orgId)
      .eq('kind', 'photo')
      .order('created_at', { ascending: false });
    if (customerId) q = q.eq('customer_id', customerId);
    if (jobId) q = q.eq('job_id', jobId);

    const res = await q;
    if (res.error) { setError(res.error.message); return; }

    /**
     * Signed URLs rather than a public bucket. A photo of somebody's house
     * interior is not something to leave on a guessable address, and the
     * bucket these live in is private for that reason.
     */
    const rows = (res.data ?? []) as Photo[];
    const signed = await Promise.all(
      rows.map(async (r) => {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(r.storage_path, 3600);
        return { ...r, url: data?.signedUrl };
      })
    );
    setPhotos(signed);
  }, [orgId, customerId, jobId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const bad = list.filter((f) => !OK_TYPES.includes(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (bad.length) {
      setError(`${bad.map((f) => f.name).join(', ')}: not an image we can show.`);
      return;
    }
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      setError(`${tooBig.map((f) => f.name).join(', ')}: larger than 15MB.`);
      return;
    }

    setError(null);
    setBusy(true);
    setUploading(list.length);

    for (const file of list) {
      // Path includes the org so a stray listing can never span businesses,
      // and a timestamp so two photos named IMG_0001 do not overwrite one
      // another. Phones produce that name constantly.
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${orgId}/photos/${Date.now()}-${safe}`;

      const up = await supabase.storage.from('documents').upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });
      if (up.error) { setError(up.error.message); break; }

      const row = await supabase.from('documents').insert({
        org_id: orgId,
        customer_id: customerId ?? null,
        job_id: jobId ?? null,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || 'image/jpeg',
        size_bytes: file.size,
        kind: 'photo',
        // Nothing to review: no extraction ran.
        status: 'filed',
      });
      if (row.error) {
        // Don't leave the file orphaned in storage if the record failed.
        await supabase.storage.from('documents').remove([path]);
        setError(row.error.message);
        break;
      }
      setUploading((n) => n - 1);
    }

    setBusy(false);
    setUploading(0);
    if (inputRef.current) inputRef.current.value = '';
    await load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    // Row first. An orphaned file costs pennies; a row pointing at a file
    // that is gone renders a broken image on the customer's page.
    await supabase.from('documents').delete().eq('id', confirmDelete.id);
    await supabase.storage.from('documents').remove([confirmDelete.storage_path]);
    setBusy(false);
    setConfirmDelete(null);
    setLightbox(null);
    await load();
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>Photos ({photos.length})</SectionLabel>
        <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? `Uploading ${uploading}…` : 'Add photos'}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />

      {error && (
        <div style={{ fontSize: 13.5, color: C.red, margin: '6px 0 10px', lineHeight: 1.55 }}>{error}</div>
      )}

      {busy && uploading > 0 && (
        <div style={{ margin: '8px 0 10px' }}>
          {/* Photos are stored, never read, so offering a reading stage would
              be describing work that never happens. */}
          <Processing stage="uploading" stages={['uploading', 'saving']} count={uploading} />
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
        style={{
          border: `${dragging ? 2 : 1}px ${dragging ? 'dashed' : 'solid'} ${dragging ? C.blue : C.border}`,
          background: dragging ? C.blueSoft : 'transparent',
          borderRadius: 10,
          padding: photos.length ? 10 : 0,
          transition: 'border-color .15s, background .15s',
        }}
      >
        {photos.length === 0 ? (
          <Card>
            <Empty>
              Before and after shots, the finished work, a problem you found behind a wall. Drop
              them here or use Add photos.
            </Empty>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
              gap: 8,
            }}
          >
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setLightbox(p)}
                title={p.file_name}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  border: `1px solid ${C.border}`,
                  borderRadius: 999,
                  overflow: 'hidden',
                  padding: 0,
                  background: C.panelAlt,
                  cursor: 'zoom-in',
                }}
              >
                {p.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.file_name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(12,16,22,.86)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 14,
          }}
        >
          {lightbox.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.file_name}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
            />
          )}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <span style={{ color: '#fff', fontSize: 13.5, opacity: 0.85 }}>{lightbox.file_name}</span>
            <a
              href={lightbox.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', fontSize: 13.5, textDecoration: 'underline' }}
            >
              Open full size
            </a>
            <button
              onClick={() => setConfirmDelete(lightbox)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.35)',
                color: '#fff',
                borderRadius: 999,
                padding: '5px 11px',
                fontSize: 13.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <Confirm
          title="Delete this photo?"
          body="It is removed from storage as well as from this list, and cannot be recovered."
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
