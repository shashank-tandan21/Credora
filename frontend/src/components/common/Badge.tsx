import React from 'react'
import { cn } from '../../utils/cn'
import type { RiskCategory } from '../../types'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'outline'
    | 'indigo'
  size?: 'sm' | 'md'
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none'

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-0.5 leading-tight',
  }

  const variantStyles = {
    default:
      'bg-surface text-foreground dark:bg-subtle dark:text-muted border border-line dark:border-line',
    secondary:
      'bg-surface text-foreground dark:bg-subtle dark:text-muted',
    success:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    warning:
      'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    destructive:
      'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    outline:
      'border border-line text-foreground dark:border-line dark:text-muted',
    indigo:
      'bg-brand-soft text-accent border border-line dark:bg-brand-soft dark:text-accent dark:border-line',
  }

  return (
    <span className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)} {...props}>
      {children}
    </span>
  )
}

export const RiskBadge: React.FC<{ category: RiskCategory; size?: 'sm' | 'md' }> = ({
  category,
  size = 'md',
}) => {
  switch (category) {
    case 'Strong':
      return (
        <Badge variant="success" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
          Strong Tier
        </Badge>
      )
    case 'Good':
      return (
        <Badge variant="indigo" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-brand mr-1.5 inline-block" />
          Good Tier
        </Badge>
      )
    case 'Fair':
      return (
        <Badge variant="default" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-subtle mr-1.5 inline-block" />
          Fair Tier
        </Badge>
      )
    case 'Moderate risk':
      return (
        <Badge variant="warning" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 inline-block" />
          Moderate Risk
        </Badge>
      )
    case 'High risk':
      return (
        <Badge variant="destructive" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 inline-block" />
          High Risk
        </Badge>
      )
  }
}

