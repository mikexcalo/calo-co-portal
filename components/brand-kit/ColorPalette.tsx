'use client';

import { useState, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropperInputRef = useRef<HTMLInputElement>(null);

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
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}
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
              if (!file || !canvasRef.current) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setDropperImage(dataUrl);
                // Extract directly without relying on state
                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const data = imageData.data;
                  const colorMap: Record<string, number> = {};
                  for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 128) continue;
                    const rq = Math.round(data[i] / 51) * 51;
                    const gq = Math.round(data[i + 1] / 51) * 51;
                    const bq = Math.round(data[i + 2] / 51) * 51;
                    const hex = `#${rq.toString(16).padStart(2, '0')}${gq.toString(16).padStart(2, '0')}${bq.toString(16).padStart(2, '0')}`.toUpperCase();
                    colorMap[hex] = (colorMap[hex] || 0) + 1;
                  }
                  const topColors = Object.entries(colorMap)
                    .sort(([, a], [, b]) => b - a)
                    .filter(([hex]) => hex !== '#000000' && hex !== '#FFFFFF')
                    .slice(0, 5)
                    .map(([hex]) => hex);
                  const newColors = Array.from(new Set([...colors, ...topColors]));
                  onColorsChange?.(newColors);
                  setDropperImage(null);
                };
                img.src = dataUrl;
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}
