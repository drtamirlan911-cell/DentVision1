import { env } from '../../../config.js'
import { getRecentMessages, saveMessage } from '../conversation/conversation.manager.js'
import { toolsRegistry, executeToolCall } from './tools/tools.registry.js'
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

  const history = await getRecentMessages(session.id, 20)
  await saveMessage({ sessionId: session.id, role: 'USER', content: userMessage })

  const inputMessages: any[] = [
    { role: 'system', content: clinicContext.systemPrompt },
    ...history.map((m) => ({
      role: m.role.toLowerCase() as string,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  const MAX_ITERATIONS = 5
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
          model: env.OPENAI_MODEL_MINI ?? 'gpt-4o-mini',
          input: currentMessages,
          tools: toolsRegistry,
          tool_choice: 'auto',
          max_output_tokens: 500,
          temperature: 0.3,
        }),
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
          args.clinic_id = clinicId

          const toolResult = await executeToolCall(toolName, args, session)

          if (toolName === 'escalate_to_human') escalated = true

          await saveMessage({
            sessionId: session.id,
            role: 'TOOL',
            content: JSON.stringify(toolResult),
            toolName,
            toolResult: toolResult as object,
          })

          // Append tool result to conversation for next iteration
          currentMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{ id: toolCall.call_id, type: 'function', function: { name: toolName, arguments: toolCall.arguments } }],
          })
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.call_id,
            content: JSON.stringify(toolResult),
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
