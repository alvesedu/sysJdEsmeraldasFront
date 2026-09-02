import type { ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({ label, error, className, children }: FormFieldProps) {
  return (
    <label className={className}>
      {label}
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
