/**
 * Adaptive learning for DentVision AI:
 * - long-term preference memory (explicit «запомни» + soft style signals)
 * - digital-twin summary injection
 * - few-shot examples from positively rated answers
 *
 * Not model fine-tuning — personalization that compounds with every request.
 */
import prisma from '../../../lib/prisma.js';
import { memoryEngine } from '../memory/memory.engine.js';
import { decryptAiTranscriptText, encryptAiTranscriptText } from '../lib/transcriptEncryption.js';

const GLOBAL_CLINIC = '__global__';
const PREFS_KEY = 'user_prefs';
const TWIN_CACHE_KEY = 'twin_summary_v1';
const TWIN_TTL_MS = 15 * 60 * 1000;
const MAX_PREFS = 24;
const MAX_FEW_SHOTS = 3;

export type UserPref = {
  key: string;
  label: string;
  value: string;
  source: 'explicit' | 'style' | 'habit' | 'feedback';
  updatedAt: string;
};

export type UserPrefsBag = {
  items: UserPref[];
};

export type FewShotExample = {
  user: string;
  assistant: string;
};

export type LearningContext = {
  prefsBlock: string;
  twinBlock: string;
  fewShots: FewShotExample[];
  rememberedLabels: string[];
  learnedHint?: string;
};

function clinicKey(clinicId?: string | null): string {
  return clinicId && clinicId.trim() ? clinicId : GLOBAL_CLINIC;
}

function slugKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `p_${Date.now().toString(36)}`;
}

async function loadPrefs(userId: string, clinicId?: string | null): Promise<UserPrefsBag> {
  const cid = clinicKey(clinicId);
  const raw = (await memoryEngine.getLongTerm(PREFS_KEY, userId, cid)) as UserPrefsBag | null;
  if (raw && Array.isArray(raw.items)) return raw;
  // Also merge global prefs when clinic-scoped
  if (cid !== GLOBAL_CLINIC) {
    const global = (await memoryEngine.getLongTerm(PREFS_KEY, userId, GLOBAL_CLINIC)) as UserPrefsBag | null;
    if (global?.items?.length) return global;
  }
  return { items: [] };
}

async function savePrefs(userId: string, clinicId: string | null | undefined, bag: UserPrefsBag): Promise<void> {
  const cid = clinicKey(clinicId);
  const trimmed = { items: bag.items.slice(0, MAX_PREFS) };
  await memoryEngine.setLongTerm(PREFS_KEY, trimmed, userId, cid);
  // Mirror style prefs globally so they follow the user across clinics
  if (cid !== GLOBAL_CLINIC) {
    const styleOnly = {
      items: trimmed.items.filter((i) => i.source === 'style' || i.source === 'explicit'),
    };
    if (styleOnly.items.length) {
      await memoryEngine.setLongTerm(PREFS_KEY, styleOnly, userId, GLOBAL_CLINIC);
    }
  }
}

export async function upsertPref(
  userId: string,
  clinicId: string | null | undefined,
  pref: Omit<UserPref, 'updatedAt'> & { updatedAt?: string },
): Promise<UserPref> {
  const bag = await loadPrefs(userId, clinicId);
  const next: UserPref = {
    ...pref,
    updatedAt: pref.updatedAt || new Date().toISOString(),
  };
  const idx = bag.items.findIndex((i) => i.key === next.key);
  if (idx >= 0) bag.items[idx] = next;
  else bag.items.unshift(next);
  await savePrefs(userId, clinicId, bag);
  return next;
}

export async function listPrefs(userId: string, clinicId?: string | null): Promise<UserPref[]> {
  const bag = await loadPrefs(userId, clinicId);
  return bag.items;
}

export async function deletePref(userId: string, clinicId: string | null | undefined, key: string): Promise<boolean> {
  const bag = await loadPrefs(userId, clinicId);
  const before = bag.items.length;
  bag.items = bag.items.filter((i) => i.key !== key);
  if (bag.items.length === before) return false;
  await savePrefs(userId, clinicId, bag);
  return true;
}

