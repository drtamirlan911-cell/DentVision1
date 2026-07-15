import React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'outline'
type BadgeSize = 'xs' | 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-txt-secondary border-bdr-subtle',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-error/10 text-error border-error/20',
  info: 'bg-info/10 text-info border-info/20',
  gold: 'bg-dv-gold/10 text-dv-gold border-dv-gold/20',
  outline: 'bg-transparent text-txt-secondary border-bdr',
}

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-2xs px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
}

function Badge({ className, variant = 'default', size = 'sm', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'error' && 'bg-error',
            variant === 'info' && 'bg-info',
            variant === 'gold' && 'bg-dv-gold',
            variant === 'default' && 'bg-txt-muted',
          )}
        />
      )}
      {children}
    </span>
  )
}

function StatusBadge({ status, label }: { status: BadgeVariant; label: string }) {
  return <Badge variant={status} dot>{label}</Badge>
}

export { Badge, StatusBadge }
export type { BadgeProps, BadgeVariant }
