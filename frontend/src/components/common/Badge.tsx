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
    sm: 'text-[10px] px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-0.5 leading-tight',
  }

  const variantStyles = {
    default:
      'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
    secondary:
      'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    success:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    warning:
      'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    destructive:
      'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    outline:
      'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300',
    indigo:
      'bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50',
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
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 inline-block" />
          Good Tier
        </Badge>
      )
    case 'Fair':
      return (
        <Badge variant="default" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 inline-block" />
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

