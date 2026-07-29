// ═══════════════════════════════════════════════════════════════
// DDS Progress — progress bar and circular indicator
// ═══════════════════════════════════════════════════════════════
import React from 'react'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'gold' | 'emerald' | 'red' | 'sky' | 'purple'
  showLabel?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
}

const VARIANT_CLASSES = {
  gold: 'bg-gradient-to-r from-dv-gold to-dv-gold-light',
  emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  red: 'bg-gradient-to-r from-red-500 to-red-400',
  sky: 'bg-gradient-to-r from-sky-500 to-sky-400',
  purple: 'bg-gradient-to-r from-purple-500 to-purple-400',
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'gold',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-txt-secondary">{value} / {max}</span>
          <span className="text-xs font-medium text-txt-primary">{Math.round(percent)}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-white/5 overflow-hidden', SIZE_CLASSES[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', VARIANT_CLASSES[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  value: number // 0-100
  size?: number
  strokeWidth?: number
  variant?: 'gold' | 'emerald' | 'red' | 'sky' | 'purple'
  showLabel?: boolean
  className?: string
}

const STROKE_COLORS = {
  gold: 'stroke-dv-gold',
  emerald: 'stroke-emerald-400',
  red: 'stroke-red-400',
  sky: 'stroke-sky-400',
  purple: 'stroke-purple-400',
}

export function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  variant = 'gold',
  showLabel = false,
  className,
}: CircularProgressProps) {
  const percent = Math.min(100, Math.max(0, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-500 ease-out', STROKE_COLORS[variant])}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-medium text-txt-primary">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  )
}
