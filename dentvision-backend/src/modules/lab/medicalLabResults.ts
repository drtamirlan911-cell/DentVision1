export interface MedicalLabTestResultInput {
  id: string;
  result?: unknown;
  resultText?: unknown;
  unit?: unknown;
  referenceRange?: unknown;
  flag?: unknown;
  metadata?: unknown;
}

export interface MedicalLabTestRecord {
  id: string;
  name?: string;
}

export interface NormalizedMedicalLabResult {
  id: string;
  result: string | null;
  resultText: string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: string | null;
  metadata: unknown;
}

export type MedicalLabResultValidation =
  | { ok: true; results: NormalizedMedicalLabResult[] }
  | { ok: false; code: 'NO_ORDER_TESTS' | 'INVALID_RESULT_SET' | 'UNKNOWN_TEST' | 'DUPLICATE_TEST' | 'MISSING_RESULT'; message: string };

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

export function validateMedicalLabResultSet(
  tests: readonly MedicalLabTestRecord[],
  input: unknown,
): MedicalLabResultValidation {
  if (tests.length === 0) {
    return { ok: false, code: 'NO_ORDER_TESTS', message: 'В направлении не зарегистрированы анализы' };
  }
  if (!Array.isArray(input) || input.length !== tests.length) {
    return { ok: false, code: 'INVALID_RESULT_SET', message: 'Нужно передать результат для каждого зарегистрированного анализа' };
  }

  const allowedIds = new Set(tests.map((test) => test.id));
  const seen = new Set<string>();
  const normalized: NormalizedMedicalLabResult[] = [];

  for (const raw of input as MedicalLabTestResultInput[]) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
      return { ok: false, code: 'INVALID_RESULT_SET', message: 'Каждый результат должен быть привязан к анализу' };
    }
    const id = raw.id.trim();
    if (!allowedIds.has(id)) {
      return { ok: false, code: 'UNKNOWN_TEST', message: 'Результат содержит анализ, которого нет в этом направлении' };
    }
    if (seen.has(id)) {
      return { ok: false, code: 'DUPLICATE_TEST', message: 'Один анализ указан несколько раз' };
    }
    seen.add(id);

    const result = optionalText(raw.result);
    const resultText = optionalText(raw.resultText);
    if (!result && !resultText) {
      const testName = tests.find((test) => test.id === id)?.name || id;
      return { ok: false, code: 'MISSING_RESULT', message: `Не заполнен результат анализа «${testName}»` };
    }
    normalized.push({
      id,
      result,
      resultText,
      unit: optionalText(raw.unit),
      referenceRange: optionalText(raw.referenceRange),
      flag: optionalText(raw.flag),
      metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : null,
    });
  }

  if (seen.size !== allowedIds.size) {
    return { ok: false, code: 'INVALID_RESULT_SET', message: 'Не все анализы направления получили результат' };
  }

  return { ok: true, results: normalized };
}