export async function clearPrefs(userId: string, clinicId?: string | null): Promise<void> {
  await memoryEngine.setLongTerm(PREFS_KEY, { items: [] }, userId, clinicKey(clinicId));
  if (clinicKey(clinicId) !== GLOBAL_CLINIC) {
    await memoryEngine.setLongTerm(PREFS_KEY, { items: [] }, userId, GLOBAL_CLINIC);
  }
}

/** Extract learnable preferences from the latest user utterance. */
export async function learnFromUserUtterance(
  text: string,
  userId: string,
  clinicId?: string | null,
): Promise<UserPref[]> {
  if (!userId || userId === 'guest') return [];
  const t = String(text || '').trim();
  if (!t || t.length < 3) return [];

  const learned: UserPref[] = [];
  const remember =
    t.match(/(?:запомни|запомните|please remember|remember)\s*[,:]?\s*(.+)$/i)
    || t.match(/(?:хочу чтобы ты|сделай так чтобы|всегда)\s+(.+)/i);

  if (remember?.[1]) {
    const value = remember[1].replace(/[.!?]+$/, '').trim().slice(0, 200);
    if (value.length >= 3) {
      learned.push(await upsertPref(userId, clinicId, {
        key: `fact_${slugKey(value)}`,
        label: 'Факт / правило',
        value,
        source: 'explicit',
      }));
    }
  }

  if (/\b(коротко|кратко|без воды|тезисно|по делу)\b/i.test(t)) {
    learned.push(await upsertPref(userId, clinicId, {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай коротко, тезисно, без воды',
      source: 'style',
    }));
  } else if (/\b(подробно|развёрнуто|развернуто|детально|с объяснением)\b/i.test(t)) {
    learned.push(await upsertPref(userId, clinicId, {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай подробнее, с пояснениями',
      source: 'style',
    }));
  }

  if (/\b(на казахском|по-казахски|қазақша)\b/i.test(t)) {
    learned.push(await upsertPref(userId, clinicId, {
      key: 'style_lang',
      label: 'Язык',
      value: 'Отвечай на казахском, когда уместно; термины клиники можно на русском',
      source: 'style',
    }));
  } else if (/\b(по-русски|на русском)\b/i.test(t)) {
    learned.push(await upsertPref(userId, clinicId, {
      key: 'style_lang',
      label: 'Язык',
      value: 'Отвечай по-русски',
      source: 'style',
    }));
  }

  if (/\b(сначала\s+(касса|выручк|долг|расписан|пациент))/i.test(t)
    || /\b(приоритет[еа]?\s*[:—-]?\s*(касса|выручка|долги|расписание))/i.test(t)) {
    const m = t.match(/(касса|выручк\w*|долг\w*|расписан\w*|пациент\w*)/i);
    if (m) {
      learned.push(await upsertPref(userId, clinicId, {
        key: 'priority_focus',
        label: 'Приоритет сводки',
        value: `В сводках и «что важно» сначала показывай: ${m[1]}`,
        source: 'habit',
      }));
    }
  }

  return learned;
}

/** Soft habit from successful navigation / tools. */
export async function learnFromToolsUsed(
  userId: string,
  clinicId: string | null | undefined,
  toolsUsed: string[],
): Promise<void> {
  if (!userId || userId === 'guest' || !toolsUsed?.length) return;
  const nav = toolsUsed.filter((t) => t === 'navigate' || t.startsWith('get_') || t.startsWith('list_'));
  if (!nav.length) return;
  const top = nav[0];
  await upsertPref(userId, clinicId, {
    key: `habit_tool_${top}`,
    label: 'Частый запрос',
    value: `Пользователь часто работает через инструмент «${top}» — учитывай это в подсказках`,
    source: 'habit',
  });
}

function formatPrefsBlock(items: UserPref[]): string {
  if (!items.length) return '';
  const lines = items.slice(0, 12).map((i) => `• ${i.label}: ${i.value}`);
  return `ПЕРСОНАЛЬНЫЕ ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ (учитывай всегда):\n${lines.join('\n')}`;
}

