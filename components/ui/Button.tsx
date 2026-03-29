'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'xs';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', children, icon, className = '', ...props }, ref) => {
    const baseClasses = 'btn';
    const variantClasses = {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    };
    const sizeClasses = {
      default: '',
      sm: 'btn-sm',
      xs: 'btn-xs',
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    return (
      <button ref={ref} className={classes} {...props}>
        {icon && <span>{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
