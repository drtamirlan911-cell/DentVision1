import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface QueryErrorProps {
  /** Что именно не загрузилось — попадает в текст: «Не удалось загрузить {what}». */
  what?: string
  onRetry?: () => void
  className?: string
}

/**
 * Неудавшийся запрос, показанный как неудача, а не как пустота.
 *
 * Экран, который на упавшем запросе рисует `EmptyState` («нет транзакций»,
 * «нет направлений»), делает настоящий ноль и обрыв связи неотличимыми — а
 * решения по ним человек принимает разные: пустой список закрывают, упавший
 * перезагружают. На финансовых и операционных экранах эта разница стоит
 * дороже всего, поэтому текст говорит и то, что данных нет, и то, что
 * показанное может быть неполным.
 */
function QueryError({ what, onRetry, className }: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-txt-primary',
        'flex flex-wrap items-center gap-3',
        className,
      )}
    >
      <span className="flex-1">
        {what ? `Не удалось загрузить ${what}.` : 'Не удалось загрузить данные.'} Показанное может быть неполным.
      </span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>Повторить</Button>
      )}
    </div>
  )
}

export { QueryError }
