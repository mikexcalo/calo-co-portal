'use client';

import { useState, useEffect } from 'react';
import { Typography as TypographyType } from '@/lib/types';

interface TypographyProps {
  fonts: TypographyType;
  readOnly: boolean;
  onFontChange?: (type: 'heading' | 'body' | 'accent', value: string) => void;
}

const GOOGLE_FONTS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Lora',
  'Raleway',
  'Roboto',
  'Open Sans',
  'Poppins',
  'Merriweather',
  'PT Serif',
  'Dancing Script',
  'Pacifico',
];

export default function Typography({ fonts, readOnly, onFontChange }: TypographyProps) {
  const [headingError, setHeadingError] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [accentError, setAccentError] = useState('');
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load Google Fonts
    const fontUrls = [fonts.heading, fonts.body, fonts.accent]
      .filter(Boolean)
      .map((font) => `family=${font.replace(/ /g, '+')}`);

    if (fontUrls.length > 0) {
      const url = `https://fonts.googleapis.com/css2?${fontUrls.join('&')}&display=swap`;
      const link = document.createElement('link');
      link.href = url;
      link.rel = 'stylesheet';
      link.onload = () => {
        setLoadedFonts(new Set([fonts.heading, fonts.body, fonts.accent]));
      };
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [fonts.heading, fonts.body, fonts.accent]);

  const validateFont = (fontName: string): boolean => {
    if (!fontName) return true;
    // Simple validation - check if it's in our list or matches common pattern
    return GOOGLE_FONTS.some((f) => f.toLowerCase() === fontName.toLowerCase()) || fontName.length > 0;
  };

  const handleHeadingChange = (value: string) => {
    setHeadingError('');
    if (value && !validateFont(value)) {
      setHeadingError('Font may not be available');
    }
    onFontChange?.('heading', value);
  };

  const handleBodyChange = (value: string) => {
    setBodyError('');
    if (value && !validateFont(value)) {
      setBodyError('Font may not be available');
    }
    onFontChange?.('body', value);
  };

  const handleAccentChange = (value: string) => {
    setAccentError('');
    if (value && !validateFont(value)) {
      setAccentError('Font may not be available');
    }
    onFontChange?.('accent', value);
  };

  const getFontStyle = (fontName: string): React.CSSProperties => {
    if (!fontName) return {};
    return {
      fontFamily: `'${fontName}', serif`,
    };
  };

  return (
    <div>
      {/* Heading Font */}
      <div className="bk-font-row">
        <span className="bk-font-label">Heading</span>
        <input
          className="bk-font-input"
          type="text"
          value={fonts.heading || ''}
          onChange={(e) => handleHeadingChange(e.currentTarget.value)}
          placeholder="e.g. Playfair Display"
          disabled={readOnly}
        />
      </div>
      {headingError && <div style={{ fontSize: '9.5px', color: '#dc2626', marginBottom: '10px' }}>{headingError}</div>}

      {/* Body Font */}
      <div className="bk-font-row">
        <span className="bk-font-label">Body</span>
        <input
          className="bk-font-input"
          type="text"
          value={fonts.body || ''}
          onChange={(e) => handleBodyChange(e.currentTarget.value)}
          placeholder="e.g. Inter"
          disabled={readOnly}
        />
      </div>
      {bodyError && <div style={{ fontSize: '9.5px', color: '#dc2626', marginBottom: '10px' }}>{bodyError}</div>}

      {/* Accent Font */}
      <div className="bk-font-row">
        <span className="bk-font-label">Accent</span>
        <input
          className="bk-font-input"
          type="text"
          value={fonts.accent || ''}
          onChange={(e) => handleAccentChange(e.currentTarget.value)}
          placeholder="e.g. Dancing Script"
          disabled={readOnly}
        />
      </div>
      {accentError && <div style={{ fontSize: '9.5px', color: '#dc2626', marginBottom: '10px' }}>{accentError}</div>}

      {/* Font Preview */}
      {(fonts.heading || fonts.body || fonts.accent) && (
        <div className="bk-font-preview-wrap" style={{ display: 'block', marginTop: '12px' }}>
          {fonts.heading && (
            <div style={{ ...getFontStyle(fonts.heading), fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              The quick brown fox
            </div>
          )}
          {fonts.body && (
            <div style={{ ...getFontStyle(fonts.body), fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
            </div>
          )}
          {fonts.accent && (
            <div style={{ ...getFontStyle(fonts.accent), fontSize: '16px', fontStyle: 'italic' }}>
              Accent style example
            </div>
          )}
        </div>
      )}

      {/* Font Suggestions */}
      {(fonts.heading === '' || fonts.body === '' || fonts.accent === '') && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#0369a1',
          }}
        >
          <strong>Popular choices:</strong>
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {GOOGLE_FONTS.map((font) => (
              <button
                key={font}
                onClick={() => {
                  if (!fonts.heading) handleHeadingChange(font);
                  else if (!fonts.body) handleBodyChange(font);
                  else if (!fonts.accent) handleAccentChange(font);
                }}
                style={{
                  padding: '2px 6px',
                  background: '#fff',
                  border: '1px solid #bae6fd',
                  borderRadius: '3px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                {font}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
