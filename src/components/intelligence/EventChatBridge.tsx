/**
 * EventChatBridge — shows AI agent actions from Event OS in the chat interface.
 *
 * Transforms EventOrchestrator results into chat messages:
 *  - Agent actions become "assistant" messages
 *  - Critical alerts become "system" messages with high priority
 *  - Timeline updates appear as compact status cards
 */

import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  ChevronRight,
  Stethoscope,
  FlaskConical,
  ScanLine,
  FileText,
  ShoppingCart,
  CreditCard,
  Settings,
  PhoneCall,
  User,
  BarChart3,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───

export interface EventChatMessage {
  id: string
  type: 'agent_action' | 'alert' | 'status' | 'user_message'
  agent?: string
  action?: string
  message: string
  success?: boolean
  critical?: boolean
  timestamp: Date
  metadata?: Record<string, unknown>
}

interface EventChatBridgeProps {
  messages: EventChatMessage[]
  onMessageClick?: (message: EventChatMessage) => void
  maxVisible?: number
}

// ─── Helpers ───

/**
 * One icon per agent identity — for recognition, not decoration. Colour is
 * not part of this: a card's border/background follows outcome
 * (success/critical), the same doctrine as StatCard — differentiating N
 * agents by N hues would be a legend that decodes to nothing.
 */
const AGENT_ICONS: Record<string, LucideIcon> = {
  doctor: Stethoscope,
  clinical: FlaskConical,
  radiology: ScanLine,
  documentation: FileText,
  shop: ShoppingCart,
  finance: CreditCard,
  admin: Settings,
  followup: PhoneCall,
  patient: User,
  ceo: BarChart3,
  reception: CalendarClock,
}

// ─── Subcomponents ───

function AgentActionMessage({
  message,
  onClick,
}: {
  message: EventChatMessage
  onClick?: () => void
}) {
  const agent = message.agent || 'ai'
  const Icon = AGENT_ICONS[agent] || Bot

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 p-3 rounded-lg border border-bdr-subtle bg-surface-1 cursor-pointer hover:bg-surface-2 transition-colors"
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-txt-muted">
            {agent}
          </span>
          {message.action && (
            <>
              <ChevronRight size={10} className="text-txt-muted" />
              <span className="text-xs text-txt-muted">
                {message.action}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {message.success !== undefined && (
              message.success ? (
                <CheckCircle size={12} className="text-success" />
              ) : (
                <AlertTriangle size={12} className="text-error" />
              )
            )}
            <Clock size={10} className="text-txt-muted" />
            <span className="text-[10px] text-txt-muted">
              {message.timestamp.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <p className="text-sm mt-1 text-txt-secondary">{message.message}</p>
      </div>
    </motion.div>
  )
}

function AlertMessage({
  message,
  onClick,
}: {
  message: EventChatMessage
  onClick?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors',
        message.critical
          ? 'border-error/50 bg-error/10'
          : 'border-warning/30 bg-warning/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {message.critical ? (
          <AlertTriangle size={14} className="text-error" />
        ) : (
          <Zap size={14} className="text-warning" />
        )}
        <span className="text-xs font-medium text-txt-primary">
          {message.critical ? 'Критическое' : 'Уведомление'}
        </span>
        <span className="text-[10px] text-txt-muted ml-auto">
          {message.timestamp.toLocaleTimeString('ru-RU')}
        </span>
      </div>
      <p className="text-sm mt-1 text-txt-secondary">{message.message}</p>
    </motion.div>
  )
}

function StatusMessage({ message }: { message: EventChatMessage }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 text-xs text-txt-muted">
      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      <span>{message.message}</span>
      <span className="ml-auto text-[10px]">
        {message.timestamp.toLocaleTimeString('ru-RU')}
      </span>
    </div>
  )
}

// ─── Main Component ───

export function EventChatBridge({
  messages,
  onMessageClick,
  maxVisible = 50,
}: EventChatBridgeProps) {
  const visibleMessages = useMemo(
    () => messages.slice(-maxVisible),
    [messages, maxVisible]
  )

  if (visibleMessages.length === 0) return null

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {visibleMessages.map((msg) => {
          switch (msg.type) {
            case 'agent_action':
              return (
                <AgentActionMessage
                  key={msg.id}
                  message={msg}
                  onClick={() => onMessageClick?.(msg)}
                />
              )
            case 'alert':
              return (
                <AlertMessage
                  key={msg.id}
                  message={msg}
                  onClick={() => onMessageClick?.(msg)}
                />
              )
            case 'status':
              return <StatusMessage key={msg.id} message={msg} />
            default:
              return null
          }
        })}
      </AnimatePresence>
    </div>
  )
}
