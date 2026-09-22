'use client';

/**
 * Drop anything here.
 *
 * Given a target it files on arrival and shows what is already attached.
 * Given none it drops into the inbox and the "who is this about" question
 * waits. Same component either way, because "attach to this person" and
 * "deal with it later" are the same act with the answer supplied at
 * different times.
 *
 * Images get their palette read on the way in. That is free arithmetic in the
 * browser, so the colors of a logo are known before anybody asks for them —
 * which is the difference between a filing cabinet and something that sorts.
 */

import { useCallback, useEffect, useState } from 'react';
import { C } from '@/lib/spine/tokens';
import { ClientIntake, type IntakeSeed } from './ClientIntake';
import { human } from '@/lib/spine/errors';
import { DropZone } from './DropZone';
import { extractPalette, SAMPLE_EDGE } from '@/lib/spine/palette';
import {
  addDrop, listDrops, removeDrop, dropUrl, fileDrop,
  type Drop, type DropTarget,
} from '@/lib/spine/drops';

/** Somewhere a loose item can be filed to. */
export interface FilingOption { id: string; name: string; kind: 'person' | 'customer' }

interface Props {
  orgId: string;
  /** Omit to drop into the inbox instead of filing on arrival. */
  target?: DropTarget;
  /** Shown above the zone. */
  label?: string;
  compact?: boolean;
  /**
   * Offered per item when nothing is filed yet. The inbox asks exactly one
   * question and this is it; everything else about a loose file can wait.
   */
  filingOptions?: FilingOption[];
  onChange?: () => void;
}

const isImage = (f: File) => f.type.startsWith('image/');

