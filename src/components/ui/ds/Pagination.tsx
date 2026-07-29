import React from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  className?: string
}

function generatePages(current: number, total: number, sibling: number): (number | '...')[] {
  const pages: (number | '...')[] = []
  const left = Math.max(2, current - sibling)
  const right = Math.min(total - 1, current + sibling)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('...')
  if (total > 1) pages.push(total)

  return pages
}

export function Pagination({ page, totalPages, onPageChange, siblingCount = 1, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = generatePages(page, totalPages, siblingCount)

  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Пагинация">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:bg-white/5 hover:text-txt-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Предыдущая"
      >
        <ChevronLeft size={14} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-txt-ghost">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'flex h-8 min-w-[32px] items-center justify-center rounded-lg text-xs font-medium transition-colors',
              p === page
                ? 'bg-dv-gold/15 text-dv-gold border border-dv-gold/30'
                : 'text-txt-secondary hover:bg-white/5 hover:text-txt-primary'
            )}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:bg-white/5 hover:text-txt-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Следующая"
      >
        <ChevronRight size={14} />
      </button>
    </nav>
  )
}
