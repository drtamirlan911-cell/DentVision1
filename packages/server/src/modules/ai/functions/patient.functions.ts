export const patientFunctions = {
  searchPatient: {
    name: 'searchPatient',
    description: 'Поиск пациента по имени, телефону или ID',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Имя, телефон или ID пациента' },
      },
      required: ['query'],
    },
  },
  getPatient: {
    name: 'getPatient',
    description: 'Получить полную информацию о пациенте',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
      },
      required: ['patientId'],
    },
  },
  createPatient: {
    name: 'createPatient',
    description: 'Создать нового пациента',
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        birthDate: { type: 'string', format: 'date' },
        gender: { type: 'string', enum: ['male', 'female'] },
      },
      required: ['firstName', 'lastName', 'phone'],
    },
  },
  updatePatient: {
    name: 'updatePatient',
    description: 'Обновить данные пациента',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['patientId'],
    },
  },
  getPatientHistory: {
    name: 'getPatientHistory',
    description: 'История визитов пациента',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
      },
      required: ['patientId'],
    },
  },
};