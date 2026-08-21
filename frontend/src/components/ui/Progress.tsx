import { forwardRef, type HTMLAttributes } from 'react';
import { classNames } from '@utils/helpers';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, max = 100, size = 'md', showLabel = false, variant = 'default', className, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeStyles = {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-4',
    };

    const variantStyles = {
      default: 'bg-indigo-600',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500',
    };

    return (
      <div ref={ref} className={classNames('w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden', sizeStyles[size], className)} {...props} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={showLabel ? `${Math.round(percentage)}%` : undefined}>
        <div
          className={classNames(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
        {showLabel && (
          <span className="sr-only">{Math.round(percentage)}%</span>
        )}
      </div>
    );
  }
);

Progress.displayName = 'Progress';