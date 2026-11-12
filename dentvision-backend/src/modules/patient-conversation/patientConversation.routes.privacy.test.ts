import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const patientRoute = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-conversation/patientConversation.routes.ts'),
  'utf8',
);
const staffRoute = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-conversation/patientInbox.routes.ts'),
  'utf8',
);

describe('patient conversation error privacy', () => {
  it('does not expose raw internal errors in patient-facing 500 responses', () => {
    expect(patientRoute).not.toMatch(/status\\(500\\)\\.json\\(\\{\\s*ok:\\s*false,\\s*error:\\s*e\\.message/);
    expect(patientRoute).toContain('Не удалось загрузить диалог. Попробуйте позже.');
    expect(patientRoute).toContain('Не удалось отправить сообщение. Попробуйте позже.');
  });

  it('does not expose raw internal errors in staff inbox 500 responses', () => {
    expect(staffRoute).not.toMatch(/status\\(500\\)\\.json\\(\\{\\s*ok:\\s*false,\\s*error:\\s*e\\.message/);
    expect(staffRoute).toContain('Не удалось загрузить список диалогов. Попробуйте позже.');
    expect(staffRoute).toContain('Не удалось обработать обращение. Попробуйте позже.');
  });

  it('preserves the deliberately generic typed 404/409 conversation responses', () => {
    expect(staffRoute).toContain("e?.code === 'NOT_FOUND'");
    expect(staffRoute).toContain("e?.code === 'FORBIDDEN'");
  });
});
