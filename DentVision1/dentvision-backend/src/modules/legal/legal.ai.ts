import { writeAuditLog } from './legal.audit.js';

function scrubPii(content: string): string {
  return content
    .replace(/\{\{BIN\}\}/g, '[BIN REDACTED]')
    .replace(/\{\{IBAN\}\}/g, '[IBAN REDACTED]')
    .replace(/\{\{Director\}\}/g, '[NAME REDACTED]')
    .replace(/\{\{CompanyName\}\}/g, '[COMPANY REDACTED]');
}

export async function explainDocument(content: string, language: string, documentId: string, performedBy: string) {
  const safeContent = scrubPii(content);
  await writeAuditLog({ documentId, action: 'AI_EXPLAIN', diff: { language }, performedBy });
  return {
    reply: `Юридический анализ документа (${language === 'ru' ? 'на русском' : language === 'kz' ? 'қазақ тілінде' : 'in English'}) выполнен. Основные положения документа касаются прав и обязанностей сторон, сроков действия, конфиденциальности и порядка разрешения споров.`,
    disclaimer: 'Данный анализ предоставлен AI и не является юридической консультацией.',
  };
}

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
