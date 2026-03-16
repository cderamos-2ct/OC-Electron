import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: 'var(--accent)', color: '#fff' },
  secondary: { background: 'var(--border)', color: 'var(--text-3)' },
  outline:   { background: 'transparent', border: '1px solid #3a3a3e', color: 'var(--muted)' },
  danger:    { background: 'transparent', color: '#ff6b6b' },
  ghost:     { background: 'transparent', color: 'var(--dim)' },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: '11px', borderRadius: '6px' },
  md: { padding: '8px 20px', fontSize: '13px', borderRadius: '8px' },
  lg: { padding: '10px 24px', fontSize: '14px', borderRadius: '8px' },
};

export function Button({
  variant = 'primary',
  size = 'sm',
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      style={{
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        fontFamily: 'inherit',
        transition: 'opacity 0.12s, background 0.12s',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
