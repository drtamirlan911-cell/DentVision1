import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface QueryErrorProps {
  /** Optional underlying error for callers that already have a query error object. */
  error?: unknown
  /** What exactly failed to load. */
  what?: string
  onRetry?: () => void
  className?: string
}

function QueryError({ what, onRetry, className }: QueryErrorProps) {
  return (
    <div role="alert" className={cn('rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-txt-primary', 'flex flex-wrap items-center gap-3', className)}>
      <span className="flex-1">{what ? `Не удалось загрузить ${what}.` : 'Не удалось загрузить данные.'} Показанное может быть неполным.</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Повторить</Button>}
    </div>
  )
}

export { QueryError }
