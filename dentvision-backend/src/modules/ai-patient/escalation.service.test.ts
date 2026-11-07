import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clinicFindUnique,
  patientFindFirst,
  clinicMemberFindMany,
  getOrOpenConversation,
  appendMessage,
  broadcast,
  dispatchNotifications,
} = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  patientFindFirst: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  getOrOpenConversation: vi.fn(),
  appendMessage: vi.fn(),
  broadcast: vi.fn(),
  dispatchNotifications: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: clinicFindUnique },
    patient: { findFirst: patientFindFirst },
    clinicMember: { findMany: clinicMemberFindMany },
  },
}));
vi.mock('../patient-conversation/patientConversation.service.js', () => ({
  getOrOpenConversation,
  appendMessage,
}));
vi.mock('../patient-conversation/conversationHub.js', () => ({
  clinicInboxHub: { broadcast },
}));
vi.mock('../notifications/dispatch.service.js', () => ({ dispatchNotifications }));

import { escalateToClinic } from './escalation.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  clinicFindUnique.mockResolvedValue({ name: 'DentVision Clinic', phone: '+77010000000' });
  patientFindFirst.mockResolvedValue({
    id: 'patient-1',
    firstName: 'Private Patient Name',
    lastName: 'Must Not Persist',
    phone: '+77019999999',
  });
  clinicMemberFindMany.mockResolvedValue([{ userId: 'owner-1' }]);
  getOrOpenConversation.mockResolvedValue({ id: 'conversation-1' });
  appendMessage.mockResolvedValue({ id: 'message-1' });
  dispatchNotifications.mockResolvedValue({});
});

describe('patient escalation privacy boundary', () => {
  it('persists no patient question, reason, name or phone in durable notification content', async () => {
    const question = 'Сильная боль и отёк после лечения';
    const reason = 'Требуется решение лечащего врача';
    await escalateToClinic({
      patientId: 'patient-1',
      patientUserId: 'patient-user-1',
      clinicId: 'clinic-1',
      question,
      reason,
      urgency: 'urgent',
    });

    expect(patientFindFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', clinicId: 'clinic-1' },
      select: { id: true },
    });
    expect(getOrOpenConversation).toHaveBeenCalledWith('patient-user-1', 'clinic-1', reason);
    expect(appendMessage).toHaveBeenCalledWith('conversation-1', 'PATIENT', question);

    const notifications = dispatchNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(1);
    const persistedNotification = JSON.stringify(notifications);
    for (const privateValue of [question, reason, 'Private Patient Name', 'Must Not Persist', '+77019999999']) {
      expect(persistedNotification).not.toContain(privateValue);
    }
    expect(notifications[0]).toMatchObject({
      title: 'Вопрос пациента требует ответа',
      message: 'Пациент передал обращение через ассистента. Откройте инбокс, чтобы прочитать и ответить.',
      link: '/crm/patient-inbox/conversation-1',
    });
  });

  it('does not open a conversation or notify anyone for a patient outside the clinic', async () => {
    patientFindFirst.mockResolvedValueOnce(null);
    await expect(escalateToClinic({
      patientId: 'patient-from-B',
      patientUserId: 'user-from-B',
      clinicId: 'clinic-A',
      question: 'private question',
      reason: 'private reason',
    })).rejects.toThrow('Patient does not belong to clinic');

    expect(getOrOpenConversation).not.toHaveBeenCalled();
    expect(dispatchNotifications).not.toHaveBeenCalled();
  });
});
