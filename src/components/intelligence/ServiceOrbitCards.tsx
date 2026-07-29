import React from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { cn } from '@/lib/utils'

export interface OrbitCardDef {
  id: string
  name: string
  description: string
  event: string
  icon: React.ReactNode
  color: string
  angle: number
  radius: number
}

interface ServiceOrbitCardsProps {
  cards: OrbitCardDef[]
  cardTexts?: Record<string, string>
  staggerDelay?: number
  onCardClick?: (card: OrbitCardDef) => void
  className?: string
}

function ServiceOrbitCards({ cards, cardTexts = {}, staggerDelay = 0.1, onCardClick, className }: ServiceOrbitCardsProps) {
  return (
    <div className={cn('absolute inset-0 z-15 flex items-center justify-center', className)}>
      {cards.map((card) => {
        const rad = (card.angle * Math.PI) / 180
        const x = Math.cos(rad) * card.radius
        const y = Math.sin(rad) * card.radius
        const eventText = cardTexts[card.id] || card.event

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              x,
              y,
              transition: {
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: cards.indexOf(card) * staggerDelay,
              },
            }}
            exit={{ opacity: 0, scale: 0.4 }}
            className="absolute cursor-pointer"
            style={{ transform: 'translate(-50%, -50%)' }}
            onClick={() => onCardClick?.(card)}
          >
            <GlassCard hover padding="md" border="subtle" shadow="md" interactive>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${card.color}18`, color: card.color }}>
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white/90">{card.name}</h3>
                  <p className="text-[10px] text-white/40">{card.description}</p>
                </div>
              </div>
              {eventText && (
                <div
                  className="text-xs font-medium px-2.5 py-1 rounded-lg inline-block"
                  style={{ background: `${card.color}12`, color: card.color }}
                >
                  {eventText}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )
      })}
    </div>
  )
}

export { ServiceOrbitCards }
