import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-md cursor-pointer '

    const sizeStyles = {
      sm: 'min-h-10 px-3 text-sm gap-1.5',
      md: 'min-h-11 px-4 text-sm gap-2 font-medium',
      lg: 'h-11 px-5 text-sm gap-2.5 font-semibold',
    }

    const variantStyles = {
      primary:
        'bg-brand hover:bg-brand-hover text-on-brand shadow-none focus-visible:ring-accent dark:bg-brand dark:hover:bg-brand-hover',
      secondary:
        'bg-surface hover:bg-subtle text-foreground focus-visible:ring-slate-400 dark:bg-subtle dark:hover:bg-subtle dark:text-muted',
      outline:
        'border border-line hover:bg-surface text-foreground focus-visible:ring-slate-400 dark:border-line dark:text-muted dark:hover:bg-subtle',
      ghost:
        'text-foreground hover:bg-surface dark:text-muted dark:hover:bg-subtle',
      destructive:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-none focus-visible:ring-rose-500',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-none focus-visible:ring-emerald-500',
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-busy={isLoading || undefined}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'

