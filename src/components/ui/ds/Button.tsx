import React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'

const buttonVariants = cva(
  'group inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-dv-gold to-dv-gold-light text-surface-0 hover:shadow-glow-sm',
        secondary:
          'bg-surface-raised border border-bdr-subtle text-txt-primary hover:bg-surface-raised-hover hover:border-bdr/50',
        ghost:
          'text-txt-secondary hover:bg-white/5 hover:text-txt-primary',
        outline:
          'border border-bdr text-txt-primary hover:bg-dv-gold/10 hover:border-dv-gold/50 hover:text-dv-gold',
        danger:
          'bg-error/10 border border-error/20 text-error hover:bg-error/20',
        link:
          'text-dv-gold hover:text-dv-gold-light underline-offset-4 hover:underline',
        success:
          'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
        warning:
          'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-md',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-base',
        xl: 'h-11 px-6 text-lg',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-xs': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonBaseProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  asChild?: boolean
}

type ButtonProps = ButtonBaseProps & (
  | { children: React.ReactNode }
  | { children?: undefined; 'aria-label': string }
)

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      loadingText,
      icon,
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const content = (
      <>
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="sr-only">
              {loadingText || 'Loading...'}
            </span>
          </>
        ) : icon ? (
          <span className="shrink-0 transition-transform duration-300 group-hover:rotate-12">
            {icon}
          </span>
        ) : null}
        {children}
      </>
    )

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={isDisabled}
          aria-busy={loading ? true : undefined}
          {...props}
        >
          {content}
        </Slot>
      )
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading ? true : undefined}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
        {...props}
      >
        {content}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
export type { ButtonProps }
