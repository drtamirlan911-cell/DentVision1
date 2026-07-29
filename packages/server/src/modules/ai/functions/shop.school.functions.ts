export const shopFunctions = {
  recommendProduct: {
    name: 'recommendProduct',
    description: 'Рекомендовать товар',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        brand: { type: 'string' },
        priceRange: { type: 'string' },
      },
    },
  },
  searchProducts: {
    name: 'searchProducts',
    description: 'Поиск товаров',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  createOrder: {
    name: 'createOrder',
    description: 'Создать заказ в магазине',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number', default: 1 },
            },
            required: ['productId'],
          },
        },
        deliveryAddress: { type: 'string' },
      },
      required: ['items'],
    },
  },
  getFavorites: {
    name: 'getFavorites',
    description: 'Избранные товары',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  addToFavorites: {
    name: 'addToFavorites',
    description: 'Добавить в избранное',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
      },
      required: ['productId'],
    },
  },
};

export const schoolFunctions = {
  findCourse: {
    name: 'findCourse',
    description: 'Найти курс обучения',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        category: { type: 'string' },
        level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
      },
    },
  },
  getCourses: {
    name: 'getCourses',
    description: 'Список курсов',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  enrollCourse: {
    name: 'enrollCourse',
    description: 'Записаться на курс',
    parameters: {
      type: 'object',
      properties: {
        courseId: { type: 'string' },
      },
      required: ['courseId'],
    },
  },
  getEnrollments: {
    name: 'getEnrollments',
    description: 'Мои курсы',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};