import React from 'react'
import { cn } from '@/lib/utils'
import { motion, type HTMLMotionProps } from 'framer-motion'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  border?: 'subtle' | 'medium' | 'strong'
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  backdrop?: 'sm' | 'md' | 'lg' | 'xl'
  interactive?: boolean
  motionProps?: HTMLMotionProps<'div'>
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const borderStyles = {
  subtle: 'border border-white/[0.06]',
  medium: 'border border-white/[0.12]',
  strong: 'border border-white/[0.20]',
}

const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg shadow-black/10',
  xl: 'shadow-xl shadow-black/20',
}

const backdropStyles = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
  xl: 'backdrop-blur-xl',
}

function GlassCard({
  className,
  hover = false,
  padding = 'md',
  border = 'subtle',
  shadow = 'md',
  backdrop = 'xl',
  interactive = false,
  motionProps,
  children,
  ...props
}: GlassCardProps) {
  const baseStyles = cn(
    'relative overflow-hidden rounded-2xl',
    paddingStyles[padding],
    borderStyles[border],
    shadowStyles[shadow],
    backdropStyles[backdrop],
    'bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent',
    className
  )

  const interactiveStyles = interactive
    ? cn(
        'transition-all duration-300',
        hover && 'group',
        'cursor-pointer select-none'
      )
    : ''

  const Content = motionProps ? motion.div : 'div'

  return (
    <Content
      {...motionProps}
      {...props}
      className={cn(baseStyles, interactiveStyles)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </Content>
  )
}

export { GlassCard }
export type { GlassCardProps }