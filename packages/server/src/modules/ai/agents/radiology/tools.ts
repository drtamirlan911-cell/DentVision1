import { AgentTool } from '../interfaces.js';

export const RADIOLOGY_TOOLS: AgentTool[] = [
  {
    name: 'analyzeXray',
    description: 'Анализ рентгеновского снимка и выявление аномалий',
    parameters: {
      imageUrl: { type: 'string', description: 'URL изображения снимка', required: true },
      patientId: { type: 'string', description: 'ID пациента', required: true },
      imageType: { type: 'string', description: 'Тип снимка', required: true, enum: ['X_RAY', 'CBCT', 'DICOM', 'PHOTO'] },
    },
    destructive: false,
  },
  {
    name: 'detectPathology',
    description: 'Выявление патологий на рентгеновском снимке',
    parameters: {
      imageUrl: { type: 'string', description: 'URL изображения', required: true },
      focusArea: { type: 'string', description: 'Область фокусировки анализа', required: false },
    },
    destructive: false,
  },
  {
    name: 'compareWithPrevious',
    description: 'Сравнение текущего снимка с предыдущими исследованиями',
    parameters: {
      currentImageUrl: { type: 'string', description: 'URL текущего снимка', required: true },
      patientId: { type: 'string', description: 'ID пациента', required: true },
    },
    destructive: false,
  },
  {
    name: 'generateReport',
    description: 'Генерация отчёта по результатам анализа снимка',
    parameters: {
      imageUrl: { type: 'string', description: 'URL изображения', required: true },
      patientId: { type: 'string', description: 'ID пациента', required: true },
      findings: { type: 'string', description: 'Найденные аномалии', required: true },
    },
    destructive: false,
  },
];
