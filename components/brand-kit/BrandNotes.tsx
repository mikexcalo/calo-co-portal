'use client';

import { useState, useEffect } from 'react';

interface BrandNotesProps {
  notes: string;
  readOnly: boolean;
  onNotesChange?: (notes: string) => void;
}

export default function BrandNotes({ notes, readOnly, onNotesChange }: BrandNotesProps) {
  const [value, setValue] = useState(notes);
  const [charCount, setCharCount] = useState(notes.length);

  useEffect(() => {
    setValue(notes);
    setCharCount(notes.length);
  }, [notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.currentTarget.value.substring(0, 1000);
    setValue(newValue);
    setCharCount(newValue.length);
  };

  const handleBlur = () => {
    onNotesChange?.(value);
  };

  return (
    <div>
      <textarea
        className="bk-textarea"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Voice & tone, usage rules, anything to remember…"
        maxLength={1000}
        disabled={readOnly}
        style={{
          opacity: readOnly ? 0.6 : 1,
        }}
      />
      <div
        style={{
          fontSize: '11px',
          color: '#aaa',
          marginTop: '6px',
          textAlign: 'right',
        }}
      >
        {charCount} / 1000
      </div>
    </div>
  );
}
