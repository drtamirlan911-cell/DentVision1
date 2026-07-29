import { AgentTool } from '../interfaces.js';

export const SHOP_TOOLS: AgentTool[] = [
  {
    name: 'checkInventory',
    description: 'Проверка текущих остатков материалов на складе',
    parameters: {
      itemId: { type: 'string', description: 'ID товара', required: false },
      category: { type: 'string', description: 'Категория товаров', required: false },
    },
    destructive: false,
  },
  {
    name: 'createPurchaseOrder',
    description: 'Формирование заявки на закупку материалов',
    parameters: {
      itemId: { type: 'string', description: 'ID товара', required: true },
      quantity: { type: 'number', description: 'Количество для заказа', required: true },
      supplierId: { type: 'string', description: 'ID поставщика', required: false },
    },
    destructive: false,
  },
  {
    name: 'getSuppliers',
    description: 'Получение списка поставщиков для указанного товара',
    parameters: {
      itemId: { type: 'string', description: 'ID товара', required: false },
      category: { type: 'string', description: 'Категория товаров', required: false },
    },
    destructive: false,
  },
  {
    name: 'checkPrices',
    description: 'Сравнение цен на материал у разных поставщиков',
    parameters: {
      itemId: { type: 'string', description: 'ID товара', required: true },
    },
    destructive: false,
  },
];
