'use client';

import { useState, useRef } from 'react';
import { BrandKit, LogoFile } from '@/lib/types';
import { DB, uploadAsset, updateAssetPrimary, deleteAsset, saveBrandKit } from '@/lib/database';

interface LogoSlotProps {
  clientId: string;
  slotKey: 'color' | 'light' | 'dark' | 'icon' | 'secondary' | 'favicon';
  label: string;
  brandKit: BrandKit;
  readOnly: boolean;
  onFilesChange?: (slotKey: string, files: File[]) => void;
}

export default function LogoSlot({
  clientId,
  slotKey,
  label,
  brandKit,
  readOnly,
  onFilesChange,
}: LogoSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = brandKit.logos[slotKey] || [];
  const hasFiles = files.length > 0;

  // Determine if file is renderable (can be displayed)
  const isRenderable = (file: LogoFile): boolean => {
    const ext = (file.name.match(/\.([^.]+)$/) || [])[1] || '';
    return /^(png|jpg|jpeg|svg|webp|gif)$/i.test(ext);
  };

  // Get extension from filename
  const getExt = (name: string): string => {
    const match = name.match(/\.([^.]+)$/);
    return match ? match[1].toUpperCase() : 'FILE';
  };

  // Find primary file (prefer renderable)
  const primaryIdx = files.findIndex((f) => f.isPrimary && isRenderable(f));
  const previewFile = primaryIdx >= 0 ? files[primaryIdx] : files.find((f) => isRenderable(f));

  const handleClick = () => {
    if (!readOnly && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.files) {
      handleFiles(e.currentTarget.files);
    }
  };

  const handleFiles = async (fileList: FileList) => {
    if (!brandKit._id) {
      // Create brand kit row if it doesn't exist
      await saveBrandKit(brandKit, clientId);
    }

    if (!brandKit._id) {
      console.error('Brand kit not ready');
      return;
    }

    setUploading(true);

    const logoSlot = brandKit.logos[slotKey];
    const filesToAdd: LogoFile[] = [];

    for (const file of fileList) {
      // Read file as data URL for preview
      const reader = new FileReader();
      const filePromise = new Promise<void>((resolve) => {
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          const isFirst = logoSlot.length === 0 && filesToAdd.length === 0;

          // Add to local array
          const logoFile: LogoFile = {
            name: file.name,
            ext: getExt(file.name),
            size: file.size,
            data: dataUrl,
            isPrimary: isFirst && isRenderable({ name: file.name } as LogoFile),
            type: file.type,
          };

          filesToAdd.push(logoFile);

          // Upload to Supabase
          try {
            const result = await uploadAsset(brandKit._id!, slotKey, file);
            if (result) {
              logoFile._assetId = result.assetId;
              logoFile.data = result.url;
            }
          } catch (err) {
            console.error('Upload error:', err);
          }

          resolve();
        };
        reader.readAsDataURL(file);
      });

      await filePromise;
    }

    // Add all files to the slot
    filesToAdd.forEach((f) => {
      if (!logoSlot.find((existing) => existing.name === f.name)) {
        logoSlot.push(f);
      }
    });

    // Update primary file if needed
    const primaryRenderable = logoSlot.find((f) => f.isPrimary && isRenderable(f));
    if (!primaryRenderable) {
      const firstRenderable = logoSlot.find((f) => isRenderable(f));
      if (firstRenderable) {
        logoSlot.forEach((f) => (f.isPrimary = f === firstRenderable));
      }
    }

    setUploading(false);
    onFilesChange?.(slotKey, Array.from(fileList));
  };

  const handleSetPrimary = async (idx: number) => {
    if (readOnly) return;
    const file = files[idx];
    if (!file._assetId) return;

    // Update all files
    files.forEach((f, i) => {
      f.isPrimary = i === idx && isRenderable(f);
    });

    // Save to database
    if (brandKit._id) {
      await updateAssetPrimary(brandKit._id, slotKey, file._assetId);
    }

    onFilesChange?.(slotKey, []);
  };

  const handleDelete = async (idx: number) => {
    if (readOnly) return;
    const file = files[idx];

    if (file._assetId && brandKit._id) {
      await deleteAsset(file._assetId);
    }

    files.splice(idx, 1);

    // Reassign primary to first renderable if needed
    const hasPrimary = files.some((f) => f.isPrimary && isRenderable(f));
    if (!hasPrimary) {
      const firstRenderable = files.find((f) => isRenderable(f));
      if (firstRenderable) {
        files.forEach((f) => (f.isPrimary = f === firstRenderable));
      }
    }

    onFilesChange?.(slotKey, []);
  };

  const bg = slotKey === 'dark' ? '#1a1a1a' : '#f8f8f8';

  return (
    <div
      className={`bk-logo-slot ${hasFiles ? 'has-logo' : 'empty'} ${dragOver ? 'drag-over' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        cursor: readOnly ? 'default' : 'pointer',
        opacity: uploading ? 0.6 : 1,
      }}
    >
      {/* Preview area */}
      {!hasFiles ? (
        <>
          <div className="bk-slot-plus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="bk-slot-empty-sub">click or drop</div>
        </>
      ) : previewFile ? (
        <div
          style={{
            background: bg,
            borderRadius: '7px',
            padding: '10px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '64px',
            position: 'relative',
          }}
        >
          <img
            src={previewFile.data}
            alt={label}
            style={{
              maxWidth: '100%',
              maxHeight: '58px',
              objectFit: 'contain',
            }}
          />
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = files.indexOf(previewFile);
                if (idx >= 0) handleDelete(idx);
              }}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'rgba(0,0,0,.4)',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
                padding: '1px 5px',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              title="Remove"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: bg,
            borderRadius: '7px',
            padding: '10px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '64px',
            gap: '6px',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              color: '#d97706',
              background: '#fef9c3',
              border: '1px solid #fde047',
              borderRadius: '4px',
              padding: '2px 7px',
              textAlign: 'center',
            }}
          >
            Add a PNG or SVG for portal display
          </div>
        </div>
      )}

      {/* Slot label */}
      <div className="bk-slot-label">{label}</div>

      {/* File list */}
      {hasFiles && (
        <div className="bk-file-list">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`bk-file-row ${file.isPrimary && isRenderable(file) ? 'is-primary' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {file.data ? (
                <img src={file.data} alt={file.name} className="bk-file-thumb" />
              ) : (
                <div className="bk-file-thumb-placeholder">{file.ext}</div>
              )}

              <div className="bk-file-info">
                <div className="bk-file-name">{file.name}</div>
                <div className="bk-file-ext">{file.ext}</div>
              </div>

              {isRenderable(file) && !readOnly && (
                <button
                  className={`bk-file-primary-btn ${file.isPrimary ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetPrimary(idx);
                  }}
                  title="Set as primary"
                >
                  {file.isPrimary ? 'Primary' : 'Set'}
                </button>
              )}

              {!readOnly && (
                <button
                  className="bk-file-del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(idx);
                  }}
                  title="Delete"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id={`bk-slot-input-${slotKey}`}
        accept=".svg,.png,.jpg,.jpeg,.gif,.webp,.pdf,.ai,.eps"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
        disabled={readOnly}
      />
    </div>
  );
}
