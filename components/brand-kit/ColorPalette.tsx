'use client';

import { useState, useRef } from 'react';

interface ColorPaletteProps {
  colors: string[];
  readOnly: boolean;
  onColorsChange?: (colors: string[]) => void;
}

export default function ColorPalette({ colors, readOnly, onColorsChange }: ColorPaletteProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState('');
  const [showDropper, setShowDropper] = useState(false);
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
      setShowDropper(false);
      setDropperImage(null);
    };
    img.src = dropperImage;
  };

  return (
    <div>
      {/* Color swatches */}
      <div className="bk-colors">
        {colors.map((hex, idx) => (
          <div key={idx} className="bk-swatch">
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

      {/* Dropper section */}
      {!readOnly && (
        <div style={{ marginTop: '10px' }}>
          <button
            className="bk-dropper-btn"
            onClick={() => setShowDropper(!showDropper)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L3 14.67V21h6.33l10.06-10.06a5.5 5.5 0 0 0 0-7.77z" />
              <line x1="17.5" y1="7.5" x2="6.5" y2="18.5" />
            </svg>
            Extract colors from image
          </button>

          {showDropper && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  border: '2px dashed #d0d0d0',
                  borderRadius: '6px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.13s',
                }}
                onClick={() => dropperInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.background = '#e8eeff';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d0d0d0';
                  e.currentTarget.style.background = '';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '#d0d0d0';
                  e.currentTarget.style.background = '';
                  const files = e.dataTransfer.files;
                  if (files?.[0]) {
                    handleDropperImageUpload({
                      currentTarget: { files } as any,
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ccc"
                  strokeWidth="1.5"
                  style={{ margin: '0 auto 6px' }}
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#aaa' }}>
                  Drop a screenshot here, or click to browse
                </div>
              </div>

              <input
                ref={dropperInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
                style={{ display: 'none' }}
                onChange={handleDropperImageUpload}
              />

              {dropperImage && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    className="bk-dropper-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleExtractDominantColors}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Auto-extract top 5 colors
                  </button>

                  <img
                    src={dropperImage}
                    alt="Preview"
                    style={{
                      marginTop: '10px',
                      maxWidth: '100%',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
