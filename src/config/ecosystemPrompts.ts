import type { EcosystemParticipant } from './ecosystem';

export interface EcosystemPrompt { id: string; label: string; prompt: string; participants: EcosystemParticipant[] }

export const ECOSYSTEM_PROMPTS: readonly EcosystemPrompt[] = [
  { id: 'find-provider', label: 'Найти нужного партнёра', prompt: 'Найди подходящий диагностический центр, медицинскую или зуботехническую лабораторию для текущей задачи', participants: ['professional','clinic','patient'] },
  { id: 'find-material', label: 'Подобрать материал', prompt: 'Подбери материал или оборудование под мою клиническую задачу и покажи варианты в Market', participants: ['professional','clinic'] },
  { id: 'clinical-case', label: 'Разобрать клинический кейс', prompt: 'Разбери текущий клинический контекст, выдели недостающие данные и предложи следующий безопасный шаг', participants: ['professional','clinic'] },
  { id: 'lab-order', label: 'Проверить лабораторный заказ', prompt: 'Покажи открытые лабораторные заказы, сроки и задачи, требующие внимания', participants: ['professional','clinic','dental_laboratory'] },
  { id: 'diagnostic-results', label: 'Проверить диагностику', prompt: 'Покажи готовые диагностические результаты и исследования, связанные с моим рабочим контекстом', participants: ['professional','clinic','diagnostic_center','patient'] },
  { id: 'business', label: 'Понять бизнес', prompt: 'Покажи ключевые показатели моего рабочего пространства и задачи, которые сейчас требуют внимания', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy'] },
  { id: 'learn', label: 'Продолжить обучение', prompt: 'Подбери следующий полезный материал или курс в Academy на основе моего профессионального контекста', participants: ['professional','student','lecturer'] },
  { id: 'career', label: 'Найти возможность', prompt: 'Найди подходящие вакансии, специалистов или профессиональные связи для моей цели', participants: ['professional','employer','job_seeker'] },
  { id: 'market', label: 'Найти товар', prompt: 'Найди в DentVision Market подходящие материалы или оборудование и сравни варианты', participants: ['professional','clinic','supplier','patient'] },
];

export function promptsForParticipant(participant: EcosystemParticipant) {
  return ECOSYSTEM_PROMPTS.filter(item => item.participants.includes(participant));
}
