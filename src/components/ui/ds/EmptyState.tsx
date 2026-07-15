import React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-txt-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-txt-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-txt-secondary max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}

export { EmptyState }
