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

// Theme tokens, not white overlays. `border-white/[0.06]` is a dark-theme
// construction: on a light ground it is white on near-white, so every glass
// card lost its edge and the surface stopped reading as a card at all.
const borderStyles = {
  subtle: 'border border-bdr-subtle',
  medium: 'border border-bdr',
  strong: 'border border-bdr-focus/40',
}

// The elevation ramp follows the theme (see `--dv-elev-*`): near-black on a
// dark ground, cool slate at low opacity on a light one. `shadow-black/20`
// over white is what made light-theme cards look smudged rather than raised.
const shadowStyles = {
  none: '',
  sm: 'shadow-elev-1',
  md: 'shadow-elev-1',
  lg: 'shadow-elev-2',
  xl: 'shadow-elev-3',
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
    'bg-glass',
    className
  )

  const interactiveStyles = interactive
    ? cn(
        'transition-[box-shadow,transform] duration-base ease-dv',
        hover && 'group hover:-translate-y-px hover:shadow-elev-2',
        'cursor-pointer select-none'
      )
    : ''

  const Content = motion.div

  return (
    <Content
      {...(motionProps || {})}
      {...(props as any)}
      className={cn(baseStyles, interactiveStyles)}
    >
      <div className="relative z-10">{children}</div>
    </Content>
  )
}

export { GlassCard }
export type { GlassCardProps }