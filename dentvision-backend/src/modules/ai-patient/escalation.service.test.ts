import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clinicFindUnique, patientFindFirst, memberFindMany, getOrOpenConversation, appendMessage, broadcast } = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  patientFindFirst: vi.fn(),
  memberFindMany: vi.fn(),
  getOrOpenConversation: vi.fn(),
  appendMessage: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: clinicFindUnique },
    patient: { findFirst: patientFindFirst },
    clinicMember: { findMany: memberFindMany },
  },
}));

vi.mock('../patient-conversation/patientConversation.service.js', () => ({
  getOrOpenConversation,
  appendMessage,
}));

vi.mock('../patient-conversation/conversationHub.js', () => ({
  clinicInboxHub: { broadcast },
}));

import { escalateToClinic } from './escalation.service.js';

describe('escalateToClinic tenant boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clinicFindUnique.mockResolvedValue({ name: 'Clinic', phone: '+77000000000' });
    memberFindMany.mockResolvedValue([]);
    getOrOpenConversation.mockResolvedValue({ id: 'conversation-1' });
    appendMessage.mockResolvedValue(undefined);
  });

  it('rejects a patient from another clinic before creating a conversation', async () => {
    patientFindFirst.mockResolvedValue(null);

    await expect(escalateToClinic({
      patientId: 'patient-other-clinic',
      patientUserId: 'user-1',
      clinicId: 'clinic-a',
      question: 'Помогите',
      reason: 'AI cannot answer',
    })).rejects.toThrow('Patient does not belong to clinic');

    expect(getOrOpenConversation).not.toHaveBeenCalled();
    expect(appendMessage).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('allows same-clinic escalation and opens the conversation', async () => {
    patientFindFirst.mockResolvedValue({ firstName: 'Иван', lastName: 'Иванов', phone: '+77001112233' });

    const result = await escalateToClinic({
      patientId: 'patient-1',
      patientUserId: 'user-1',
      clinicId: 'clinic-a',
      question: 'Когда следующий приём?',
      reason: 'Нужен ответ сотрудника',
      urgency: 'soon',
    });

    expect(result.conversationId).toBe('conversation-1');
    expect(getOrOpenConversation).toHaveBeenCalledWith('user-1', 'clinic-a', 'Нужен ответ сотрудника');
    expect(appendMessage).toHaveBeenCalledWith('conversation-1', 'PATIENT', 'Когда следующий приём?');
    expect(broadcast).toHaveBeenCalledWith('clinic-a', expect.objectContaining({ conversationId: 'conversation-1' }));
  });
});