const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Palette on arrival, in the browser, for nothing. */
async function paletteOf(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve([]);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve([]);
      img.onload = () => {
        try {
          const scale = Math.min(1, SAMPLE_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve([]);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(extractPalette(ctx.getImageData(0, 0, w, h).data, 6).map((s) => s.hex));
        } catch { resolve([]); }
      };
      img.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}

export function DropShelf({ orgId, target, label, compact, filingOptions, onChange }: Props) {
  const [items, setItems] = useState<Drop[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  /**
   * Turning a drop into records.
   *
   * A shelf that only holds things teaches people it is a bin. A price sheet
   * sitting here as text is the same content the intake reads on the Clients
   * screen, so it gets the same treatment: read it, check it, keep it.
   */
  const [readingDrop, setReadingDrop] = useState<{ id: string; seed: IntakeSeed } | null>(null);

  const readIt = useCallback(async (d: Drop) => {
    if (d.kind === 'note' || d.kind === 'link') {
      setReadingDrop({ id: d.id, seed: { text: d.body ?? '', label: 'that note' } });
      return;
    }
    const url = await dropUrl(d);
    if (!url) return;
    const blob = await fetch(url).then((r) => r.blob());
    const b64 = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? '').split(',')[1] ?? '');
      r.readAsDataURL(blob);
    });
    setReadingDrop({
      id: d.id,
      seed: { data: b64, mediaType: blob.type || d.mime || 'application/pdf', label: d.title ?? 'that file' },
    });
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const rows = await listDrops({ orgId, target, unfiledOnly: !target });
      setItems(rows);
      const next: Record<string, string> = {};
      await Promise.all(rows.filter((r) => r.kind === 'image').slice(0, 24).map(async (r) => {
        const u = await dropUrl(r);
        if (u) next[r.id] = u;
      }));
      setUrls(next);
    } catch (e) {
      setError(human(e));
    }
  }, [orgId, target?.person_id, target?.customer_id, target?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const take = useCallback(async (files: FileList | File[]) => {
    if (!orgId) return;
    setBusy(true); setError('');
    try {
      for (const f of Array.from(files)) {
        const meta = isImage(f) ? { palette: await paletteOf(f) } : {};
        await addDrop(orgId, {
          kind: isImage(f) ? 'image' : 'file',
          title: f.name,
          file: f,
          meta,
        }, target);
      }
      await load();
      onChange?.();
    } catch (e) {
      setError(human(e));
    }
    setBusy(false);
  }, [orgId, target, load, onChange]);

  const takeText = useCallback(async () => {
    const v = text.trim();
    if (!v || !orgId) return;
    setBusy(true); setError('');
    try {
      await addDrop(orgId, {
        kind: looksLikeUrl(v) ? 'link' : 'note',
        title: looksLikeUrl(v) ? v.replace(/^https?:\/\//, '').slice(0, 80) : null,
        body: v,
      }, target);
      setText('');
      await load();
      onChange?.();
    } catch (e) {
      setError(human(e));
    }
    setBusy(false);
  }, [text, orgId, target, load, onChange]);

  if (readingDrop) {
    return (
      <ClientIntake
        orgId={orgId}
        seed={readingDrop.seed}
        onSaved={async (made) => {
          /*
            Filed onto what it became, not just marked dealt with.
            
            The PDF is the evidence for the client it created, so it belongs on
            that record rather than dissolving into rows with nothing linking
            back to where they came from.
          */
          await fileDrop(readingDrop.id, made?.customerId ? { customer_id: made.customerId } : {});
          await load();
          onChange?.();
        }}
        onClose={() => setReadingDrop(null)}
      />
    );
  }

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>
          {label}
        </div>
      )}

      <DropZone
        label={busy ? 'Saving…' : 'Drop files here, or click to choose'}
        hint="Screenshots, photos, PDFs, spreadsheets — anything you would otherwise leave in a folder."

        busy={busy}
        busyLabel="Saving…"
        compact={compact}
        onFiles={(files) => take(files)}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') takeText(); }}
          placeholder="Or paste a link, or just type what you want to remember."
          style={{
            flex: 1, fontSize: 12.5, padding: '8px 10px', fontFamily: 'inherit',
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, background: C.panel,
          }}
        />
        <button
          onClick={takeText}
          disabled={!text.trim() || busy}
          style={{
            background: 'transparent', border: 'none', padding: '0 4px',
            color: text.trim() ? C.blue : C.faint, fontSize: 12.5,
            cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
          }}
        >
          Save
        </button>
      </div>

      {error && <p style={{ fontSize: 12.5, color: C.red, margin: '8px 0 0' }}>{error}</p>}

      {items.some((d) => !d.filed_at) && (
        <div
          style={{
            border: `1px solid ${C.border}`, borderRadius: 9,
            padding: '10px 12px', marginTop: 12, background: C.panelAlt,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {items.filter((d) => !d.filed_at).length} waiting to be read
          </div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2, lineHeight: 1.5 }}>
            Saving keeps the file. Reading turns it into records — a client and its people, a
            price list, or a job with its line items. Nothing is written until you check it.
          </div>
        </div>
      )}

      {items.length > 0 && (
        /*
          Rows, not thumbnails.

          These were 140px tiles, which suits a wall of logos and suits nothing
          else. A PDF called "8908 turks cap - Fireplace - estimate (1).pdf" is
          mostly filename, and in a 140px column the name was truncated, then
          printed a second time, and the one button that matters was squeezed
          under both. The name is the whole of what you recognise it by, so it
          gets the width, and Read it gets to look like the thing to press.
        */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {items.map((d) => {
            /*
              Say when something is already here.

              The shelf held "8908 turks cap - Fireplace - estimate.pdf" and
              "8908 turks cap - Fireplace - estimate (1).pdf", which is the
              same estimate dropped twice — the browser added the (1), and the
              shelf treated it as a second document. Read both and you get two
              jobs for one fireplace.

              Not deleted: a file somebody dropped is theirs, and two files
              with similar names are occasionally two real files. It is said
              out loud, next to Remove, and the decision stays with the person
              who dropped it.
            */
            const bare = (t: string | null | undefined) =>
              (t ?? '').replace(/\s*\(\d+\)(?=\.[^.]+$|$)/, '').trim().toLowerCase();
            const twin =
              d.title && items.find((o) => o.id !== d.id && bare(o.title) === bare(d.title));
            const palette = Array.isArray(d.meta?.palette) ? (d.meta.palette as string[]) : [];
            const label =
              d.kind === 'note' ? (d.body ?? 'Note')
              : d.kind === 'link' ? (d.body ?? 'Link')
              : (d.title ?? 'Untitled');
            return (
              <div
                key={d.id}
                style={{
                  border: `1px solid ${C.border}`, borderRadius: 9, padding: 10,
                  display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
                }}
              >
                {d.kind === 'image' && urls[d.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[d.id]}
                    alt={d.title ?? ''}
                    style={{ width: 54, height: 54, objectFit: 'contain', background: C.panelAlt, borderRadius: 6, flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 54, height: 54, borderRadius: 6, background: C.panelAlt,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10.5, color: C.faint, flexShrink: 0, textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {d.kind === 'note' ? 'Note' : d.kind === 'link' ? 'Link' : (d.title ?? '').split('.').pop()?.slice(0, 4) || 'File'}
                  </div>
                )}

                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  {/*
                    Two lines of it, not all of it.

                    A note printed its entire body. Somebody pasted a supplier's
                    price list — nine hundred words of "Emperor Fillets 4–6 oz
                    1,364 cs 13,640 lbs $4.70/lb" — and the card grew to fill
                    the screen with it. Three of those in a row and the shelf is
                    a wall of somebody else's spreadsheet, with Read it floating
                    somewhere down the middle of the card because it was
                    vertically centred against eight hundred pixels of text.

                    The first two lines are enough to know which one this is,
                    which is all the shelf has to do; reading it is what the
                    button is for. Everything on the card sits at the top now,
                    so the button is where it was on the card above.
                  */}
                  <div
                    style={{
                      fontSize: 13.5, color: C.text, lineHeight: 1.45, wordBreak: 'break-word',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {label}
                  </div>
                  {label.length > 150 && (
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                      {label.length.toLocaleString()} characters — press Read it to file what is in it
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: C.faint }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                    {d.storage_path && (
                      <button
                        onClick={async () => { const u = await dropUrl(d); if (u) window.open(u, '_blank', 'noopener'); }}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: C.blue, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Open</button>
                    )}
                    {d.kind === 'link' && d.body && (
                      <a href={d.body} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.blue, fontSize: 11.5, textDecoration: 'none' }}>Open</a>
                    )}
                    <button
                      onClick={async () => { await removeDrop(d); await load(); onChange?.(); }}
                      style={{ background: 'transparent', border: 'none', padding: 0, color: C.faint, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Remove</button>
                    {twin && (
                      <span style={{ fontSize: 11.5, color: C.amber }}>
                        Already here — same file, dropped twice
                      </span>
                    )}
                    {palette.length > 0 && (
                      <span style={{ display: 'inline-flex', height: 8, width: 54, borderRadius: 2, overflow: 'hidden' }} title={palette.join('  ')}>
                        {palette.slice(0, 6).map((hex) => (
                          <span key={hex} style={{ flex: 1, background: hex }} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {filingOptions && filingOptions.length > 0 && !d.filed_at && (
                  <select
                    defaultValue=""
                    onChange={async (e) => {
                      const opt = filingOptions.find((o) => o.id === e.target.value);
                      if (!opt) return;
                      await fileDrop(d.id, opt.kind === 'person'
                        ? { person_id: opt.id }
                        : { customer_id: opt.id });
                      await load();
                      onChange?.();
                    }}
                    style={{
                      fontSize: 12, padding: '6px 8px', flexShrink: 0,
                      border: `1px solid ${C.border}`, borderRadius: 7,
                      color: C.dim, background: C.panel, fontFamily: 'inherit',
                    }}
                  >
                    <option value="">Who is this about?</option>
                    {filingOptions.map((o) => (
                      <option key={`${o.kind}-${o.id}`} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}

                {/*
                  The one thing to do with it, as a button.

                  "Read it" was eleven pixels of blue text between Open and
                  Remove, and two clients in a row dropped files and then asked
                  what happens next. Nothing happens next: reading is the whole
                  point and it was the least visible thing on the card.
                */}
                {!d.filed_at && (
                  <button
                    onClick={() => readIt(d)}
                    style={{
                      border: 'none', borderRadius: 7, flexShrink: 0,
                      background: C.ink, color: '#fff', cursor: 'pointer',
                      padding: '9px 16px', fontSize: 13, fontWeight: 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    Read it &rarr;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
