'use client';

import React from 'react';

export interface FooterProps {
  className?: string;
  poweredByUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({
  className = '',
  poweredByUrl = 'https://caloandco.com',
}) => {
  return (
    <footer className={`portal-footer ${className}`}>
      Powered by{' '}
      <a href={poweredByUrl} target="_blank" rel="noopener noreferrer">
        CALO&CO
      </a>
    </footer>
  );
};

Footer.displayName = 'Footer';
