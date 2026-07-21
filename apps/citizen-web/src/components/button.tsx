import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'bg-brand-700 text-white shadow-sm hover:bg-brand-800'
      : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50';

  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    />
  );
}
