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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/ds/Card'

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

const AGENT_ICONS: Record<string, string> = {
  doctor: '🩺',
  clinical: '🔬',
  radiology: '📷',
  documentation: '📋',
  shop: '📦',
  finance: '💰',
  admin: '⚙️',
  followup: '📞',
  patient: '👤',
  ceo: '📊',
  reception: '📅',
}

const AGENT_COLORS: Record<string, string> = {
  doctor: 'border-blue-400/30 bg-blue-400/5',
  clinical: 'border-emerald-400/30 bg-emerald-400/5',
  radiology: 'border-purple-400/30 bg-purple-400/5',
  documentation: 'border-cyan-400/30 bg-cyan-400/5',
  shop: 'border-amber-400/30 bg-amber-400/5',
  finance: 'border-green-400/30 bg-green-400/5',
  admin: 'border-orange-400/30 bg-orange-400/5',
  followup: 'border-pink-400/30 bg-pink-400/5',
  patient: 'border-sky-400/30 bg-sky-400/5',
  ceo: 'border-red-400/30 bg-red-400/5',
  reception: 'border-indigo-400/30 bg-indigo-400/5',
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
  const icon = AGENT_ICONS[agent] || '🤖'
  const colorClass = AGENT_COLORS[agent] || 'border-gray-400/30 bg-gray-400/5'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/30 transition-colors',
        colorClass
      )}
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center text-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {agent}
          </span>
          {message.action && (
            <>
              <ChevronRight size={10} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {message.action}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {message.success !== undefined && (
              message.success ? (
                <CheckCircle size={12} className="text-green-400" />
              ) : (
                <AlertTriangle size={12} className="text-red-400" />
              )
            )}
            <Clock size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <p className="text-sm mt-1 text-foreground/90">{message.message}</p>
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
          ? 'border-red-400/50 bg-red-400/10'
          : 'border-amber-400/30 bg-amber-400/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {message.critical ? (
          <AlertTriangle size={14} className="text-red-400" />
        ) : (
          <Zap size={14} className="text-amber-400" />
        )}
        <span className="text-xs font-medium">
          {message.critical ? 'Критическое' : 'Уведомление'}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {message.timestamp.toLocaleTimeString('ru-RU')}
        </span>
      </div>
      <p className="text-sm mt-1">{message.message}</p>
    </motion.div>
  )
}

function StatusMessage({ message }: { message: EventChatMessage }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground">
      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
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

// ─── Helper: convert timeline entry to chat messages ───

export function timelineToChatMessages(
  entry: {
    id: string
    event: { type: string; source: string }
    results: Array<{
      action: string
      agent: string
      success: boolean
      message?: string
    }>
    processedAt: string | Date
  }
): EventChatMessage[] {
  const messages: EventChatMessage[] = []

  for (const result of entry.results) {
    messages.push({
      id: `${entry.id}-${result.action}`,
      type: 'agent_action',
      agent: result.agent,
      action: result.action,
      message: result.message || `${result.action} completed`,
      success: result.success,
      critical: !result.success,
      timestamp: new Date(entry.processedAt),
    })
  }

  return messages
}
