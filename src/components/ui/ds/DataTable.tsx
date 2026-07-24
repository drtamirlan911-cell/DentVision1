import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  rowKey?: (row: T, index: number) => string | number
  onRowClick?: (row: T, index: number) => void
  emptyText?: string
  className?: string
  compact?: boolean
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  sortKey,
  sortDir = 'asc',
  onSort,
  rowKey,
  onRowClick,
  emptyText = 'Нет данных',
  className,
  compact = false,
}: DataTableProps<T>) {
  const pyClass = compact ? 'py-2' : 'py-2.5'

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-bdr-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 text-2xs font-semibold uppercase tracking-wider text-txt-muted',
                  pyClass,
                  col.sortable && 'cursor-pointer select-none hover:text-txt-primary transition-colors',
                  col.className
                )}
                onClick={col.sortable ? () => onSort?.(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="text-txt-ghost">
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-txt-muted">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                className={cn(
                  'border-b border-bdr-subtle last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-white/[0.03]'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 text-xs text-txt-primary', pyClass, col.className)}>
                    {col.render ? col.render(row, idx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
