# Инструкция по переходу на PostgreSQL (Neon)

## ✅ Выполнено

1. **Создан backend API сервер** (`/workspace/server/`) с поддержкой PostgreSQL
2. **Настроено подключение к Neon PostgreSQL** с вашими учетными данными
3. **Инициализирована база данных** со всеми таблицами и начальными данными
4. **Сервер запущен** и работает на `http://localhost:3001`

## 📁 Структура файлов

```
/workspace/
├── .env                          # Конфигурация (DATABASE_URL, VITE_API_URL)
├── server/
│   ├── package.json              # Зависимости backend
│   ├── index.js                  # API сервер
│   └── .env                      # Копия конфигурации для сервера
└── src/
    └── utils/
        ├── postgres.js           # Конфигурация PostgreSQL для frontend
        └── supabase.js           # Старый файл Supabase (можно удалить)
```

## 🚀 Запуск проекта

### 1. Backend API сервер (уже запущен)
```bash
cd /workspace/server
npm start
# Сервер работает на http://localhost:3001
```

### 2. Frontend приложение
```bash
cd /workspace
npm run dev
```

## 🔧 API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/health` | Проверка подключения к БД |
| GET | `/clinics` | Получить все клиники |
| POST | `/auth/login` | Аутентификация пользователя |
| GET | `/clinic/:id/data` | Загрузка всех данных клиники |
| POST | `/:table/upsert` | Создание/обновление записи |
| DELETE | `/:table/:id` | Удаление записи |
| POST | `/users/create` | Создание пользователя |

## 👥 Учетные данные

**Super Admin:**
- Логин: `dr.tamirlan`
- Пароль: `DentVision2025!`

**Клиника c1 (Тараз — Центр):**
- Admin: `admin_c1` / `admin123`
- Doctor: `doc1_c1` / `doc123`

**Клиника c2 (Тараз — Север):**
- Admin: `admin_c2` / `admin456`
- Doctor: `doc1_c2` / `doc789`

## ⚠️ Важно для frontend

Для работы frontend приложения с новым backend необходимо обновить файлы:

1. **`src/context/AuthContext.jsx`** - изменить вызовы API на использование backend
2. **`src/hooks/useData.js`** - переключить загрузку данных на backend API
3. **Удалить или закомментировать** старый файл `src/utils/supabase.js`

Пример запроса к API:
```javascript
// Вместо прямого вызова Supabase
const response = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login, password })
});
```

## 🔒 Безопасность

- Пароли хешируются с помощью bcrypt
- SSL соединение с Neon PostgreSQL
- В production используйте переменные окружения для чувствительных данных

## 📊 База данных PostgreSQL

База данных автоматически инициализирована со следующими таблицами:
- `clinics` - клиники
- `users` - пользователи
- `patients` - пациенты
- `appointments` - приёмы
- `treatments` - лечения
- `receipts` - оплаты
- `subscriptions` - подписки
- `lab_orders` - лабораторные заказы
- `photos` - фотографии
- `expenses` - расходы
- `inventory` - инвентарь
- `debts` - долги
- `referrals` - рефералы

## 🆘 Troubleshooting

Если сервер не запускается:
```bash
cd /workspace/server
npm install
cp ../.env .env
node index.js
```

Проверка подключения:
```bash
curl http://localhost:3001/health
```
