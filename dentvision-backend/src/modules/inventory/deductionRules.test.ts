import { describe, expect, it, vi } from 'vitest';
import { parseIcdCodes, matchesDiagnosis, parseLegacyAutoDeduct, resolveDeductionPlan, applyDeductionPlan, isRuleScope } from './deductionRules.js';

describe('parseIcdCodes', () => {
  it('достаёт код из «код — название»', () => expect(parseIcdCodes('K02.1 — Кариес дентина')).toEqual(['K02.1']));
  it('находит несколько кодов в одной строке', () => expect(parseIcdCodes('K02.1 Кариес дентина; K04.0 Пульпит')).toEqual(['K02.1', 'K04.0']));
  it('берёт код без уточнения', () => expect(parseIcdCodes('K08 Другие изменения зубов')).toEqual(['K08']));
  it('не выдумывает коды из русского текста', () => { expect(parseIcdCodes('Кариес дентина, зуб 16')).toEqual([]); expect(parseIcdCodes('Профгигиена, ОПТГ 2 снимка')).toEqual([]); });
  it('не режет код из середины слова или версии', () => { expect(parseIcdCodes('SK02.1')).toEqual([]); expect(parseIcdCodes('1.K02')).toEqual([]); });
  it('не повторяет один код дважды', () => expect(parseIcdCodes('K02.1 и снова K02.1')).toEqual(['K02.1']));
  it('переносит регистр к верхнему', () => { expect(parseIcdCodes('пусто')).toEqual([]); expect(parseIcdCodes(null)).toEqual([]); });
});
describe('matchesDiagnosis', () => {
  it('совпадает точный код', () => expect(matchesDiagnosis('K02.1', 'K02.1')).toBe(true));
  it('корень рубрики охватывает уточнённые коды', () => { expect(matchesDiagnosis('K02', 'K02.1')).toBe(true); expect(matchesDiagnosis('K02', 'K02.9')).toBe(true); });
  it('уточнённый код не расширяется до рубрики', () => { expect(matchesDiagnosis('K04.0', 'K04.5')).toBe(false); expect(matchesDiagnosis('K02.1', 'K02')).toBe(false); });
  it('не путает соседние рубрики', () => { expect(matchesDiagnosis('K02', 'K021')).toBe(false); expect(matchesDiagnosis('K0', 'K02.1')).toBe(false); });
  it('не совпадает на пустых значениях', () => { expect(matchesDiagnosis('', 'K02.1')).toBe(false); expect(matchesDiagnosis('K02', '')).toBe(false); });
});
describe('parseLegacyAutoDeduct', () => {
  it('разбирает формат из старой подсказки', () => expect(parseLegacyAutoDeduct('Перчатки:1, Маска:2, Слюноотсос:1')).toEqual([{ name: 'Перчатки', quantity: 1 }, { name: 'Маска', quantity: 2 }, { name: 'Слюноотсос', quantity: 1 }]));
  it('понимает и просто названия', () => expect(parseLegacyAutoDeduct('Перчатки, Маска')).toEqual([{ name: 'Перчатки', quantity: 1 }, { name: 'Маска', quantity: 1 }]));
  it('не теряет двоеточие внутри названия', () => expect(parseLegacyAutoDeduct('Гель А:Б:3')).toEqual([{ name: 'Гель А:Б', quantity: 3 }]));
  it('игнорирует пустое и мусорное количество', () => { expect(parseLegacyAutoDeduct('Перчатки:0')).toEqual([{ name: 'Перчатки:0', quantity: 1 }]); expect(parseLegacyAutoDeduct(' , , ')).toEqual([]); expect(parseLegacyAutoDeduct('')).toEqual([]); expect(parseLegacyAutoDeduct(null)).toEqual([]); });
});
describe('isRuleScope', () => {
  it('пропускает только три известные области', () => { expect(isRuleScope('always')).toBe(true); expect(isRuleScope('service')).toBe(true); expect(isRuleScope('diagnosis')).toBe(true); expect(isRuleScope('tooth')).toBe(false); expect(isRuleScope(null)).toBe(false); });
});
function item(id: string, name: string, quantity = 100) { return { id, name, unit: 'шт', quantity }; }
function rule(scope: string, matchKey: string, label: string | null, lines: Array<[string, string, number]>) { return { scope, matchKey, label, items: lines.map(([itemId, name, quantity]) => ({ itemId, quantity, item: item(itemId, name) })) }; }
function fakeDb(rules: unknown[]) { return { stockDeductionRule: { findMany: vi.fn(async () => rules) } } as any; }

