import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AIWorkspaceIndex from './AIWorkspaceIndex'
import { useAIStore } from '@/store/ai.store'
import { promptById } from '@/config/ecosystemPrompts'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'

/** Route adapter: turns shareable AI intent URLs into one executable AI task. */
export default function AIWorkspaceRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const executePrompt = useAIStore(s => s.executePrompt)
  const context = useEcosystemUrlContext()
  const consumed = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const promptId = params.get('promptId')
    const rawPrompt = params.get('prompt')
    const canonical = promptById(promptId)?.prompt
    const prompt = canonical || rawPrompt
    if (!prompt) return

    const signature = `${location.pathname}?${location.search}`
    if (consumed.current === signature) return
    consumed.current = signature

    const ids = [
      context.organizationId && `organizationId=${context.organizationId}`,
      context.branchId && `branchId=${context.branchId}`,
      context.patientId && `patientId=${context.patientId}`,
      context.caseId && `caseId=${context.caseId}`,
    ].filter(Boolean)
    const contextualPrompt = ids.length
      ? `Рабочий контекст DentVision: ${ids.join(', ')}. Используй его для навигации и действий, не раскрывая идентификаторы без необходимости.\n\nЗапрос пользователя: ${prompt}`
      : prompt

    void executePrompt(contextualPrompt)

    params.delete('prompt')
    params.delete('promptId')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true })
  }, [location.pathname, location.search, navigate, executePrompt, context.organizationId, context.branchId, context.patientId, context.caseId])

  return <AIWorkspaceIndex />
}
