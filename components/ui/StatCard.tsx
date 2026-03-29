'use client';

import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'default' | 'green' | 'amber' | 'indigo' | 'red';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  variant = 'default',
  className = '',
}) => {
  const valueClasses = {
    default: '',
    green: 'stat-value green',
    amber: 'stat-value amber',
    indigo: 'stat-value indigo',
    red: 'stat-value red',
  };

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${variant !== 'default' ? valueClasses[variant].split(' ')[1] : ''}`}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
};

StatCard.displayName = 'StatCard';
