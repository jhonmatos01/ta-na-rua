import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({
  id,
  label,
  error,
  hint,
  className = '',
  ...inputProps
}: FormFieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-extrabold text-ink">
        {label}
        {inputProps.required ? <span className="ml-1 text-coral-500">*</span> : null}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 w-full rounded-xl border bg-white px-3.5 py-3 text-base text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${error ? 'border-coral-500' : 'border-slate-300'} ${className}`}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
