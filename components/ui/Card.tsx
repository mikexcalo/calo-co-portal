'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`card ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
