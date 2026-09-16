import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, MessageCircle, Plus, Sparkles, Stethoscope, CalendarDays, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { aiBriefing } from '@/utils/api'
import { AIInputArea } from './AIInputArea'
import { ChatMessage, type ChatMsg } from './ChatMessage'
import { ContextPanel } from './ContextPanel'

const STARTER_PROMPTS = ['Что мне нужно сделать сегодня?','Покажи пациентов, которым нужен контроль','Найди материал или оборудование для моей задачи','Найди курс для моего профессионального развития']
const ECOSYSTEM_PROMPTS = ['Найди стоматологическую лабораторию','Найди диагностический центр и варианты записи','Найди медицинскую лабораторию для нужного анализа','Найди вакансию или специалиста']
const BOOKING_PROMPTS = ['Найди стоматолога рядом со мной и покажи варианты записи','Мне нужна запись к стоматологу. Помоги выбрать клинику и время','Какие стоматологические услуги доступны для записи?']

export function AIWorkspaceIndex({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const navigate = useNavigate(); const location = useLocation(); const { clinic, isAuthenticated } = useAuth()
  const [showContext, setShowContext] = useState(false); const [briefing, setBriefing] = useState(''); const [briefingSuggestions, setBriefingSuggestions] = useState<string[]>([]); const [briefingLoading, setBriefingLoading] = useState(false)
  const messages = useAIStore(s => s.messages); const suggestions = useAIStore(s => s.suggestions); const proactiveAlerts = useAIStore(s => s.proactiveAlerts); const status = useAIStore(s => s.status); const progress = useAIStore(s => s.progress); const executePrompt = useAIStore(s => s.executePrompt); const loadConversation = useAIStore(s => s.loadConversation); const loadProactiveAlerts = useAIStore(s => s.loadProactiveAlerts); const clearConversation = useAIStore(s => s.clearConversation); const acknowledgeAlert = useAIStore(s => s.acknowledgeAlert); const errorMessage = useAIStore(s => s.errorMessage)
  const bookingIntent = new URLSearchParams(location.search).get('intent') === 'booking'
  useEffect(() => { if (!isAuthenticated) return; void loadConversation(); void loadProactiveAlerts(); let cancelled=false; setBriefingLoading(true); void aiBriefing().then(result => { if(cancelled)return; setBriefing(result.reply||''); setBriefingSuggestions(Array.isArray(result.suggestions)?result.suggestions.filter(Boolean).slice(0,4):[]) }).catch(()=>{if(!cancelled){setBriefing('');setBriefingSuggestions([])}}).finally(()=>{if(!cancelled)setBriefingLoading(false)}); return()=>{cancelled=true} }, [isAuthenticated,loadConversation,loadProactiveAlerts])
