'use client';

import React from 'react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  return (
    <div className={`breadcrumb ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="bc-sep">/</span>}
          {item.onClick ? (
            <button
              className="bc-link"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ) : (
            <span className="bc-cur">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

Breadcrumb.displayName = 'Breadcrumb';
