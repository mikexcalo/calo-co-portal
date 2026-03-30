'use client';

import { useState } from 'react';
import styles from './ReceiptDrop.module.css';

interface ReceiptDropProps {
  onFilesSelected: (files: File[]) => void;
  onExtract?: () => void;
  isLoading?: boolean;
}

const MAX_IMAGES = 5;

export default function ReceiptDrop({ onFilesSelected, onExtract, isLoading = false }: ReceiptDropProps) {
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (valid.length === 0) return;

    setImages((prev) => {
      const combined = [...prev];
      for (const file of valid) {
        if (combined.length >= MAX_IMAGES) break;
        if (combined.some((p) => p.file.name === file.name && p.file.size === file.size)) continue;
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
        combined.push({ file, preview });
      }
      // Notify parent of all accumulated files
      onFilesSelected(combined.map((c) => c.file));
      return combined;
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      onFilesSelected(next.map((c) => c.file));
      return next;
    });
  };

  return (
    <div>
      <label
        htmlFor="receipt-input"
        className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(Array.from(e.dataTransfer.files)); }}
      >
        {images.length === 0 ? (
          <div className={styles.empty}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginTop: 6 }}>Drop receipt screenshots here</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>or click to browse · up to {MAX_IMAGES} images</div>
            <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>PNG · JPG · PDF</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 4 }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {img.preview ? (
                  <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontSize: 9, color: '#94a3b8' }}>PDF</div>
                )}
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage(idx); }}
                  style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <div style={{ width: 64, height: 64, borderRadius: 6, border: '1.5px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 20 }}>+</div>
            )}
          </div>
        )}
        <input id="receipt-input" type="file" multiple accept="image/*,.pdf"
          onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
          disabled={isLoading} style={{ display: 'none' }} />
      </label>

      {/* Extract button — only when images are loaded */}
      {images.length > 0 && onExtract && (
        <button onClick={onExtract} disabled={isLoading} className="cta-btn"
          style={{ marginTop: 8, width: '100%', height: 34, fontSize: 12 }}>
          {isLoading ? `Extracting from ${images.length} image${images.length !== 1 ? 's' : ''}...` : `Extract from ${images.length} image${images.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
