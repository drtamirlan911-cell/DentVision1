export const financeFunctions = {
  createInvoice: {
    name: 'createInvoice',
    description: 'Создать счет/инвойс',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        amount: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              quantity: { type: 'number', default: 1 },
            },
            required: ['name', 'price'],
          },
        },
        notes: { type: 'string' },
      },
      required: ['patientId', 'amount'],
    },
  },
  getInvoices: {
    name: 'getInvoices',
    description: 'Получить список счетов',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        status: { type: 'string', enum: ['PAID', 'UNPAID', 'PARTIAL', 'REFUND'] },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  getDebtors: {
    name: 'getDebtors',
    description: 'Список должников',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20 },
      },
    },
  },
  recordPayment: {
    name: 'recordPayment',
    description: 'Зафиксировать оплату',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number' },
        method: { type: 'string', enum: ['CASH', 'CARD', 'TRANSFER', 'INSURANCE'] },
      },
      required: ['invoiceId', 'amount'],
    },
  },
  generateReport: {
    name: 'generateReport',
    description: 'Сгенерировать финансовый отчет',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['revenue', 'expenses', 'profit', 'doctor_performance'] },
        period: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'] },
        doctorId: { type: 'string' },
      },
      required: ['type', 'period'],
    },
  },
};