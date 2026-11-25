import { describe, expect, it } from 'vitest';
import { VisionModelUnavailableError } from '../lib/modelRouter.js';
import { getRadiographVisionUnavailableMessage } from './radiographModelAvailability.js';

describe('radiograph model availability message', () => {
  it('explains that image analysis is unavailable without implying a normal image', () => {
    const message = getRadiographVisionUnavailableMessage(new VisionModelUnavailableError());

    expect(message).toContain('Анализ снимков временно недоступен');
    expect(message).toContain('не интерпретируйте отсутствие AI-ответа как отсутствие патологии');
  });

  it('does not mask unrelated provider or application failures', () => {
    expect(getRadiographVisionUnavailableMessage(new Error('provider timeout'))).toBeNull();
    expect(getRadiographVisionUnavailableMessage('not an Error')).toBeNull();
  });
});
