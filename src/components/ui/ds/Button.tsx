import React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'

const buttonVariants = cva(
  'group inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-base ease-dv focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'border-dv-gold bg-dv-gold text-dv-gold-on shadow-elev-1 hover:bg-dv-gold/90 hover:border-dv-gold-light hover:shadow-elev-2',
        secondary: 'border-bdr bg-surface-raised text-txt-primary shadow-elev-1 hover:bg-surface-raised-hover hover:border-bdr-strong hover:shadow-elev-2',
        ghost: 'border-transparent bg-transparent text-txt-secondary hover:border-bdr-subtle hover:bg-surface-raised hover:text-txt-primary',
        outline: 'border-bdr-strong bg-surface-0 text-txt-primary shadow-elev-1 hover:border-dv-gold hover:bg-dv-gold/10 hover:text-dv-gold',
        danger: 'border-error/30 bg-error/10 text-error shadow-elev-1 hover:bg-error/15 hover:border-error/50',
        link: 'border-transparent bg-transparent text-dv-gold hover:text-dv-gold-light underline-offset-4 hover:underline',
        success: 'border-success/30 bg-success/10 text-success shadow-elev-1 hover:bg-success/15 hover:border-success/50',
        warning: 'border-warning/30 bg-warning/10 text-warning shadow-elev-1 hover:bg-warning/15 hover:border-warning/50',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-lg', sm: 'h-9 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-base', xl: 'h-11 px-6 text-lg',
        icon: 'h-10 w-10 p-0', 'icon-sm': 'h-9 w-9 p-0', 'icon-xs': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

interface ButtonBaseProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, VariantProps<typeof buttonVariants> { loading?: boolean; loadingText?: string; icon?: React.ReactNode; asChild?: boolean }
type ButtonProps = ButtonBaseProps & ({ children: React.ReactNode } | { children?: undefined; 'aria-label': string })

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, loadingText, icon, children, disabled, asChild = false, title, ...props }, ref) => {
  const isDisabled = disabled || loading
  const hasTextChild = typeof children === 'string' || (Array.isArray(children) && children.some(c => typeof c === 'string'))
  const isIconOnly = !hasTextChild && (!!icon || React.Children.count(children) > 0)
  const ariaLabel = props['aria-label'] || (isIconOnly ? title : undefined)
  const content = <>{loading ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span className="sr-only">{loadingText || 'Loading...'}</span></> : icon ? <span className="shrink-0 transition-transform duration-base ease-dv group-hover:translate-x-px">{icon}</span> : null}{children}</>
  const commonProps = { ...(props as any), 'aria-label': ariaLabel, title: ariaLabel || title }
  if (asChild) return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} aria-busy={loading ? true : undefined} {...commonProps}>{content}</Slot>
  return <motion.button type="button" className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={isDisabled} aria-busy={loading ? true : undefined} whileHover={!isDisabled ? { y: -1 } : undefined} whileTap={!isDisabled ? { scale: 0.985 } : undefined} {...commonProps}>{content}</motion.button>
})
Button.displayName = 'Button'
export { Button, buttonVariants }
export type { ButtonProps }
