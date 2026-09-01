'use client';

/**
 * One way to get a file in, used everywhere a file goes in.
 *
 * Receipts had a button, the price list had a drop zone, Records had a
 * different drop zone. Three ways to do the same thing is three things to
 * learn and three places for a bug to hide.
 *
 * Always both: drop it, or click to browse. People reach for whichever is
 * closer to hand and get annoyed when the one they reached for isn't there.
 */

import { useRef, useState } from 'react';
import { C, radius } from './ui';

export function DropZone({
  onFiles,
  label,
  hint,
  accept,
  multiple = true,
  busy,
  busyLabel = 'Reading…',
  compact,
}: {
  onFiles: (files: FileList) => void;
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  busyLabel?: string;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          // Reset so picking the same file twice still fires a change event.
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Only clear when the pointer actually leaves the zone, not when it
          // crosses a child element inside it.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          border: `1.5px dashed ${dragging ? C.accent : C.borderStrong}`,
          background: dragging ? C.accentSoft : 'transparent',
          borderRadius: radius.lg,
          padding: compact ? '14px 16px' : dragging ? '30px 18px' : '22px 18px',
          textAlign: 'center',
          cursor: busy ? 'wait' : 'pointer',
          marginBottom: 20,
          transition: 'padding .12s, background .12s, border-color .12s',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <div
          style={{
            fontSize: compact ? 12.5 : 13.5,
            color: dragging ? C.accent : C.text,
            fontWeight: 500,
          }}
        >
          {busy ? busyLabel : dragging ? 'Drop it' : label}
        </div>
        {hint && !busy && (
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>
            {hint}
          </div>
        )}
      </div>
    </>
  );
}
