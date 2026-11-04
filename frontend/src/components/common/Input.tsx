import React, { useId } from 'react'
import { cn } from '../../utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, leftElement, rightElement, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const messageId = inputId + '-message'

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground dark:text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted">
              {leftElement}
            </div>
          )}
          <input
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={[props['aria-describedby'], error || helperText ? messageId : null].filter(Boolean).join(' ') || undefined}
            ref={ref}
            className={cn(
              'w-full h-11 rounded-md border border-control bg-surface px-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-control dark:bg-surface dark:text-foreground dark:placeholder:text-muted transition-colors',
              leftElement && 'pl-9',
              rightElement && 'pr-9',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center text-muted">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p id={messageId} role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
        ) : helperText ? (
          <p id={messageId} className="text-sm text-muted">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