function formatTwinBlock(twin: any): string {
  if (!twin) return '';
  const parts: string[] = [];
  if (twin.roleLabel || twin.role) parts.push(`Роль: ${twin.roleLabel || twin.role}`);
  if (twin.specialty || twin.title) parts.push(`Профиль: ${twin.specialty || twin.title}`);
  if (twin.clinic?.name) parts.push(`Клиника: ${twin.clinic.name}`);
  if (twin.aiAdvice) parts.push(`Совет двойника: ${String(twin.aiAdvice).slice(0, 280)}`);
  if (Array.isArray(twin.kpis) && twin.kpis.length) {
    const kpi = twin.kpis.slice(0, 4).map((k: any) => `${k.label}=${k.value}`).join('; ');
    parts.push(`KPI: ${kpi}`);
  }
  if (Array.isArray(twin.learningPath) && twin.learningPath.length) {
    parts.push(`Фокус: ${twin.learningPath.slice(0, 2).join('; ')}`);
  }
  if (!parts.length) return '';
  return `ЦИФРОВОЙ ДВОЙНИК (живой профиль, не выдумывай сверх этого):\n${parts.map((p) => `• ${p}`).join('\n')}`;
}

async function getTwinBlock(userId: string, clinicId?: string | null, isGuest?: boolean): Promise<string> {
  if (!userId || userId === 'guest' || isGuest) return '';
  const cid = clinicKey(clinicId);
  try {
    const cached = (await memoryEngine.getSession(TWIN_CACHE_KEY, userId, cid)) as { at?: number; text?: string } | null;
    if (cached?.text && cached.at && Date.now() - cached.at < TWIN_TTL_MS) {
      return cached.text;
    }
    const { buildDigitalTwin } = await import('../core/digitalTwin.js');
    const twin = await buildDigitalTwin(userId, clinicId || null, { isGuest: false });
    const text = formatTwinBlock(twin);
    if (text) {
      await memoryEngine.setSession(TWIN_CACHE_KEY, { at: Date.now(), text }, userId, cid);
    }
    return text;
  } catch (e) {
    console.warn('[AI learning] twin summary failed', e);
    return '';
  }
}

function tokenize(s: string): Set<string> {
  return new Set(
    String(s || '')
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter((w) => w.length >= 3),
  );
}

function overlapScore(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit += 1;
  return hit / Math.sqrt(A.size * B.size);
}

export async function getPositiveFewShots(
  userId: string,
  clinicId: string | null | undefined,
  query: string,
): Promise<FewShotExample[]> {
  if (!userId || userId === 'guest') return [];
  try {
    const rows = await prisma.aIMessage.findMany({
      where: {
        feedback: 'up',
        role: 'assistant',
        OR: [
          { clinicId: clinicKey(clinicId) },
          { clinicId: GLOBAL_CLINIC },
          { clinicId: null },
        ],
        userId,
        prevUserText: { not: null },
      },
      orderBy: { feedbackAt: 'desc' },
      take: 40,
      select: { content: true, prevUserText: true },
    });
    const scored = rows
      .map((r) => {
        const user = decryptAiTranscriptText(r.prevUserText);
        const assistant = decryptAiTranscriptText(r.content).slice(0, 600);
        return { user, assistant, score: overlapScore(query, user) };
      })
      .filter((r) => r.user && r.assistant && r.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_FEW_SHOTS);
    return scored.map(({ user, assistant }) => ({ user, assistant }));
  } catch (e) {
    // Schema may not be migrated yet — fail soft
    console.warn('[AI learning] few-shot lookup failed', e);
    return [];
  }
}

export async function buildLearningContext(opts: {
  userId: string;
  clinicId?: string | null;
  role?: string;
  isGuest?: boolean;
  query: string;
}): Promise<LearningContext> {
  if (opts.isGuest || !opts.userId || opts.userId === 'guest') {
    return { prefsBlock: '', twinBlock: '', fewShots: [], rememberedLabels: [] };
  }

  const [prefs, twinBlock, fewShots] = await Promise.all([
    listPrefs(opts.userId, opts.clinicId),
    getTwinBlock(opts.userId, opts.clinicId, opts.isGuest),
    getPositiveFewShots(opts.userId, opts.clinicId, opts.query),
  ]);

  return {
    prefsBlock: formatPrefsBlock(prefs),
    twinBlock,
    fewShots,
    rememberedLabels: prefs.slice(0, 6).map((p) => p.label),
    learnedHint: prefs.length
      ? `Учитываю ${prefs.length} ваших предпочтений`
      : undefined,
  };
}

