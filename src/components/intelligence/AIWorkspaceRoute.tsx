import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AIWorkspaceIndex from './AIWorkspaceIndex'
import { useAIStore } from '@/store/ai.store'
import { promptById } from '@/config/ecosystemPrompts'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'
import { useWorkspaceStore } from '@/store/workspace.store'

/** Route adapter: turns shareable AI intent URLs into one executable AI task. */
export default function AIWorkspaceRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const executePrompt = useAIStore(s => s.executePrompt)
  const context = useEcosystemUrlContext()
  const workspace = useWorkspaceStore(s => s.activeWorkspace)
  const contract = useWorkspaceStore(s => s.contextContract)
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
    const workflow = contract?.workflow?.key || 'workspace'
    const queue = contract?.queue?.key || 'workspace'
    const entity = contract?.entity?.type ? `${contract.entity.type}${contract.entity.id ? `:${contract.entity.id}` : ''}` : null
    const contextLine = [
      ...ids,
      workspace?.name && `workspace=${workspace.name}`,
      workspace?.scopeType && `workspaceType=${workspace.scopeType}`,
      workspace?.roleLabel && `role=${workspace.roleLabel}`,
      `workflow=${workflow}`,
      `queue=${queue}`,
      entity && `entity=${entity}`,
    ].filter(Boolean)
    const contextualPrompt = contextLine.length
      ? `Рабочий контекст DentVision: ${contextLine.join(', ')}. Используй его для навигации и действий, не раскрывая идентификаторы без необходимости.\n\nЗапрос пользователя: ${prompt}`
      : prompt

    void executePrompt(contextualPrompt)

    params.delete('prompt')
    params.delete('promptId')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true })
  }, [location.pathname, location.search, navigate, executePrompt, context.organizationId, context.branchId, context.patientId, context.caseId])

  return <AIWorkspaceIndex />
}
