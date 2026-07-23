import React from 'react'
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageTransitionProps extends HTMLMotionProps<'div'> {
  mode?: 'wait' | 'sync' | 'popLayout'
  className?: string
  children: React.ReactNode
}

export function PageTransition({
  mode = 'wait',
  className,
  children,
  ...props
}: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('w-full h-full', className)}
      {...props}
    >
      <motion.div
        key={props.key || 'page'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  staggerChildren?: number
  delayChildren?: number
  className?: string
  children: React.ReactNode
}

export function StaggerContainer({
  staggerChildren = 0.06,
  delayChildren = 0,
  className,
  children,
  ...props
}: StaggerContainerProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  } as Variants

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn('w-full', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
}

export function StaggerItem({
  className,
  children,
  ...props
}: StaggerItemProps) {
  const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
  } as Variants

  return (
    <motion.div variants={itemVariants} className={cn('w-full', className)} {...props}>
      {children}
    </motion.div>
  )
}

interface TypingTextProps {
  text: string
  speed?: number
  variance?: number
  className?: string
  onComplete?: () => void
}

export function TypingText({
  text,
  speed = 20,
  variance = 10,
  className,
  onComplete,
}: TypingTextProps) {
  const [displayed, setDisplayed] = React.useState('')
  const [index, setIndex] = React.useState(0)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (index >= text.length) {
      setDone(true)
      onComplete?.()
      return
    }

    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, index + 1))
      setIndex(index + 1)
    }, speed + Math.random() * variance)

    return () => clearTimeout(timeout)
  }, [index, text, speed, variance])

  React.useEffect(() => {
    if (done) {
      onComplete?.()
    }
  }, [done, onComplete])

  return <span className={className}>{displayed}</span>
}

interface RingSpinnerProps {
  size?: number
  thickness?: number
  className?: string
  color?: 'gold' | 'white' | 'primary'
  speed?: number
}

export function RingSpinner({
  size = 24,
  thickness = 2,
  className,
  color = 'gold',
  speed = 1.2,
}: RingSpinnerProps) {
  const colorStyles = {
    gold: 'text-dv-gold',
    white: 'text-white',
    primary: 'text-txt-primary',
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn(colorStyles[color], className)}
      fill="none"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth={thickness}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 10}
        initial={{ strokeDashoffset: 2 * Math.PI * 10 * 0.75 }}
        animate={{ strokeDashoffset: [2 * Math.PI * 10 * 0.75, 2 * Math.PI * 10 * 0.25] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth={thickness}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 10}
        initial={{ strokeDashoffset: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: speed * 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '12px 12px' }}
      />
    </svg>
  )
}

interface CursorBlinkProps {
  className?: string
  color?: 'gold' | 'white' | 'primary'
  height?: number
  width?: number
  speed?: number
}

export function CursorBlink({
  className,
  color = 'gold',
  height = 20,
  width = 2,
  speed = 0.7,
}: CursorBlinkProps) {
  const colorStyles = {
    gold: 'bg-dv-gold/70',
    white: 'bg-white/70',
    primary: 'bg-txt-primary/70',
  }

  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: speed, repeat: Infinity, repeatType: 'reverse' }}
      className={cn('inline-block align-text-bottom', colorStyles[color], `w-[${width}px] h-[${height}px]`, className)}
    />
  )
}

interface GlassMorphProps extends HTMLMotionProps<'div'> {
  intensity?: 'subtle' | 'medium' | 'strong'
  className?: string
  children: React.ReactNode
}

export function GlassMorph({
  intensity = 'medium',
  className,
  children,
  ...props
}: GlassMorphProps) {
  const intensityStyles = {
    subtle: 'bg-white/[0.02] border border-white/[0.04] backdrop-blur-xl',
    medium: 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] backdrop-blur-2xl',
    strong: 'bg-gradient-to-br from-white/[0.10] to-white/[0.04] border border-white/[0.12] backdrop-blur-2xl shadow-xl shadow-black/20',
  }

  return (
    <motion.div
      className={cn('rounded-2xl overflow-hidden', intensityStyles[intensity], className)}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

interface TransformCardProps extends HTMLMotionProps<'div'> {
  layoutId?: string
  className?: string
  children: React.ReactNode
}

export function TransformCard({
  layoutId,
  className,
  children,
  ...props
}: TransformCardProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={cn('relative z-10', className)}
      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export { motion }
export type { HTMLMotionProps }