export const medicalFunctions = {
  getMedicalCard: {
    name: 'getMedicalCard',
    description: 'Открыть медицинскую карту пациента',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
      },
      required: ['patientId'],
    },
  },
  createTreatmentPlan: {
    name: 'createTreatmentPlan',
    description: 'Создать план лечения',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        title: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tooth: { type: 'string' },
              procedure: { type: 'string' },
              price: { type: 'number' },
              status: { type: 'string', enum: ['planned', 'in_progress', 'completed'] },
            },
            required: ['tooth', 'procedure'],
          },
        },
      },
      required: ['patientId', 'title', 'items'],
    },
  },
  getTreatmentPlan: {
    name: 'getTreatmentPlan',
    description: 'Получить план лечения',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
      },
      required: ['patientId'],
    },
  },
  addTooth: {
    name: 'addTooth',
    description: 'Добавить зуб в карту (зубная формула)',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        toothNumber: { type: 'string' },
        status: { type: 'string', enum: ['healthy', 'caries', 'filled', 'crown', 'implant', 'missing', 'extraction_needed'] },
        surfaces: { type: 'array', items: { type: 'string' } },
      },
      required: ['patientId', 'toothNumber'],
    },
  },
  openImaging: {
    name: 'openImaging',
    description: 'Открыть КТ/рентген',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        type: { type: 'string', enum: ['CBCT', 'X_RAY', 'PHOTO', 'SCAN'] },
      },
      required: ['patientId'],
    },
  },
  addVisit: {
    name: 'addVisit',
    description: 'Добавить визит в медицинскую карту',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        doctorId: { type: 'string' },
        diagnosis: { type: 'string' },
        complaints: { type: 'string' },
        treatment: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
      },
      required: ['patientId', 'doctorId'],
    },
  },
};