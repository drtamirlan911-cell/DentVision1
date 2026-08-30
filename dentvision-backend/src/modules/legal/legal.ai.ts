/**
 * Legal document helpers.
 *
 * Only `explainDocument` uses a model. `checkConflicts` and `diffVersions` are
 * deterministic and always were: they genuinely read the document — the first
 * looks for unfilled placeholders and missing standard clauses, the second
 * compares versions line by line. That is honest work, and it is fast, free
 * and reproducible; what was wrong was presenting it as AI. The UI now names
 * them for what they are.
 */

import { simpleChat } from '../ai/llm/client.js';
import { writeAuditLog } from './legal.audit.js';

function scrubPii(content: string): string {
  return content
    .replace(/\{\{BIN\}\}/g, '[BIN REDACTED]')
    .replace(/\{\{IBAN\}\}/g, '[IBAN REDACTED]')
    .replace(/\{\{Director\}\}/g, '[NAME REDACTED]')
    .replace(/\{\{CompanyName\}\}/g, '[COMPANY REDACTED]');
}

const LANGUAGE_NAME: Record<string, string> = { ru: 'русском', kz: 'казахском', en: 'английском' };

const DISCLAIMER = 'Данный анализ предоставлен AI и не является юридической консультацией.';

/**
 * Explain what a document actually says.
 *
 * This used to compute `scrubPii(content)`, throw it away, and return a
 * constant sentence — the same text for every document, describing clauses it
 * had never read. The UI promised «юридическая суть, риски, ключевые
 * положения» and delivered a fixed paragraph.
 */
export async function explainDocument(content: string, language: string, documentId: string, performedBy: string) {
  const safeContent = scrubPii(content);
  await writeAuditLog({ documentId, action: 'AI_EXPLAIN', diff: { language }, performedBy });

  const reply = await simpleChat(
    `Ты — юрист. Объясни документ на ${LANGUAGE_NAME[language] || 'русском'} языке простыми словами: ` +
      'суть, обязанности сторон, сроки, риски и на что обратить внимание. ' +
      'Опирайся ТОЛЬКО на текст документа; если чего-то в нём нет — так и скажи, не додумывай.',
    safeContent.slice(0, 24_000),
    { maxTokens: 1200 },
  ).catch(() => '');

  // No key, or the provider refused. Saying so beats a paragraph that sounds
  // like an analysis and is not one.
  if (!reply.trim()) {
    return {
      reply: '',
      unavailable: true,
      error: 'Анализ документа сейчас недоступен — ИИ не отвечает. Попробуйте позже.',
      disclaimer: DISCLAIMER,
    };
  }

  return { reply, unavailable: false, disclaimer: DISCLAIMER };
}

/** Line-by-line comparison. Deterministic — no model involved. */
export async function diffVersions(v1: string, v2: string, documentId: string, performedBy: string) {
  const safeV1 = scrubPii(v1);
  const safeV2 = scrubPii(v2);
  await writeAuditLog({ documentId, action: 'AI_DIFF', diff: { versionsCompared: true }, performedBy });
  const lines1 = safeV1.split('\n');
  const lines2 = safeV2.split('\n');
  const changes: string[] = [];
  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    if (lines1[i] !== lines2[i]) {
      changes.push(`Строка ${i + 1}: изменено`);
    }
  }
  return { totalChanges: changes.length, summary: `Обнаружено ${changes.length} изменений между версиями.`, changes };
}

/**
 * Checklist of the clauses a contract is expected to carry.
 *
 * Deterministic and intentionally so: "is there a confidentiality clause" is a
 * question with a definite answer, and a model would only add cost and the
 * chance of inventing one that is not there.
 */
export async function checkConflicts(content: string, documentId: string, performedBy: string) {
  const safeContent = scrubPii(content);
  await writeAuditLog({ documentId, action: 'AI_CHECK', performedBy });
  const findings: string[] = [];
  if (safeContent.includes('{{') && safeContent.includes('}}')) {
    findings.push('Обнаружены незаполненные переменные');
  }
  if (!safeContent.includes('конфиденциальность') && !safeContent.includes('конфиденциально')) {
    findings.push('Отсутствует пункт о конфиденциальности');
  }
  if (!safeContent.includes('срок') && !safeContent.includes('действи')) {
    findings.push('Не указан срок действия договора');
  }
  if (!safeContent.includes('спор') && !safeContent.includes('арбитраж')) {
    findings.push('Отсутствует порядок разрешения споров');
  }
  return { verdict: findings.length === 0 ? 'pass' : 'warning', findings, recommendations: findings.map(f => `Рекомендуется добавить: ${f}`) };
}