describe('resolveDeductionPlan', () => {
  it('берёт расходники каждого приёма', async () => { const plan = await resolveDeductionPlan(fakeDb([rule('always', '', 'Каждый приём', [['g', 'Перчатки', 1]])]), { clinicId: 'c1' }); expect(plan).toHaveLength(1); expect(plan[0]).toMatchObject({ itemId: 'g', itemName: 'Перчатки', quantity: 1 }); expect(plan[0].sources).toEqual(['Каждый приём']); });
  it('срабатывает на код услуги из приёма', async () => { const plan = await resolveDeductionPlan(fakeDb([rule('service', 's3', null, [['comp', 'Композит', 1]]), rule('service', 's9', null, [['sut', 'Шовный материал', 1]])]), { clinicId: 'c1', serviceCodes: ['s3'] }); expect(plan.map((l) => l.itemId)).toEqual(['comp']); expect(plan[0].sources).toEqual(['Услуга s3']); });
  it('срабатывает на диагноз из свободного текста', async () => { const plan = await resolveDeductionPlan(fakeDb([rule('diagnosis', 'K02', null, [['comp', 'Композит', 2]])]), { clinicId: 'c1', diagnosisText: 'K02.1 — Кариес дентина' }); expect(plan).toHaveLength(1); expect(plan[0].quantity).toBe(2); });
  it('складывает количества, когда позиция пришла из двух правил', async () => { const plan = await resolveDeductionPlan(fakeDb([rule('diagnosis', 'K02.1', 'Кариес', [['comp', 'Композит', 1]]), rule('diagnosis', 'K04.0', 'Пульпит', [['comp', 'Композит', 2]])]), { clinicId: 'c1', diagnosisCodes: ['K02.1', 'K04.0'] }); expect(plan).toHaveLength(1); expect(plan[0].quantity).toBe(3); expect(plan[0].sources).toEqual(['Кариес', 'Пульпит']); });
  it('не умножает общие расходники на число диагнозов', async () => { const plan = await resolveDeductionPlan(fakeDb([rule('always', '', 'Каждый приём', [['g', 'Перчатки', 1]]), rule('diagnosis', 'K02.1', 'Кариес', [['comp', 'Композит', 1]]), rule('diagnosis', 'K04.0', 'Пульпит', [['comp', 'Композит', 1]])]), { clinicId: 'c1', diagnosisCodes: ['K02.1', 'K04.0'] }); expect(plan.find((l) => l.itemId === 'g')?.quantity).toBe(1); });
  it('молчит, когда ни одно правило не подошло', async () => expect(await resolveDeductionPlan(fakeDb([rule('service', 's3', null, [['comp', 'Композит', 1]])]), { clinicId: 'c1', serviceCodes: ['s9'] })).toEqual([]));
  it('пропускает строки с нулевым количеством', async () => expect(await resolveDeductionPlan(fakeDb([rule('always', '', null, [['g', 'Перчатки', 0]])]), { clinicId: 'c1' })).toEqual([]));
});

describe('applyDeductionPlan', () => {
  function txFor(stock: Record<string, number>) {
    let queryCount = 0;
    return {
      $queryRaw: vi.fn(async () => { queryCount += 1; return [{ branch_id: null, clinic_id: 'c1' }]; }),
      inventoryItem: { findFirst: vi.fn(async ({ where }: any) => stock[where.id] === undefined ? null : { id: where.id, quantity: stock[where.id] }), updateMany: vi.fn(async () => ({ count: 1 })) },
      inventoryMovement: { create: vi.fn(async () => ({ id: `mv-${queryCount}-${Math.random()}` })), delete: vi.fn(async () => ({})) },
    } as any;
  }
  const plan = [
    { itemId: 'g', itemName: 'Перчатки', unit: 'пар', quantity: 2, available: 10, sources: ['Каждый приём'] },
    { itemId: 'm', itemName: 'Маска', unit: 'шт', quantity: 3, available: 1, sources: ['Каждый приём'] },
  ];
  it('списывает и отдельно возвращает нехватку', async () => { const tx = txFor({ g: 10, m: 1 }); const out = await applyDeductionPlan(tx, { clinicId: 'c1', appointmentId: 'a1', plan }); expect(out.deducted).toEqual([{ itemId: 'g', name: 'Перчатки', quantity: 2, unit: 'пар' }, { itemId: 'm', name: 'Маска', quantity: 1, unit: 'шт' }]); expect(out.short).toEqual([{ itemId: 'm', name: 'Маска', requested: 3, taken: 1 }]); });
  it('привязывает движение к приёму — ради идемпотентности', async () => { const tx = txFor({ g: 10, m: 5 }); await applyDeductionPlan(tx, { clinicId: 'c1', appointmentId: 'a1', plan }); expect(tx.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ refType: 'appointment', refId: 'a1', reason: 'appointment_close' }); });
});
