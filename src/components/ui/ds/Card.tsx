import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  active?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * `xl` exists for the few surfaces a screen is built around — the card a
 * patient reads their own history in, not the tiles beside it. Generous
 * padding is most of what separates a premium surface from a dense one, but
 * it only reads that way when it is rare: if every card is `xl`, none is.
 */
const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-6 sm:p-8',
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, active = false, padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // A resting card carries the first elevation step, so it sits *on*
          // the page rather than being cut out of it — on the light theme,
          // where the page is only a shade off white, that shadow is most of
          // what separates the two.
          //
          // `transition-all` was animating every property that happened to
          // change; only the three that actually move are transitioned now,
          // on the product's own curve.
          'rounded-xl border border-bdr-subtle bg-surface-raised shadow-elev-1',
          'transition-[background-color,border-color,box-shadow,transform] duration-base ease-dv',
          // The lift is one pixel. It is meant to be felt on the way to a
          // click, not seen — a card that jumps under the pointer reads as a
          // toy, and this one holds a patient record.
          hover && 'hover:bg-surface-raised-hover hover:border-bdr/50 hover:shadow-elev-2 hover:-translate-y-px cursor-pointer focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
          active && 'border-dv-gold/30 bg-dv-gold/5',
          paddingMap[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between pb-3', className)} {...props}>
      {children}
    </div>
  )
}

function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-txt-primary', className)} {...props}>
      {children}
    </h3>
  )
}

function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center pt-3 border-t border-bdr-subtle', className)} {...props}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardContent, CardFooter }
