'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme';

interface ColorPaletteProps {
  colors: string[];
  readOnly: boolean;
  onColorsChange?: (colors: string[]) => void;
}

export default function ColorPalette({ colors, readOnly, onColorsChange }: ColorPaletteProps) {
  const { t } = useTheme();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState('');
  const [dropperImage, setDropperImage] = useState<string | null>(null);
  const [eyedropperImage, setEyedropperImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyedropperCanvasRef = useRef<HTMLCanvasElement>(null);
  const dropperInputRef = useRef<HTMLInputElement>(null);

  // Draw eyedropper image onto canvas when loaded
  useEffect(() => {
    if (eyedropperImage && eyedropperCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const cvs = eyedropperCanvasRef.current!;
        const maxW = 400;
        const scale = Math.min(maxW / img.width, 1);
        cvs.width = Math.floor(img.width * scale);
        cvs.height = Math.floor(img.height * scale);
        const ctx = cvs.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      };
      img.src = eyedropperImage;
    }
  }, [eyedropperImage]);

  const colorNames: Record<string, string> = {};
  colors.forEach((hex, idx) => {
    colorNames[hex] = `Color ${idx + 1}`;
  });

  const handleAddColor = () => {
    if (!readOnly) {
      const newColor = '#000000';
      const newColors = [...colors, newColor];
      onColorsChange?.(newColors);
    }
  };

  const handleEditColor = (idx: number) => {
    if (!readOnly) {
      setEditingIdx(idx);
      setEditHex(colors[idx]);
      setEditName(colorNames[colors[idx]]);
    }
  };

  const handleSaveColor = () => {
    if (editingIdx !== null && editHex.match(/^#[0-9a-f]{6}$/i)) {
      const newColors = [...colors];
      newColors[editingIdx] = editHex;
      colorNames[editHex] = editName;
      onColorsChange?.(newColors);
      setEditingIdx(null);
    }
  };

  const handleDeleteColor = (idx: number) => {
    if (!readOnly) {
      const deleted = colors[idx];
      const newColors = colors.filter((_, i) => i !== idx);
      delete colorNames[deleted];
      onColorsChange?.(newColors);
    }
  };

  const handleDropperImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = event.target?.result as string;
      setDropperImage(img);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractDominantColors = async () => {
    if (!dropperImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple color extraction: collect RGB values
      const colorMap: Record<string, number> = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        // Quantize to reduce color count
        const rq = Math.round(r / 51) * 51;
        const gq = Math.round(g / 51) * 51;
        const bq = Math.round(b / 51) * 51;

        const hex = `#${rq.toString(16).padStart(2, '0')}${gq.toString(16).padStart(2, '0')}${bq.toString(16).padStart(2, '0')}`.toUpperCase();

        colorMap[hex] = (colorMap[hex] || 0) + 1;
      }

      // Sort by frequency and get top 5
      const topColors = Object.entries(colorMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([hex]) => hex);

      const newColors = Array.from(new Set([...colors, ...topColors]));
      onColorsChange?.(newColors);
      setDropperImage(null);
    };
    img.src = dropperImage;
  };

  return (
    <div>
      {/* Color swatches */}
      <div className="bk-colors">
        {colors.map((hex, idx) => (
          <div key={idx} className="bk-swatch" style={{ position: 'relative' }}>
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteColor(idx); }}
                style={{
                  position: 'absolute', top: -4, right: -4, zIndex: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: t.bg.surface, border: `0.5px solid ${t.border.default}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: t.text.tertiary, padding: 0, lineHeight: 1,
                }}
                title="Delete color"
              >×</button>
            )}
            <div
              className="bk-chip"
              style={{
                backgroundColor: hex,
              }}
              onClick={() => handleEditColor(idx)}
              title="Click to edit"
            />
            <div className="bk-swatch-name">{colorNames[hex]}</div>
            <div className="bk-swatch-hex">{hex}</div>
          </div>
        ))}

        {!readOnly && (
          <button
            className="bk-add-chip"
            onClick={handleAddColor}
            title="Add new color"
          >
            +
          </button>
        )}
      </div>

      {/* Color editor */}
      {editingIdx !== null && !readOnly && (
        <div className="bk-color-editor open" onClick={(e) => e.stopPropagation()}>
          <div className="bk-ce-row">
            <label className="bk-ce-label">Name</label>
            <input
              type="text"
              className="bk-ce-input"
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              placeholder="e.g. Primary Blue"
            />
          </div>

          <div className="bk-ce-row">
            <label className="bk-ce-label">Hex</label>
            <input
              type="text"
              className="bk-ce-input"
              value={editHex}
              onChange={(e) => setEditHex(e.currentTarget.value)}
              placeholder="#000000"
            />
            <input
              type="color"
              className="bk-ce-picker"
              value={editHex}
              onChange={(e) => setEditHex(e.currentTarget.value)}
            />
          </div>

          <div className="bk-ce-actions">
            <button
              className="btn btn-sm"
              onClick={handleSaveColor}
              style={{ background: '#00C9A0', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              Save
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setEditingIdx(null)}
              style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                handleDeleteColor(editingIdx);
                setEditingIdx(null);
              }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Compact dropper — one click, auto-extract */}
      {!readOnly && (
        <div style={{ marginTop: '10px' }}>
          <button
            className="bk-dropper-btn"
            onClick={() => dropperInputRef.current?.click()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67V21h6.33l10.06-10.06a5.5 5.5 0 0 0 0-7.77z" />
              <line x1="17.5" y1="7.5" x2="6.5" y2="18.5" />
            </svg>
            Extract colors from image <span style={{ fontSize: 10, color: t.text.tertiary, marginLeft: 4 }}>(from logo or screenshot)</span>
          </button>

          <input
            ref={dropperInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const objUrl = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () => {
                // Scale down for performance
                const maxDim = 100;
                const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                const w = Math.floor(img.width * scale);
                const h = Math.floor(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, w, h).data;

                // Build frequency map with fine quantization (nearest 8)
                const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {};
                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                  if (a < 128) continue;
                  if (r > 240 && g > 240 && b > 240) continue;
                  if (r < 15 && g < 15 && b < 15) continue;
                  const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
                  if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
                  buckets[key].count++;
                  buckets[key].r += r; buckets[key].g += g; buckets[key].b += b;
                }

                // Sort by frequency, average actual RGB, deduplicate within distance 40
                const sorted = Object.values(buckets).sort((a, b) => b.count - a.count).slice(0, 20);
                const candidates = sorted.map(b => ({ r: Math.round(b.r / b.count), g: Math.round(b.g / b.count), b: Math.round(b.b / b.count) }));
                const unique: typeof candidates = [];
                for (const c of candidates) {
                  if (!unique.some(u => Math.sqrt((c.r - u.r) ** 2 + (c.g - u.g) ** 2 + (c.b - u.b) ** 2) < 40)) unique.push(c);
                  if (unique.length >= 5) break;
                }
                const hexColors = unique.map(c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join(''));
                const newColors = Array.from(new Set([...colors, ...hexColors]));
                onColorsChange?.(newColors);

                // Show eyedropper preview for manual picking
                setEyedropperImage(objUrl);
              };
              img.src = objUrl;
              e.target.value = '';
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Eyedropper preview — click to pick exact colors */}
          {eyedropperImage && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary }}>Click to pick a color</span>
                <button onClick={() => setEyedropperImage(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: t.text.tertiary, fontFamily: 'inherit' }}>Done</button>
              </div>
              <canvas
                ref={eyedropperCanvasRef}
                style={{ width: '100%', maxHeight: 200, borderRadius: 8, cursor: 'crosshair', border: `0.5px solid ${t.border.default}` }}
                onClick={(e) => {
                  const cvs = eyedropperCanvasRef.current;
                  if (!cvs) return;
                  const ctx = cvs.getContext('2d');
                  if (!ctx) return;
                  const rect = cvs.getBoundingClientRect();
                  const x = Math.floor((e.clientX - rect.left) * (cvs.width / rect.width));
                  const y = Math.floor((e.clientY - rect.top) * (cvs.height / rect.height));
                  const pixel = ctx.getImageData(x, y, 1, 1).data;
                  const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
                  const newColors = [...colors, hex];
                  onColorsChange?.(newColors);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
