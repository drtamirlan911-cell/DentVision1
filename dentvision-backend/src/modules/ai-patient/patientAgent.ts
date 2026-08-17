/**
 * The patient-facing assistant's turn: a bounded tool loop over the patient's
 * own record.
 *
 * It shares the provider plumbing with the staff assistant (`llm/client.ts`)
 * and shares nothing else — different tools, different prompt, different
 * safety posture. The staff assistant may act on a clinic; this one reads one
 * card and hands anything else to a human.
 */

import { chatWithTools, type ChatMessage, type ToolDefinition } from '../ai/llm/client.js';
import { PATIENT_TOOLS, executePatientTool, type PatientToolContext } from './patientTools.js';

/**
 * Two rounds, not more. Each round is one model call plus its tool results,
 * and every tool here is a straight read of one patient's record — there is no
 * question about their own card that needs a third hop. Capping it keeps a
 * confused model from spending a patient's daily quota on one message.
 */
const MAX_ROUNDS = 2;

export const PATIENT_SYSTEM_PROMPT = `Ты — ассистент DentVision, ты помогаешь пациенту разобраться в его собственной медицинской карте.

КАК ОТВЕЧАТЬ
- Пиши по-русски, коротко и по-человечески. Пациент — не врач: «пломба на шестом зубе сверху справа», а не «реставрация 16 composite».
- Сначала вызови инструмент, потом отвечай. Никогда не придумывай даты, суммы, диагнозы и имена врачей — если инструмент их не вернул, значит их нет.
- Суммы называй в тенге, даты — словами («12 марта»), а не ISO-строкой.
- Если данных нет, так и скажи: «в вашей карте этого не записано». Не заполняй пробел догадкой.

ЧЕГО ТЫ НЕ ДЕЛАЕШЬ
- Не ставишь диагноз и не назначаешь лечение. Ты можешь объяснить, что уже записано в карте, но решение принимает врач.
- Не оцениваешь, правильно ли пациента лечили, и не сравниваешь с «как надо».
- Не подписываешь документы за пациента и не соглашаешься ни на что от его имени.
- Не обсуждаешь других пациентов. У тебя нет к ним доступа, и это правильно.

ЕСЛИ ПАЦИЕНТ ХОЧЕТ ЗАПИСАТЬСЯ ИЛИ ПЕРЕНЕСТИ ПРИЁМ
- Сначала вызови getMyAvailableSlots на нужную дату. Предлагай пациенту только время из этого списка — никогда не придумывай и не угадывай свободное время.
- Если пациент назвал время, которого нет в списке, скажи это прямо и предложи ближайшие варианты из списка.
- requestAppointment отправляет заявку, а не мгновенную запись — клиника её подтвердит сама. Скажи об этом пациенту, чтобы он не думал, что уже точно записан.
- Перенос — это отдельная запись на новое время плюс отмена старой (cancelMyAppointment), если пациент попросил перенести, а не просто добавить визит.

ЕСЛИ ПАЦИЕНТ ЖАЛУЕТСЯ НА БОЛЬ, ОТЁК ИЛИ ТРАВМУ
- Вызови assessUrgency и передай в него только то, что пациент действительно сказал. Не додумывай симптомы, которых он не называл.
- Уровень срочности определяешь не ты. Возьми его из ответа инструмента и передай пациенту тот текст, который инструмент вернул.
- Если инструмент вернул nextQuestion — задай именно этот вопрос, по одному за раз, и вызови assessUrgency снова с новым ответом.
- Про «неотложно» говори сразу и первым делом, до всего остального.

КОГДА ЗОВЁШЬ ЧЕЛОВЕКА
- Если вопрос про боль прямо сейчас, про срочность, про деньги, которые надо изменить, или ты просто не знаешь — вызови askClinicStaff. Признать предел лучше, чем звучать уверенно и ошибиться: здесь цена ошибки — здоровье.
- При emergency или urgent из assessUrgency вызывай askClinicStaff всегда, даже если пациент не просил.
- Если инструмент вернул delivered: false — значит в клинике некому было отправить. Скажи это честно и дай телефон клиники из ответа, не обещая, что с пациентом свяжутся.
- Никогда не называй конкретное время ответа. «Передал администратору» — правда; «вам ответят в течение часа» — обещание, которое даёшь не ты.`;

export interface PatientAgentResult {
  reply: string;
  toolsUsed: string[];
  /** Raw tool payloads, so the UI can render a card instead of only prose. */
  data: Record<string, unknown>;
  /** True when the provider is unconfigured or refused — the caller degrades. */
  unavailable: boolean;
}

function toolDefinitions(): ToolDefinition[] {
  return Object.values(PATIENT_TOOLS).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}

export async function runPatientTurn(
  userText: string,
  history: ChatMessage[],
  ctx: PatientToolContext,
): Promise<PatientAgentResult> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userText }];
  const toolsUsed: string[] = [];
  const data: Record<string, unknown> = {};

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const response = await chatWithTools(PATIENT_SYSTEM_PROMPT, messages, toolDefinitions(), {
      round,
      toolsUsed: toolsUsed.length,
    });

    // No key configured, or the provider refused. The portal must stay usable
    // without the assistant, so this is a state the caller renders, not a 500.
    if (response.finishReason === 'no_key') {
      return { reply: '', toolsUsed, data, unavailable: true };
    }

    if (!response.toolCalls?.length) {
      return { reply: response.content.trim(), toolsUsed, data, unavailable: false };
    }

    messages.push({ role: 'assistant', content: response.content || '' });

    for (const call of response.toolCalls) {
      const name = call.function?.name || '';
      let payload: unknown;
      try {
        // Arguments are parsed but carry no identity — see patientTools.ts.
        // A malformed blob is not worth failing the turn over.
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}');
        } catch {
          args = {};
        }
        payload = await executePatientTool(name, args, ctx);
        toolsUsed.push(name);
        data[name] = payload;
      } catch (e: any) {
        // Tell the model the tool failed rather than letting it narrate a
        // silence as "you have no appointments".
        payload = { error: String(e?.message || e) };
      }
      messages.push({
        role: 'tool',
        content: JSON.stringify(payload).slice(0, 8000),
        name,
      } as ChatMessage);
    }
  }

  // Rounds exhausted with the model still asking for tools. Answering from
  // what was gathered beats an empty reply, but say the shape of the limit.
  const final = await chatWithTools(PATIENT_SYSTEM_PROMPT, messages, [], {
    round: MAX_ROUNDS,
    toolsUsed: toolsUsed.length,
  });
  return {
    reply: final.content.trim(),
    toolsUsed,
    data,
    unavailable: final.finishReason === 'no_key',
  };
}
