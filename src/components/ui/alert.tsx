import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'destructive';
};

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex w-full items-start gap-3 rounded-lg border p-4 text-sm',
        variant === 'destructive'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-slate-200 bg-white text-slate-950',
        className
      )}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('leading-relaxed', className)} {...props} />;
}
