import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Grid, MessageSquare, Volume2, VolumeX, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiChat, aiChatStream, aiFeedback, getAiSessionId } from '@/utils/api'
import { useAuth } from '@/store/auth.store'
import { useAIStore } from '@/store/ai.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor, AIAction } from '@/utils/aiExecutor'
import { requiresExplicitConfirmation, withClinicalContext } from '@/utils/aiActionPolicy'
import { AIInputArea } from './AIInputArea'
import { ChatMessage } from './ChatMessage'
import { SuggestionChips } from './SuggestionChips'
import { AIStatus } from '@/components/ai/AIStatus'
import { ActionConfirm } from './ActionConfirm'
import { ContextPanel } from './ContextPanel'
import { KaspiServiceHub } from '@/components/superapp/KaspiServiceHub'
import { KaspiAllServicesModal } from '@/components/superapp/KaspiAllServicesModal'
import { getSmartSuggestions, AI_NAV_ACTIONS } from '@/lib/aiPlatformMap'
import { isVoiceRepliesEnabled, setVoiceRepliesEnabled, speak, stopSpeaking, voiceOutputSupported } from '@/utils/voice'
import { trackProductEvent } from '@/utils/analytics'

interface Props { onNavigate?: (path: string) => void }

export function AIWorkspaceIndex({ onNavigate }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clinic, isAuthenticated } = useAuth()
  const isGuest = !user || !isAuthenticated
  const messages = useAIStore(s => s.messages)
  const status = useAIStore(s => s.status)
  const suggestions = useAIStore(s => s.suggestions)
  const progress = useAIStore(s => s.progress)
  const addMessage = useAIStore(s => s.addMessage)
  const setAIStatus = useAIStore(s => s.setAIStatus)
  const setProgress = useAIStore(s => s.setProgress)
  const setSuggestions = useAIStore(s => s.setSuggestionsFromStrings)
  const setErrorMessage = useAIStore(s => s.setErrorMessage)
  const context = useWorkspaceStore(s => s.context)
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace)
  const setContextFocus = useWorkspaceStore(s => s.setContextFocus)
  const { executeAction } = useAIExecutor()
  const [pendingConfirm, setPendingConfirm] = useState<AIAction | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [showServices, setShowServices] = useState(false)
  const [voice, setVoice] = useState(() => isVoiceRepliesEnabled())
  const [resumeToken, setResumeToken] = useState(0)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const endRef = useRef<HTMLDivElement>(null)
  const clinicId = clinic?.id || null

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, status])
  useEffect(() => {
    if (status === 'idle' || status === 'result') setSuggestions(getSmartSuggestions({ user, guest: isGuest, pathname: location.pathname, focusType: context.focusType }).slice(0, 4))
  }, [status, user, isGuest, location.pathname, context.focusType, setSuggestions])

  const toggleVoice = useCallback(() => {
    const next = !voice
    setVoice(next); setVoiceRepliesEnabled(next)
    if (!next) stopSpeaking()
  }, [voice])

  const runAction = useCallback(async (raw: any, forceConfirmed = false) => {
    const type = String(raw?.type || raw?.action || '')
    if (!type) return
    const params = withClinicalContext(raw?.params || {}, {
      patientId: context.focusType === 'patient' ? context.focusId : undefined,
      planId: typeof context.data?.planId === 'string' ? context.data.planId : undefined,
      visitId: typeof context.data?.visitId === 'string' ? context.data.visitId : undefined,
    })
    const action: AIAction = { id: String(raw?.id || `act-${Date.now()}`), type, label: String(raw?.label || type), confidence: Number(raw?.confidence ?? 1), params, requiresConfirmation: Boolean(raw?.requiresConfirmation), confirmed: forceConfirmed }
    if (requiresExplicitConfirmation(action)) {
      if (!forceConfirmed) { setPendingConfirm(action); setAIStatus('confirmation'); return }
    }
    setAIStatus('executing'); setProgress(0)
    try {
      const result = await executeAction(action, {
        onNavigate: path => { navigate(path); onNavigate?.(path) },
        addMessage: msg => addMessage({ id: `action-${Date.now()}`, role: 'assistant', content: msg.content || '', timestamp: msg.timestamp || new Date(), data: msg.data }),
        onError: message => setErrorMessage(message),
      })
      setProgress(100)
      if (result?.type === 'navigate' && result.path) { navigate(result.path); onNavigate?.(result.path) }
      setAIStatus(result?.type === 'error' ? 'error' : 'result')
      window.setTimeout(() => setAIStatus('idle'), 1200)
    } catch (error: any) {
      setErrorMessage(error?.message || t('ai.error_execution')); setAIStatus('error'); window.setTimeout(() => setAIStatus('idle'), 2500)
    } finally { setProgress(0) }
  }, [context, executeAction, addMessage, navigate, onNavigate, setAIStatus, setProgress, setErrorMessage, t])

  const handleConfirm = useCallback(async (confirmed: boolean) => {
    const action = pendingConfirm; setPendingConfirm(null); if (!action) return
    if (!confirmed) { trackProductEvent('ai_action_cancelled', { action: action.type }); setAIStatus('idle'); return }
    trackProductEvent('ai_action_confirmed', { action: action.type }); await runAction({ ...action, confirmed: true }, true)
  }, [pendingConfirm, runAction, setAIStatus])

  const handleSend = useCallback(async (text: string) => {
    const value = String(text || '').trim()
    if (!value || status === 'thinking' || status === 'executing') return
    const userMessage = { id: `user-${Date.now()}`, role: 'user' as const, content: value, timestamp: new Date() }
    addMessage(userMessage); historyRef.current = [...historyRef.current, { role: 'user', content: value }].slice(-20)
    setAIStatus('thinking'); setProgress(0)
    try {
      const opts = {
        userId: user?.id,
        clinicId,
        pathname: location.pathname,
        focusType: context.focusType,
        focusId: context.focusId,
        workspaceId: activeWorkspace?.id,
        workspaceType: activeWorkspace?.scopeType,
        workspaceName: activeWorkspace?.name,
        workspaceRole: activeWorkspace?.roleLabel,
      }
      let response: any = await aiChatStream(value, historyRef.current.slice(-20), (partial, done) => {
        if (partial && !done) useAIStore.setState(state => { const existing = state.messages.find(m => m.id === 'ai-stream'); const msg = { id: 'ai-stream', role: 'assistant' as const, content: partial, timestamp: new Date() }; return { messages: existing ? state.messages.map(m => m.id === 'ai-stream' ? msg : m) : [...state.messages, msg] } })
      }, opts as any)
      if (!response?.reply) response = await aiChat(value, historyRef.current.slice(-20), opts as any)
      useAIStore.setState(state => ({ messages: state.messages.filter(m => m.id !== 'ai-stream') }))
      const reply = String(response?.reply || '').trim()
      if (reply) { addMessage({ id: `assistant-${Date.now()}`, role: 'assistant', content: reply, timestamp: new Date(), skill: response?.skill }); historyRef.current.push({ role: 'assistant', content: reply }); if (voice) speak(reply, { onEnd: () => setResumeToken(n => n + 1) }) }
      if (response?.conversationContext?.entities) { const entities = response.conversationContext.entities; if (entities.patientId) setContextFocus('patient', String(entities.patientId), entities) }
      if (Array.isArray(response?.suggestions)) setSuggestions(response.suggestions.slice(0, 4))
      const actions = Array.isArray(response?.actions) ? response.actions : []
      setAIStatus('result'); if (actions.length) await runAction(actions[0]); window.setTimeout(() => setAIStatus('idle'), 1200)
    } catch (error: any) {
      setErrorMessage(error?.message || t('ai.generic_error')); setAIStatus('error'); window.setTimeout(() => setAIStatus('idle'), 2500)
    } finally { setProgress(0) }
  }, [status, addMessage, setAIStatus, setProgress, user?.id, clinicId, location.pathname, context, activeWorkspace, voice, setSuggestions, setContextFocus, runAction, setErrorMessage, t])

  // A workspace change is an AI context boundary. The user should not have to ask
  // "what changed?" — AI immediately re-anchors itself to the new role and gives a
  // concise operational brief without exposing an internal prompt in the chat.
  useEffect(() => {
    if (isGuest || !activeWorkspace?.name || !activeWorkspace.roleLabel) return
    const key = `dv_ai_workspace_brief:${activeWorkspace.id}:${activeWorkspace.switchedAt}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* ignore storage failures */ }

    let cancelled = false
    const briefPrompt = [
      'Ты DentVision AI. Пользователь только что переключил рабочую область.',
      `Рабочая область: ${activeWorkspace.name}.`,
      `Тип: ${activeWorkspace.scopeType}.`,
      `Роль пользователя в этой области: ${activeWorkspace.roleLabel}.`,
      'Дай короткую персональную сводку именно для этой роли: что сейчас важно, какие риски/задачи проверить в первую очередь и чем ты можешь помочь. Не придумывай цифры или события, которых нет в контексте. Не упоминай этот внутренний запрос.',
    ].join(' ')

    const runBrief = async () => {
      setAIStatus('thinking')
      try {
        const opts = { userId: user?.id, clinicId, pathname: location.pathname, focusType: 'workspace', focusId: activeWorkspace.id, workspaceId: activeWorkspace.id, workspaceType: activeWorkspace.scopeType, workspaceName: activeWorkspace.name, workspaceRole: activeWorkspace.roleLabel }
        let response: any = await aiChat(briefPrompt, [], opts as any)
        if (!response?.reply) response = await aiChatStream(briefPrompt, [], () => {}, opts as any)
        const reply = String(response?.reply || '').trim()
        if (!cancelled && reply) {
          addMessage({ id: `workspace-brief-${activeWorkspace.id}-${activeWorkspace.switchedAt}`, role: 'assistant', content: reply, timestamp: new Date(), skill: response?.skill || 'workspace-brief' })
          if (voice) speak(reply)
        }
      } catch { /* switching workspace must never be blocked by an AI brief */ }
      finally { if (!cancelled) setAIStatus('idle') }
    }
    void runBrief()
    return () => { cancelled = true }
  }, [activeWorkspace?.id, activeWorkspace?.switchedAt, activeWorkspace?.name, activeWorkspace?.roleLabel, activeWorkspace?.scopeType, isGuest, user?.id, clinicId, location.pathname, addMessage, setAIStatus, voice])

  const onMessageAction = useCallback((raw: any) => {
    const type = raw?.type || raw?.action || ''
    const path = raw?.params?.path || (type === 'NAVIGATE' ? '' : AI_NAV_ACTIONS[type])
    if (path) { navigate(path); onNavigate?.(path); return }
    void runAction(raw)
  }, [navigate, onNavigate, runAction])

  const ttsSupported = voiceOutputSupported()
  return <div className="flex h-full min-h-0 flex-col bg-surface-0">
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/[0.05] bg-surface-0/90 px-3 py-2.5 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-dv-gold/20 bg-dv-gold/10"><Bot size={18} className="text-dv-gold" /></div><div className="min-w-0"><h1 className="truncate text-base font-semibold text-txt-primary">DentVision Intelligence OS</h1><p className="truncate text-[11px] text-txt-muted">{status === 'confirmation' ? t('ai.awaiting_confirmation') : status === 'executing' ? t('ai.executing') : activeWorkspace ? `${activeWorkspace.name} · ${activeWorkspace.roleLabel}` : t('ai.ai_os_subtitle')}</p></div></div>
      <div className="flex items-center gap-1.5"><button onClick={() => setShowServices(true)} className="flex items-center gap-1.5 rounded-xl border border-dv-gold/20 bg-dv-gold/10 px-2.5 py-1.5 text-xs font-semibold text-dv-gold"><Grid size={15}/><span className="hidden sm:inline">Все сервисы</span></button>{ttsSupported && <button onClick={toggleVoice} className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:bg-white/5">{voice ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>}<button onClick={() => setShowContext(v => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:bg-white/5"><MessageSquare size={16}/></button></div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6"><KaspiServiceHub onAIQuery={handleSend} className="mb-5"/><AnimatePresence initial={false}>{messages.map(msg => <ChatMessage key={msg.id} msg={msg as any} onAction={handleSend} onFeedback={(rating, m) => { if (!isGuest) void aiFeedback({ rating, messageId: m.messageId, sessionId: getAiSessionId(user?.id, clinicId), assistantText: m.content }) }} onExecuteAction={onMessageAction}/>)}</AnimatePresence>{(status === 'thinking' || status === 'executing') && <div className="flex items-center gap-2 px-2 py-3 text-xs text-txt-muted"><Bot size={16} className="text-dv-gold"/>{status === 'thinking' ? t('ai.analyzing') : t('ai.executing')}</div>}<div ref={endRef}/></div></main>
    <footer className="shrink-0 border-t border-white/[0.05] bg-surface-0/90 backdrop-blur-xl"><div className="mx-auto max-w-5xl">{suggestions.length > 0 && status === 'idle' && <SuggestionChips suggestions={suggestions.map(s => s.label)} onSelect={handleSend} disabled={false}/>}<AIInputArea onSend={handleSend} disabled={status === 'thinking' || status === 'executing'} status={status === 'confirmation' ? 'result' : status} progress={progress} suggestions={suggestions.map(s => s.label)} placeholder={isGuest ? t('ai.guest_placeholder') : t('ai.auth_placeholder')} voiceResumeToken={voice ? resumeToken : 0}/></div></footer>
    <AnimatePresence>{pendingConfirm && <ActionConfirm action={{ action: pendingConfirm.type, label: pendingConfirm.label, confidence: pendingConfirm.confidence, params: pendingConfirm.params }} message={t('ai.confirm_action')} onConfirm={handleConfirm}/>}</AnimatePresence>
    <KaspiAllServicesModal open={showServices} onClose={() => setShowServices(false)} onAIQuery={handleSend}/>
    <AnimatePresence>{showContext && <div className="fixed inset-0 z-40"><button aria-label="Закрыть" className="absolute inset-0 bg-black/40" onClick={() => setShowContext(false)}/><motion.aside initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} className="absolute right-0 top-0 h-full w-full max-w-md bg-surface-0 shadow-2xl"><div className="flex items-center justify-between border-b border-white/[0.06] p-4"><span className="font-semibold">Контекст</span><button onClick={() => setShowContext(false)}><X size={18}/></button></div><ContextPanel/></motion.aside></div>}</AnimatePresence>
  </div>
}
