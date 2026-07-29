import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
}

function Skeleton({ className, variant = 'rectangular', width, height, lines, ...props }: SkeletonProps) {
  if (variant === 'text' && lines) {
    return (
      <div className="space-y-2" style={{ width }} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'skeleton h-3 rounded',
              i === lines - 1 ? 'w-3/4' : 'w-full'
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'skeleton',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-3 rounded',
        variant === 'rectangular' && 'rounded-lg',
        variant === 'card' && 'rounded-xl h-40',
        className
      )}
      style={{ width, height }}
      {...props}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-bdr-subtle bg-surface-raised p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={12} />
          <Skeleton variant="text" width="40%" height={10} />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
    </div>
  )
}

function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-bdr-subtle bg-surface-raised p-3"
        >
          <Skeleton variant="circular" width={36} height={36} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="50%" height={12} />
            <Skeleton variant="text" width="30%" height={10} />
          </div>
          <Skeleton variant="rectangular" width={60} height={24} className="rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, CardSkeleton, ListSkeleton }
