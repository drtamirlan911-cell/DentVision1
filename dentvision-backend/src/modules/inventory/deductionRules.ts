/**
 * Правила списания расходников после приёма.
 *
 * Раньше это была одна строка в настройках клиники — `autoDeductItems`.
 * У неё три беды. Она не знала количеств: подсказка в интерфейсе предлагала
 * писать «Перчатки:1, Маска:1», а разбор резал строку только по запятой и
 * искал на складе позицию с именем «Перчатки:1» — то есть ровно тот формат,
 * которому учил интерфейс, не списывал ничего. Она всегда списывала по одной
 * единице. И она не различала приёмы: на осмотр и на имплантацию уходил один
 * и тот же список.
 *
 * Правило теперь знает область действия:
 *   always    — расходники каждого приёма (перчатки, маска, слюноотсос);
 *   service   — код услуги из прайса;
 *   diagnosis — код МКБ-10.
 *
 * Правила складываются: приём с двумя диагнозами берёт материалы обоих, а
 * общие расходники всё равно уходят один раз — они лежат в отдельном
 * правиле `always`, а не повторяются в каждом.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { recordMovement, isMovementApplied } from './ledger.js';

export type RuleScope = 'always' | 'service' | 'diagnosis';

export const RULE_SCOPES: RuleScope[] = ['always', 'service', 'diagnosis'];

export function isRuleScope(v: unknown): v is RuleScope {
  return typeof v === 'string' && (RULE_SCOPES as string[]).includes(v);
}

/**
 * Коды МКБ-10 из свободного текста диагноза.
 *
 * Диагноз хранится как «K02.1 — Кариес дентина»: код и русское название в
 * одном поле. Класс `[A-Z]` латинский, поэтому в кириллицу он не попадает,
 * а левую границу проверяем явной группой, а не `\b` — `\w` в JavaScript
 * это `[A-Za-z0-9_]`, и с русским текстом он ведёт себя не так, как кажется.
 */
