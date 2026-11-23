import { VisionModelUnavailableError } from '../lib/modelRouter.js';

/** A non-diagnostic, user-facing explanation for a missing vision model. */
export function getRadiographVisionUnavailableMessage(error: unknown): string | null {
  if (!(error instanceof VisionModelUnavailableError)) return null;
  return 'Анализ снимков временно недоступен: для текущего API-аккаунта не выбрана vision-модель. Обратитесь к администратору; не интерпретируйте отсутствие AI-ответа как отсутствие патологии.';
}
