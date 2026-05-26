import React from 'react';
import { cn } from '@/shared/utils';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  children: React.ReactNode;
};

export const Button = ({ variant = 'ghost', size = 'md', onClick, className, children }: ButtonProps) => {
  const base = 'inline-flex items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
    secondary: 'bg-muted text-foreground hover:bg-muted/80 border border-border',
    ghost: 'bg-transparent text-muted-foreground hover:bg-accent/20',
  };
  const sizes = {
    sm: 'px-2 py-1 text-[11px] gap-1',
    md: 'px-3 py-1.5 text-[12px] gap-1.5',
    lg: 'px-4 py-2 text-[13px] gap-2',
  };
  return (
    <button
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
};
