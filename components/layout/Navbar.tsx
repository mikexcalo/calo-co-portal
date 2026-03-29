'use client';

import React from 'react';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';
import { ViewToggle } from '../ui/ViewToggle';
import { Button } from '../ui/Button';

export interface NavbarAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}

export interface NavbarBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface NavbarProps {
  title: string;
  breadcrumbs?: NavbarBreadcrumbItem[];
  view?: 'agency' | 'client';
  onViewChange?: (view: 'agency' | 'client') => void;
  actions?: NavbarAction[];
  clientBanner?: {
    clientName: string;
    onExit: () => void;
  };
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  breadcrumbs,
  view,
  onViewChange,
  actions,
  clientBanner,
  className = '',
}) => {
  return (
    <>
      <div className={`topbar-wrap ${className}`}>
        <div className="topbar">
          {/* Brand / Title */}
          <div className="topbar-brand">{title}</div>

          {/* Breadcrumb - centered */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb items={breadcrumbs} />
          )}

          {/* Right side - View toggle and actions */}
          <div className="topbar-actions">
            {view && onViewChange && (
              <ViewToggle value={view} onChange={onViewChange} />
            )}

            {actions && actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || 'ghost'}
                size="sm"
                onClick={action.onClick}
                icon={action.icon}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Client Banner */}
      {clientBanner && (
        <div className="client-banner" style={{ display: 'flex' }}>
          <div className="client-banner-dot" />
          <span>Viewing as: <strong>{clientBanner.clientName}</strong></span>
          <button
            className="cb-exit"
            onClick={clientBanner.onExit}
          >
            Exit Client View
          </button>
        </div>
      )}
    </>
  );
};

Navbar.displayName = 'Navbar';
