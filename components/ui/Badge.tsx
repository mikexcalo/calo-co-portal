'use client';

import React from 'react';

export interface BadgeProps {
  status: 'unpaid' | 'paid' | 'overdue' | 'passthru';
  children?: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  children,
  showDot = true,
  className = '',
}) => {
  const statusClasses = {
    unpaid: 'pill-unpaid',
    paid: 'pill-paid',
    overdue: 'pill-overdue',
    passthru: 'pill-passthru',
  };

  const statusLabels = {
    unpaid: 'Unpaid',
    paid: 'Paid',
    overdue: 'Overdue',
    passthru: 'Passthru',
  };

  return (
    <span className={`pill ${statusClasses[status]} ${className}`}>
      {showDot && <span className="pill-dot" />}
      {children || statusLabels[status]}
    </span>
  );
};

Badge.displayName = 'Badge';
