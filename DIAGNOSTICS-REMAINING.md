# Diagnostics — План дальнейшей реализации

## ✅ Уже сделано
- Prisma schema (15 моделей) + миграция SQL на Neon
- Backend API (20+ endpoints: centers, labs, studies, referrals, comments, dashboard)
- Лейаут с под-навигацией (9 пунктов)
- Динамическое левое меню (сворачиваемое)
- DiagnosticsDashboard (статистика + последние)
- ReferralForm (UI: категория, study type, пациент, priority, файлы)
- ReferralDetail (статус, пациент, информация)
- Плейсхолдеры: CenterList, LabList, Patients, Results, Calendar, Statistics, Settings
- Роуты `/diagnostics/*` под IntelligenceLayout
- Права доступа: все diagnostics pages для clinic ролей
- Sidebar: diagnostics пункт с role-based видимостью
- Super Admin: таб Diagnostics в /admin
- AI CFO: не падает без API ключа

---

## 🔴 Фаза A — ReferralForm → API (сейчас)
**Цель**: чтобы форма реально создавала направления

- [ ] A1. Связать ReferralForm с `createDiagnosticReferral` из api.ts
- [ ] A2. Добавить react-hook-form / валидацию (обязательные поля)
- [ ] A3. Обработка ошибок + success redirect
- [ ] A4. Подтянуть центры/лаборатории/исследования через API для селектов
- [ ] A5. ReferralList — список направлений с фильтрами (статус, дата, пациент)
- [ ] A6. ReferralList — поиск + пагинация

## 🟠 Фаза B — Файлы
- [ ] B1. Backend: endpoint `POST /api/diagnostics/files/upload` (multer/S3)
- [ ] B2. Frontend: FileUploader — drag & drop, превью, отправка
- [ ] B3. Backend: `DELETE /api/diagnostics/files/:id`
- [ ] B4. Превью файлов в ReferralDetail

## 🟡 Фаза C — Зубной селектор
- [ ] C1. ToothSelector — интерактивная схема зубов на основе AnatomicalToothSvg
- [ ] C2. Выбор: одиночный зуб / группа / регион (верх/низ, лево/право)
- [ ] C3. Сохранение выбора в `anatomicalSites` (JSONB)

## 🟢 Фаза D — Календарь и расписание
- [ ] D1. Schedule management (API уже есть: dashboard)
- [ ] D2. DiagnosticCalendar — календарь записей
- [ ] D3. Создание бронирования (DiagnosticBooking)

## 🔵 Фаза E — Статистика и настройки
- [ ] E1. DiagnosticStatistics — графики + фильтры
- [ ] E2. DiagnosticSettings — настройки диагностики для клиники

## 🟣 Фаза F — Уведомления + Админка
- [ ] F1. Уведомления при смене статуса referral (WebSocket / in-app)
- [ ] F2. Super Admin Diagnostics таб — модерация центров/лабораторий

## ⚪ Фаза G — AI + Интеграции
- [ ] G1. AI tools: проверка направления, генерация заключения
- [ ] G2. Интеграция с Marketplace (заказ материалов по результатам)
- [ ] G3. Интеграция с Academy (рекомендация курсов по типу диагностики)
- [ ] G4. Интеграция с Finance (учёт стоимости исследований)

---

## Приоритет сейчас
```
A1 → A2 → A3 → A4 → A5 → A6 → B1 → B2 → C1 → C2 → C3
```
Остальное — после завершения A+B+C.
