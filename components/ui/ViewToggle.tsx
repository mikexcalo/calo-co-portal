'use client';

import React from 'react';

export interface ViewToggleProps {
  value: 'agency' | 'client';
  onChange: (value: 'agency' | 'client') => void;
  className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange, className = '' }) => {
  return (
    <div className={`view-toggle ${className}`}>
      <button
        className={`vt-btn ${value === 'agency' ? 'active' : ''}`}
        onClick={() => onChange('agency')}
      >
        Agency
      </button>
      <button
        className={`vt-btn ${value === 'client' ? 'active' : ''}`}
        onClick={() => onChange('client')}
      >
        Client
      </button>
    </div>
  );
};

ViewToggle.displayName = 'ViewToggle';
