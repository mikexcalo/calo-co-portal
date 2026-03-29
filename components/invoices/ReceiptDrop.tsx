'use client';

import { useState } from 'react';
import styles from './ReceiptDrop.module.css';

interface ReceiptDropProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
}

export default function ReceiptDrop({ onFilesSelected, isLoading = false }: ReceiptDropProps) {
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'reading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );

    if (files.length > 0) {
      processFiles(files);
    } else {
      setErrorMessage('Please drop image files (PNG, JPG) or PDFs');
      setExtractionStatus('error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );

    if (validFiles.length === 0) {
      setErrorMessage('Only image and PDF files are supported');
      setExtractionStatus('error');
      return;
    }

    setExtractionStatus('reading');
    setErrorMessage('');

    // Read images for preview
    const imagePromises = validFiles
      .filter((f) => f.type.startsWith('image/'))
      .map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          })
      );

    const loadedImages = await Promise.all(imagePromises);
    setImages(loadedImages);

    // Notify parent of files
    onFilesSelected(validFiles);
    setExtractionStatus('idle');
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (newImages.length === 0) {
      setExtractionStatus('idle');
    }
  };

  return (
    <div className={styles.container}>
      <label htmlFor="receipt-input" className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {images.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.icon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div className={styles.label}>Drop screenshots here</div>
            <div className={styles.sub}>or click to browse files</div>
            <div className={styles.hint}>PNG · JPG · PDF</div>
          </div>
        ) : (
          <div className={styles.preview}>
            {images.map((src, idx) => (
              <div key={idx} className={styles.imageWrapper}>
                <img src={src} alt={`Preview ${idx}`} className={styles.image} />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    removeImage(idx);
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          id="receipt-input"
          ref={(input) => {
            if (input) input.hidden = true;
          }}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={handleFileInput}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
      </label>

      {extractionStatus === 'reading' && (
        <div className={styles.status} style={{ color: '#64748b' }}>
          ⏳ Reading receipt...
        </div>
      )}

      {extractionStatus === 'error' && errorMessage && (
        <div className={styles.status} style={{ color: '#dc2626' }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