export async function recordMessageFeedback(opts: {
  userId: string;
  clinicId?: string | null;
  messageId?: string | null;
  sessionId?: string | null;
  rating: 'up' | 'down';
  assistantText?: string | null;
  userText?: string | null;
  intent?: string | null;
}): Promise<{ ok: boolean; messageId?: string }> {
  const rating = opts.rating === 'down' ? 'down' : 'up';
  let messageId = opts.messageId || undefined;
  const clinicId = clinicKey(opts.clinicId);

  try {
    let row: { id: string; content: string; prevUserText: string | null } | null = null;

    if (messageId) {
      // A message ID is not an authorization credential. Verify its owning
      // session belongs to the caller's current organization before updating.
      row = await prisma.aIMessage.findFirst({
        where: {
          id: messageId,
          ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
          session: { is: { userId: opts.userId, clinicId } },
        },
        select: { id: true, content: true, prevUserText: true },
      });
      if (!row) return { ok: false };
    } else if (opts.sessionId && opts.assistantText) {
      const ownedSession = await prisma.aISession.findFirst({
        where: { id: opts.sessionId, userId: opts.userId, clinicId },
        select: { id: true },
      });
      if (!ownedSession) return { ok: false };

      const candidates = await prisma.aIMessage.findMany({
        where: { sessionId: opts.sessionId, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: { id: true, content: true, prevUserText: true },
      });
      const expected = opts.assistantText.slice(0, 5000);
      row = candidates.find((candidate) => decryptAiTranscriptText(candidate.content).slice(0, 5000) === expected) || null;
    }

    if (row) {
      messageId = row.id;
      const previousUserText = opts.userText
        ? opts.userText.slice(0, 2000)
        : row.prevUserText
          ? decryptAiTranscriptText(row.prevUserText)
          : null;
      await prisma.aIMessage.update({
        where: { id: row.id },
        data: {
          // Re-encode legacy plaintext while touching the row.
          content: encryptAiTranscriptText(decryptAiTranscriptText(row.content)),
          prevUserText: previousUserText ? encryptAiTranscriptText(previousUserText) : null,
          feedback: rating,
          feedbackAt: new Date(),
          userId: opts.userId,
          clinicId,
        },
      });
    } else if (!opts.messageId && opts.sessionId && opts.assistantText) {
      // Create a feedback-anchored row only after proving session ownership.
      messageId = crypto.randomUUID();
      await prisma.aIMessage.create({
        data: {
          id: messageId,
          sessionId: opts.sessionId,
          role: 'assistant',
          content: encryptAiTranscriptText(String(opts.assistantText).slice(0, 8000)),
          feedback: rating,
          feedbackAt: new Date(),
          prevUserText: opts.userText ? encryptAiTranscriptText(opts.userText.slice(0, 2000)) : null,
          userId: opts.userId,
          clinicId,
        },
      });
    }

    if (rating === 'up' && opts.userText) {
      // Reinforce response style without persisting a quoted prompt or possible PHI.
      const len = String(opts.assistantText || '').length;
      if (len > 0 && len < 320) {
        await upsertPref(opts.userId, opts.clinicId, {
          key: 'style_length',
          label: 'Стиль ответа',
          value: 'Пользователю нравятся короткие ответы — держи формат сжатым',
          source: 'feedback',
        });
      } else if (len > 900) {
        await upsertPref(opts.userId, opts.clinicId, {
          key: 'style_length',
          label: 'Стиль ответа',
          value: 'Пользователю нравятся развёрнутые ответы — можно детальнее',
          source: 'feedback',
        });
      }
    }

    if (rating === 'down' && opts.userText) {
      await upsertPref(opts.userId, opts.clinicId, {
        key: 'feedback_avoid',
        label: 'Избегать',
        value: 'Похожий ответ не подошёл — уточняй запрос и предлагай альтернативу',
        source: 'feedback',
      });
    }

    return { ok: true, messageId };
  } catch (e) {
    console.error('[AI learning] record feedback failed', e);
    return { ok: false };
  }
}
