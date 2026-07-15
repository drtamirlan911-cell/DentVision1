import React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'busy'
}

const sizeMap = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

const statusColors = {
  online: 'bg-success',
  offline: 'bg-txt-muted',
  busy: 'bg-error',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-dv-gold/20 text-dv-gold',
    'bg-info/20 text-info',
    'bg-success/20 text-success',
    'bg-accent-purple/20 text-accent-purple',
    'bg-accent-pink/20 text-accent-pink',
    'bg-accent-teal/20 text-accent-teal',
    'bg-warning/20 text-warning',
    'bg-accent-orange/20 text-accent-orange',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function Avatar({ src, name, size = 'md', status, className, ...props }: AvatarProps) {
  const sizeClass = sizeMap[size]

  return (
    <div className={cn('relative inline-flex shrink-0', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover', sizeClass)}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full font-semibold',
            sizeClass,
            getColorFromName(name)
          )}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-1',
            statusColors[status]
          )}
        />
      )}
    </div>
  )
}

function AvatarGroup({
  names,
  max = 4,
  size = 'sm',
  className,
}: {
  names: string[]
  max?: number
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const visible = names.slice(0, max)
  const remaining = names.length - max

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((name) => (
        <Avatar key={name} name={name} size={size} className="ring-2 ring-surface-1" />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-surface-2 text-txt-muted font-medium ring-2 ring-surface-1',
            sizeMap[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

export { Avatar, AvatarGroup }