export function parseIcdCodes(raw: string | null | undefined): string[] {
  const text = String(raw || '');
  const out: string[] = [];
  const re = /(^|[^A-Za-z0-9.])([A-Z]\d{2}(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = m[2].toUpperCase();
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Подходит ли правило к диагнозу приёма.
 *
 * `matchKey` — либо полный код («K02.1»), либо корень рубрики («K02»).
 * Корень цепляет всю рубрику, полный код — только себя. Клиника выбирает
 * точность сама: на весь кариес нужен один набор, а на пульпит и
 * периодонтит внутри K04 — разные.
 */
export function matchesDiagnosis(matchKey: string, code: string): boolean {
  const key = String(matchKey || '').trim().toUpperCase();
  const dx = String(code || '').trim().toUpperCase();
  if (!key || !dx) return false;
  if (key === dx) return true;
  // Корень рубрики раскрывается только вниз: «K02» ловит «K02.1»,
  // но «K02.1» не должен ловить «K02».
  return !key.includes('.') && dx.startsWith(`${key}.`);
}

export interface DeductionContext {
  clinicId: string;
  /** Коды услуг из закрытого приёма. */
  serviceCodes?: string[];
  /** Свободный текст диагноза и/или готовые коды МКБ-10. */
  diagnosisText?: string | null;
  diagnosisCodes?: string[];
}

export interface DeductionLine {
  itemId: string;
  itemName: string;
  unit: string | null;
  /** Сколько списать суммарно по всем сработавшим правилам. */
  quantity: number;
  /** Остаток на складе до списания — из него видно, хватит ли. */
  available: number;
  /** Названия правил, которые дали эту позицию, — для объяснения в интерфейсе. */
  sources: string[];
}

type Db = Prisma.TransactionClient | PrismaClient;

function ruleTitle(rule: { scope: string; matchKey: string; label: string | null }): string {
  if (rule.label) return rule.label;
  if (rule.scope === 'always') return 'Каждый приём';
  if (rule.scope === 'service') return `Услуга ${rule.matchKey}`;
  return `Диагноз ${rule.matchKey}`;
}

/**
 * Что списать за этот приём — до того, как что-либо списано.
 *
 * Отдельно от применения: тем же расчётом интерфейс показывает врачу
 * предпросмотр «спишется вот это», не трогая склад.
 */
export async function resolveDeductionPlan(
  db: Db,
  ctx: DeductionContext,
): Promise<DeductionLine[]> {
  const serviceCodes = (ctx.serviceCodes || [])
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  const diagnosisCodes = [
    ...(ctx.diagnosisCodes || []).map((c) => String(c || '').trim().toUpperCase()),
    ...parseIcdCodes(ctx.diagnosisText),
  ].filter(Boolean);

  const rules = await db.stockDeductionRule.findMany({
    where: { clinicId: ctx.clinicId, active: true },
    include: {
      items: {
        include: {
          item: { select: { id: true, name: true, unit: true, quantity: true } },
        },
      },
    },
  });

  const byItem = new Map<string, DeductionLine>();

  for (const rule of rules) {
    const scope = String(rule.scope);
    let hit = false;
    if (scope === 'always') hit = true;
    else if (scope === 'service') hit = serviceCodes.includes(rule.matchKey);
    else if (scope === 'diagnosis') hit = diagnosisCodes.some((dx) => matchesDiagnosis(rule.matchKey, dx));
    if (!hit) continue;

    for (const line of rule.items) {
      const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0));
      if (qty === 0 || !line.item) continue;
      const existing = byItem.get(line.itemId);
      if (existing) {
        existing.quantity += qty;
        if (!existing.sources.includes(ruleTitle(rule))) existing.sources.push(ruleTitle(rule));
      } else {
        byItem.set(line.itemId, {
          itemId: line.itemId,
          itemName: line.item.name,
          unit: line.item.unit,
          quantity: qty,
          available: Number(line.item.quantity) || 0,
          sources: [ruleTitle(rule)],
        });
      }
    }
  }

  return [...byItem.values()].sort((a, b) => a.itemName.localeCompare(b.itemName, 'ru'));
}

export interface DeductionResult {
  /** Что реально ушло со склада. */
  deducted: Array<{ itemId: string; name: string; quantity: number; unit: string | null }>;
  /** Чего не хватило: правило просило больше, чем было на остатке. */
  short: Array<{ itemId: string; name: string; requested: number; taken: number }>;
}

/**
 * Провести списание по плану.
 *
 * Ссылка движения — сам приём, поэтому повторный вызов (двойной клик,
 * ретрай сети) ничего не спишет второй раз: уникальный ключ журнала
 * (refType, refId, itemId) отклонит вставку.
 */
export async function applyDeductionPlan(
  tx: Db,
  args: {
    clinicId: string;
    appointmentId: string;
    plan: DeductionLine[];
    userId?: string | null;
  },
): Promise<DeductionResult> {
  const deducted: DeductionResult['deducted'] = [];
  const short: DeductionResult['short'] = [];

  for (const line of args.plan) {
    const outcome = await recordMovement(tx, {
      clinicId: args.clinicId,
      itemId: line.itemId,
      delta: -line.quantity,
      reason: 'appointment_close',
      refType: 'appointment',
      refId: args.appointmentId,
      note: line.sources.join(', '),
      userId: args.userId || null,
    });
    if (!isMovementApplied(outcome)) {
      if (outcome.reason === 'empty') {
        short.push({ itemId: line.itemId, name: line.itemName, requested: line.quantity, taken: 0 });
      }
      continue;
    }
    deducted.push({
      itemId: line.itemId,
      name: line.itemName,
      quantity: -outcome.delta,
      unit: line.unit,
    });
    if (outcome.shortfall > 0) {
      short.push({
        itemId: line.itemId,
        name: line.itemName,
        requested: line.quantity,
        taken: -outcome.delta,
      });
    }
  }

  return { deducted, short };
}

/** Разбор старой строки настроек: «Перчатки:1, Маска:2» и просто «Перчатки». */
export function parseLegacyAutoDeduct(raw: string | null | undefined): Array<{ name: string; quantity: number }> {
  return String(raw || '')
    .split(',')
    .map((chunk) => {
      const text = chunk.trim();
      if (!text) return null;
      const sep = text.lastIndexOf(':');
      if (sep > 0) {
        const qty = Number(text.slice(sep + 1).trim());
        if (Number.isFinite(qty) && qty > 0) {
          return { name: text.slice(0, sep).trim(), quantity: Math.trunc(qty) };
        }
      }
      return { name: text, quantity: 1 };
    })
    .filter((v): v is { name: string; quantity: number } => v !== null && v.name.length > 0);
}

/**
 * Перенести старую строку клиники в правило «каждый приём».
 *
 * Не разово и не по флагу: функция сама сходится к бездействию — она берёт
 * только клиники, у которых строка ещё не пуста, и очищает её после переноса.
 * Поэтому её безопасно звать на каждом старте, и она подхватит клинику,
 * заведённую между выкатками.
 */
export async function migrateLegacyAutoDeduct(): Promise<{ migrated: number; skipped: string[] }> {
  const clinics = await prisma.clinic.findMany({ select: { id: true, settings: true } });
  let migrated = 0;
  const skipped: string[] = [];

  for (const clinic of clinics) {
    const settings = (clinic.settings && typeof clinic.settings === 'object'
      ? clinic.settings
      : {}) as Record<string, unknown>;
    const legacy = parseLegacyAutoDeduct(settings.autoDeductItems as string);
    if (legacy.length === 0) {
      // Строки нет — но, возможно, лежит пустая; чистим, чтобы поле не
      // мозолило глаза в настройках.
      if (settings.autoDeductItems) {
        await prisma.clinic.update({
          where: { id: clinic.id },
          data: { settings: { ...settings, autoDeductItems: '' } as any },
        });
      }
      continue;
    }

    const items = await prisma.inventoryItem.findMany({
      where: { clinicId: clinic.id },
      select: { id: true, name: true },
    });
    const byName = new Map(items.map((i) => [i.name.trim().toLowerCase(), i.id]));

    const lines: Array<{ itemId: string; quantity: number }> = [];
    for (const entry of legacy) {
      const itemId = byName.get(entry.name.toLowerCase());
      if (itemId) lines.push({ itemId, quantity: entry.quantity });
      else skipped.push(`${clinic.id}:${entry.name}`);
    }

    if (lines.length > 0) {
      await prisma.$transaction(async (tx) => {
        const rule = await tx.stockDeductionRule.upsert({
          where: { clinicId_scope_matchKey: { clinicId: clinic.id, scope: 'always', matchKey: '' } },
          create: {
            clinicId: clinic.id,
            scope: 'always',
            matchKey: '',
            label: 'Расходники каждого приёма',
          },
          update: {},
          select: { id: true },
        });
        for (const line of lines) {
          await tx.stockDeductionRuleItem.upsert({
            where: { ruleId_itemId: { ruleId: rule.id, itemId: line.itemId } },
            create: { ruleId: rule.id, itemId: line.itemId, quantity: line.quantity },
            update: { quantity: line.quantity },
          });
        }
      });
      migrated += 1;
    }

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { settings: { ...settings, autoDeductItems: '' } as any },
    });
  }

  return { migrated, skipped };
}
