import { env } from '../../../config.js'
import { getRecentMessages, saveMessage } from '../conversation/conversation.manager.js'
import { toolsRegistry } from './tools/tools.registry.js'
import { runAiAction } from '../../ai/os/kernel.js'
import { resolveModels } from '../../ai/lib/modelCatalog.js'
import type { ClinicContext } from '../context/context.builder.js'
import type { AiAdminSession } from '@prisma/client'

const OPENAI_URL = 'https://api.openai.com/v1/responses'

interface OrchestratorInput {
  session: AiAdminSession
  userMessage: string
  clinicContext: ClinicContext
  clinicId: string
}

interface OrchestratorResult {
  responseText: string
  toolsCalled: string[]
  tokensUsed: number
  escalated: boolean
}

export async function runLLMOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { session, userMessage, clinicContext, clinicId } = input
  const toolsCalled: string[] = []
  let totalTokens = 0
  let escalated = false

  // Same resolution as every other surface: an operator pin if there is one,
  // otherwise whatever `/v1/models` says this account can call. This used to
  // read `env.OPENAI_MODEL_MINI ?? 'gpt-4o-mini'`, where the fallback was
  // unreachable and the variable was never set in production.
  const models = await resolveModels({
    apiKey: env.OPENAI_API_KEY,
    envFull: env.OPENAI_MODEL,
    envMini: env.OPENAI_MODEL_MINI,
  })

  const history = await getRecentMessages(session.id, 20)
  await saveMessage({ sessionId: session.id, role: 'USER', content: userMessage })

  // The system prompt belongs in `instructions`, not in `input` — same as the
  // staff orchestrator, and it keeps the cacheable prefix in one place.
  const inputMessages: any[] = [
    ...history.map((m) => ({
      role: m.role.toLowerCase() as string,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  const MAX_ITERATIONS = 5
  const REQUEST_TIMEOUT_MS = 30_000
  /** Same cap the staff orchestrator uses: a tool must not blow up the prompt. */
  const MAX_TOOL_OUTPUT_CHARS = 12_000
  let iteration = 0
  const currentMessages = inputMessages

  while (iteration < MAX_ITERATIONS) {
    iteration++

    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: models.mini,
          instructions: clinicContext.systemPrompt,
          input: currentMessages,
          tools: toolsRegistry,
          tool_choice: 'auto',
          max_output_tokens: 500,
          temperature: 0.3,
        }),
        // This was the only model call in the codebase with no timeout: a hung
        // provider held a patient's WhatsApp reply open indefinitely.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${err}`)
      }

      const data = await response.json() as any
      totalTokens += data.usage?.total_tokens ?? 0

      const output = data.output || []
      const assistantOutputs = output.filter((o: any) => o.type === 'message' && o.role === 'assistant')
      const toolOutputs = output.filter((o: any) => o.type === 'function_call')

      if (toolOutputs.length > 0) {
        // Process tool calls
        for (const toolCall of toolOutputs) {
          const toolName = toolCall.name
          toolsCalled.push(toolName)

          let args: Record<string, unknown>
          try { args = JSON.parse(toolCall.arguments) } catch { args = {} }

          // The kernel resolves the session (and therefore clinic_id) from
          // `session.id` itself — nothing here is trusted from the model.
          const result = await runAiAction(
            { surface: 'admin', userId: `system:ai-admin:${session.id}`, requestedClinicId: session.clinicId, sessionId: session.id },
            { tool: toolName, args },
          )
          const toolResult = result.status === 'ok' ? result.data : { error: result.status === 'denied' ? result.error : 'pending' }

          if (toolName === 'escalate_to_human') escalated = true

          await saveMessage({
            sessionId: session.id,
            role: 'TOOL',
            content: JSON.stringify(toolResult),
            toolName,
            toolResult: toolResult as object,
          })

          // Responses API items, not Chat Completions messages. The previous
          // shape (`role:'assistant'` + `tool_calls`, then `role:'tool'`) is
          // not read by this endpoint, so the model never saw what its own
          // tools returned and looped until MAX_ITERATIONS ran out.
          currentMessages.push({
            type: 'function_call',
            name: toolName,
            call_id: toolCall.call_id,
            arguments: toolCall.arguments,
          })
          currentMessages.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: JSON.stringify(toolResult).slice(0, MAX_TOOL_OUTPUT_CHARS),
          })
        }
        continue
      }

      // Final text response
      const responseText = assistantOutputs[0]?.content?.[0]?.text ?? 'Извините, произошла ошибка. Позвоните нам по телефону.'
      await saveMessage({ sessionId: session.id, role: 'ASSISTANT', content: responseText, tokensUsed: totalTokens })
      return { responseText, toolsCalled, tokensUsed: totalTokens, escalated }
    } catch (err) {
      console.error('[orchestrator] LLM error:', err)
      const fallback = 'Извините, произошла ошибка. Пожалуйста, позвоните нам.'
      await saveMessage({ sessionId: session.id, role: 'ASSISTANT', content: fallback })
      return { responseText: fallback, toolsCalled, tokensUsed: totalTokens, escalated }
    }
  }

  const fallback = 'Для уточнения информации, пожалуйста, позвоните нам.'
  await saveMessage({ sessionId: session.id, role: 'ASSISTANT', content: fallback })
  return { responseText: fallback, toolsCalled, tokensUsed: totalTokens, escalated }
}
