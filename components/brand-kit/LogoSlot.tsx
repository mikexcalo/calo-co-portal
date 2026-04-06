'use client';

import { useState, useRef } from 'react';
import { BrandKit, LogoFile } from '@/lib/types';
import { DB, uploadAsset, updateAssetPrimary, deleteAsset, saveBrandKit } from '@/lib/database';
import { useTheme } from '@/lib/theme';

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
  const { t } = useTheme();
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

  const bg = slotKey === 'dark' || slotKey === 'light' ? '#1a1a1a' : '#f8f8f8';

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

      {/* File type badge grid — always show all 6 slots */}
      {hasFiles && (
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
          {(() => {
            const allTypes = ['SVG', 'PNG', 'PDF', 'AI', 'EPS', 'JPG'];
            const tooltips: Record<string, string> = { SVG: 'Websites, apps, scales infinitely', PNG: 'Social media, presentations, transparent bg', PDF: 'Print vendors, brand guidelines', AI: 'Professional print, editable source', EPS: 'Large format, signage', JPG: 'Quick sharing, internal docs' };
            const fileMap = new Map<string, { file: LogoFile; origIdx: number }>();
            files.forEach((f, i) => { const ext = getExt(f.name); if (!fileMap.has(ext)) fileMap.set(ext, { file: f, origIdx: i }); });
            const imageFileCount = files.filter(f => isRenderable(f)).length;
            const actionBtn: React.CSSProperties = { minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'color 150ms' };
            return allTypes.map((ext) => {
              const match = fileMap.get(ext);
              if (match) {
                const isImg = isRenderable(match.file);
                const isPri = match.file.isPrimary;
                const isSupabaseUrl = match.file.data?.startsWith('http');
                return (
                  <div key={ext} onClick={(e) => e.stopPropagation()} title={tooltips[ext]} style={{
                    display: 'flex', alignItems: 'center', gap: 2, padding: '2px 5px',
                    background: t.bg.surfaceHover, border: `1px solid ${isPri ? t.accent.primary : t.border.default}`, borderRadius: 4,
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isPri ? t.accent.text : t.text.secondary, background: isPri ? t.accent.subtle : t.border.default, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{ext}</span>
                    <div style={{ flex: 1 }} />
                    {!readOnly && isImg && imageFileCount > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); handleSetPrimary(match.origIdx); }} title={isPri ? 'Preview image' : 'Set as preview'}
                        style={{ ...actionBtn, color: isPri ? '#f59e0b' : t.text.tertiary, fontSize: 12 }}>★</button>
                    )}
                    {match.file.data && (
                      isSupabaseUrl
                        ? <a href={match.file.data} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open file" style={{ ...actionBtn, color: t.text.tertiary }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
                        : <a href={match.file.data} download={match.file.name} onClick={(e) => e.stopPropagation()} title="Download" style={{ ...actionBtn, color: t.text.tertiary }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
                    )}
                    {!readOnly && <button onClick={(e) => { e.stopPropagation(); handleDelete(match.origIdx); }} title="Delete" style={{ ...actionBtn, color: t.text.tertiary, fontSize: 12 }}>×</button>}
                  </div>
                );
              }
              return (
                <div key={ext} title={tooltips[ext]} style={{
                  display: 'flex', alignItems: 'center', padding: '2px 5px',
                  background: 'transparent', border: '1px solid transparent', borderRadius: 4, opacity: 0.4,
                }}>
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.text.tertiary, borderRadius: 3, padding: '1px 4px' }}>{ext}</span>
                </div>
              );
            });
          })()}
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
