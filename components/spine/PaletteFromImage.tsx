'use client';

/**
 * Drop a logo, get the hexes.
 *
 * The case this exists for: somebody sends you their mark as a PNG and the
 * colours are now locked inside an image. Until today the answer was an
 * eyedropper, which gets close enough to look right and wrong enough to
 * mismatch their real asset on the first thing you print.
 *
 * Nothing leaves the browser. The file is read with FileReader, drawn to a
 * canvas, clustered, and forgotten — no upload, no API key, no per-image
 * charge, and it works on a prospect's logo before they are a client and
 * before there is anywhere to file it.
 */

import { useCallback, useRef, useState } from 'react';
import { C } from '@/lib/spine/tokens';
import { extractPalette, SAMPLE_EDGE, type Swatch } from '@/lib/spine/palette';

interface Props {
  /** Hands the chosen swatches to whoever owns the kit. */
  onAdd?: (colors: { name: string; hex: string; role: string }[]) => void;
}

const ROLE_NOTE: Record<Swatch['role'], string> = {
  primary: 'The colour the brand is known by',
  secondary: 'Second most present',
  accent: 'Used sparingly',
  ink: 'Text and dark marks',
  paper: 'Background',
  neutral: 'Greys and rules',
};

export function PaletteFromImage({ onAdd }: Props) {
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const read = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('That is not an image. PNG, JPG, SVG or WEBP.');
      return;
    }
    setError('');
    setBusy(true);

    const reader = new FileReader();
    reader.onerror = () => { setError('That file could not be read.'); setBusy(false); };
    reader.onload = () => {
      const src = String(reader.result ?? '');
      const img = new Image();
      img.onerror = () => { setError('That image could not be opened.'); setBusy(false); };
      img.onload = () => {
        try {
          // Long edge to SAMPLE_EDGE. Same palette, a fraction of the work.
          const scale = Math.min(1, SAMPLE_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('no context');
          ctx.drawImage(img, 0, 0, w, h);
          const found = extractPalette(ctx.getImageData(0, 0, w, h).data, 6);
          setSwatches(found);
          // Pre-select the colours, not the greys — the greys are usually the
          // card the logo was sitting on.
          setPicked(new Set(found.filter((s) => s.role === 'primary' || s.role === 'secondary' || s.role === 'accent').map((s) => s.hex)));
          setPreview(src);
          if (!found.length) setError('No solid colour in that image.');
        } catch {
          setError('That image could not be read. An SVG with no fixed size is the usual cause, export it as PNG.');
        }
        setBusy(false);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  const toggle = (hex: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex); else next.add(hex);
      return next;
    });

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(''), 1200);
    }).catch(() => {});
  };

  const chosen = swatches.filter((s) => picked.has(s.hex));

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) read(f);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
        style={{
          border: `1px dashed ${C.border}`,
          borderRadius: 10,
          padding: preview ? 12 : 22,
          textAlign: 'center',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          minHeight: 72,
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain' }} />
        ) : null}
        <span style={{ fontSize: 12.5, color: C.faint }}>
          {busy ? 'Reading…' : preview ? 'Drop another to replace it.' : 'Drop a logo here, or click to choose one.'}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }}
      />

      {error ? (
        <p style={{ fontSize: 12.5, color: C.amber, margin: '10px 0 0' }}>{error}</p>
      ) : null}

      {swatches.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 12, marginTop: 14 }}>
            {swatches.map((s) => {
              const on = picked.has(s.hex);
              return (
                <div key={s.hex} style={{ border: `1px solid ${on ? C.ink : C.border}`, borderRadius: 9, overflow: 'hidden' }}>
                  <button
                    onClick={() => toggle(s.hex)}
                    title={on ? 'Chosen. Click to leave it out.' : 'Click to include it.'}
                    style={{ display: 'block', width: '100%', height: 52, background: s.hex, border: 'none', cursor: 'pointer', padding: 0 }}
                  />
                  <div style={{ padding: '7px 8px 8px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{s.name}</div>
                    <button
                      onClick={() => copy(s.hex)}
                      style={{ background: 'transparent', border: 'none', padding: 0, margin: '2px 0 0', fontSize: 11.5, color: C.dim, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)' }}
                    >
                      {copied === s.hex ? 'Copied' : s.hex}
                    </button>
                    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 3 }}>
                      {ROLE_NOTE[s.role]} · {Math.round(s.share * 100)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
            <span style={{ fontSize: 12.5, color: C.faint, flex: 1 }}>
              {chosen.length} of {swatches.length} chosen. Click a swatch to include or leave it out, click the hex to copy it.
            </span>
            {onAdd && (
              <button
                disabled={!chosen.length}
                onClick={() => {
                  onAdd(chosen.map((s) => ({ name: s.name, hex: s.hex, role: s.role })));
                  setPicked(new Set());
                }}
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  color: chosen.length ? C.blue : C.faint,
                  fontSize: 12.5, cursor: chosen.length ? 'pointer' : 'default', fontFamily: 'inherit',
                }}
              >
                Add to colors
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
