# SYSTEM_MAP — что система содержит на самом деле

> **Сгенерировано** `npm run system-map` из исходников.
> Не редактируйте руками — перезапустите генератор.
> Суждения («это скрытая функция», «это мёртвый код») живут в `SYSTEM_AUDIT.md`;
> здесь только факты, которые можно вывести из кода.

Собрано: 2026-08-24

## Сводка

| Измерение | Значение |
|---|---|
| Смонтированных роутеров | 63 |
| Обработчиков маршрутов | 548 |
| Маршрутов без потребителя на фронте | **84** |
| Роутеров, объявленных но не смонтированных | 0 |
| Prisma-моделей | 141 |
| — без прямых вызовов Prisma-клиента | **3** |
| — только пишутся, никогда не читаются | **2** |
| — только читаются, никогда не пишутся | 8 |
| Ролей в матрице прав | 10 |
| Фоновых задач | 8 |
| Инструментов AI | 44 |
| — без записи в TOOL_PERMISSIONS/UNGATED_TOOLS | **0** |
| Skills | 11 |
| — ссылаются на несуществующий инструмент | **0** |
| Агентов в реестре | 16 |
| — недостижимы ни из одной роли | **0** |
| Маршрутов без негативного теста в e2e/ | **435** из 556 |

## Роутеры

«Без потребителя» = ни один строковый литерал `/api/...` во фронтенде
не совпадает с маршрутом посегментно. Это **не** значит «мёртвый»:
так же выглядят вебхуки, серверные интеграции и внутренние вызовы.

| Префикс | Роутер | Маршрутов | Без потребителя |
|---|---|---|---|
| `/api` | compatRouter | 0 | 0 |
| `/api/auth` | authRouter | 15 | **2** |
| `/api/iam` | iamRouter | 11 | **1** |
| `/api/clinics` | clinicsRouter | 10 | **1** |
| `/api/patients` | patientsRouter | 10 | **3** |
| `/api/appointments` | appointmentsRouter | 6 | **1** |
| `/api/medical` | medicalRouter | 14 | **3** |
| `/api/billing` | billingRouter | 9 | **3** |
| `/api/payments` | paymentsRouter | 5 | **2** |
| `/api/subscriptions` | subscriptionsRouter | 2 | **1** |
| `/api/clinic-billing` | clinicBillingRouter | 5 | **1** |
| `/api/inventory` | inventoryRouter | 5 | 0 |
| `/api/shop` | shopRouter | 37 | **1** |
| `/api/suppliers` | suppliersRouter | 10 | **3** |
| `/api/supplier` | supplierWorkspaceRouter | 22 | 0 |
| `/api/lecturer` | lecturerRouter | 10 | 0 |
| `/api/school` | schoolRouter | 27 | 0 |
| `/api/dentcash` | dentcashRouter | 4 | **1** |
| `/api/academies` | academiesRouter | 4 | 0 |
| `/api/lecturers` | lecturersRouter | 5 | **2** |
| `/api/ai` | aiRouter | 20 | **2** |
| `/api/guest` | guestRouter | 2 | **2** |
| `/api/analytics` | analyticsRouter | 4 | **4** |
| `/api/analytics` | ecosystemRouter | 1 | **1** |
| `/api/compliance` | complianceRouter | 14 | **2** |
| `/api/notifications` | notificationsRouter | 8 | 0 |
| `/api/files` | filesRouter | 8 | **3** |
| `/api/documents` | filesRouter | 8 | **7** |
| `/api/audit` | auditRouter | 2 | 0 |
| `/api/admin` | adminRouter | 18 | **2** |
| `/api/crm` | crmRouter | 13 | 0 |
| `/api/crm` | crmOpsRouter | 15 | 0 |
| `/api/crm` | remindersRouter | 4 | **1** |
| `/api/crm` | chairsRouter | 3 | 0 |
| `/api/lab-orders` | labRouter | 4 | **1** |
| `/api/community` | communityRouter | 12 | 0 |
| `/api/public` | publicRouter | 7 | **7** |
| `/api/profile` | profileRouter | 12 | 0 |
| `/api/jobs` | jobsRouter | 4 | 0 |
| `/api/ops/suppliers` | opsSuppliersRouter | 4 | **1** |
| `/api/ops` | opsHubRouter | 11 | 0 |
| `/api/bi` | biRouter | 16 | **3** |
| `/api/diagnostics` | diagnosticsRouter | 51 | **7** |
| `/api/legal` | legalRouter | 0 | 0 |
| `/api/partner/legal` | legalPartnerRouter | 0 | 0 |
| `/api/finance` | financeRouter | 12 | **4** |
| `/api/disputes` | disputesRouter | 3 | 0 |
| `/api/ai-admin/webhook` | webhookGatewayRouter | 0 | 0 |
| `/api/ai-governance` | aiGovernanceRouter | 3 | **1** |
| `/api/meta` | metaRouter | 5 | **2** |
| `/api/organizations` | organizationsRouter | 5 | 0 |
| `/api/persons` | personsRouter | 5 | 0 |
| `/api/patient-portal/ai` | aiPatientRouter | 4 | 0 |
| `/api/patient-portal/presentation` | patientPresentationRouter | 4 | 0 |
| `/api/patient-portal/conversation` | patientConversationRouter | 4 | **1** |
| `/api/patient-portal` | patientPortalRouter | 21 | **6** |
| `/api/cross-clinic` | crossClinicRouter | 3 | 0 |
| `/api/patient-inbox` | patientInboxRouter | 9 | **1** |
| `/api/developer` | developerRouter | 6 | 0 |
| `/api/v1` | v1Router | 1 | **1** |
| `/api/partners` | partnersRouter | 9 | 0 |
| `/api/workflows` | workflowRouter | 5 | 0 |
| `/api/data` | dataRouter | 5 | 0 |

## Маршруты, которые фронтенд не зовёт

<details><summary>Развернуть список</summary>

- `POST /api/auth/logout` — dentvision-backend/src/modules/auth/auth.routes.ts
- `POST /api/auth/refresh` — dentvision-backend/src/modules/auth/auth.routes.ts
- `GET /api/iam/permissions` — dentvision-backend/src/modules/iam/iam.routes.ts
- `POST /api/clinics/:id/invite` — dentvision-backend/src/modules/clinics/clinics.routes.ts
- `GET /api/patients/:id/history` — dentvision-backend/src/modules/patients/patients.routes.ts
- `GET /api/patients/:id/images` — dentvision-backend/src/modules/patients/patients.routes.ts
- `GET /api/patients/:id/treatment-plan` — dentvision-backend/src/modules/patients/patients.routes.ts
- `PATCH /api/appointments/:id/status` — dentvision-backend/src/modules/appointments/appointments.routes.ts
- `PATCH /api/medical/treatment-plan/:id` — dentvision-backend/src/modules/medical/medical.routes.ts
- `GET /api/medical/treatment-plan/:patientId` — dentvision-backend/src/modules/medical/medical.routes.ts
- `GET /api/medical/teeth/:patientId` — dentvision-backend/src/modules/medical/medical.routes.ts
- `GET /api/billing/summary` — dentvision-backend/src/modules/billing/billing.routes.ts
- `GET /api/billing/my-payroll` — dentvision-backend/src/modules/billing/billing.routes.ts
- `GET /api/billing/reports` — dentvision-backend/src/modules/billing/billing.routes.ts
- `POST /api/payments/callbacks/kaspi` — dentvision-backend/src/modules/payments/payments.routes.ts
- `POST /api/payments/callbacks/kaspi/clinic/:clinicId` — dentvision-backend/src/modules/payments/payments.routes.ts
- `GET /api/subscriptions/:ownerType/:ownerId` — dentvision-backend/src/modules/billing/subscriptions.routes.ts
- `POST /api/clinic-billing/cron` — dentvision-backend/src/modules/billing/clinicBilling.routes.ts
- `GET /api/shop/products/:id/offers` — dentvision-backend/src/modules/shop/shop.routes.ts
- `POST /api/suppliers/:id/status` — dentvision-backend/src/modules/suppliers/suppliers.routes.ts
- `DELETE /api/suppliers/:id/members/:userId` — dentvision-backend/src/modules/suppliers/suppliers.routes.ts
- `POST /api/suppliers/:id/documents` — dentvision-backend/src/modules/suppliers/suppliers.routes.ts
- `POST /api/dentcash/platform-rules` — dentvision-backend/src/modules/dentcash/dentcash.routes.ts
- `GET /api/lecturers/:id` — dentvision-backend/src/modules/academy/academy.routes.ts
- `POST /api/lecturers/:id/verifications` — dentvision-backend/src/modules/academy/academy.routes.ts
- `POST /api/ai/query/stream` — dentvision-backend/src/modules/ai/ai.routes.ts
- `GET /api/ai/twin/proactive` — dentvision-backend/src/modules/ai/ai.routes.ts
- `POST /api/guest/session` — dentvision-backend/src/modules/guest/guest.routes.ts
- `POST /api/guest/convert` — dentvision-backend/src/modules/guest/guest.routes.ts
- `GET /api/analytics/dashboard` — dentvision-backend/src/modules/analytics/analytics.routes.ts
- `GET /api/analytics/revenue` — dentvision-backend/src/modules/analytics/analytics.routes.ts
- `GET /api/analytics/doctors` — dentvision-backend/src/modules/analytics/analytics.routes.ts
- `GET /api/analytics/patients-growth` — dentvision-backend/src/modules/analytics/analytics.routes.ts
- `GET /api/analytics/ecosystem` — dentvision-backend/src/modules/analytics/ecosystem.routes.ts
- `POST /api/compliance/checks` — dentvision-backend/src/modules/compliance/compliance.routes.ts
- `GET /api/compliance/checks` — dentvision-backend/src/modules/compliance/compliance.routes.ts
- `POST /api/files/documents/:id/send-signature` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/files/documents/:id/sign` — dentvision-backend/src/modules/files/files.routes.ts
- `GET /api/files/:id/content` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/documents/documents` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/documents/documents/:id/send-signature` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/documents/documents/:id/sign` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/documents/upload` — dentvision-backend/src/modules/files/files.routes.ts
- `GET /api/documents/:id/content` — dentvision-backend/src/modules/files/files.routes.ts
- `GET /api/documents/:id` — dentvision-backend/src/modules/files/files.routes.ts
- `DELETE /api/documents/:id` — dentvision-backend/src/modules/files/files.routes.ts
- `POST /api/admin/reset-demo` — dentvision-backend/src/modules/admin/admin.routes.ts
- `GET /api/admin/test-accounts` — dentvision-backend/src/modules/admin/admin.routes.ts
- `POST /api/crm/reminders/cron` — dentvision-backend/src/modules/crm/reminders.routes.ts
- `PATCH /api/lab-orders/:id/status` — dentvision-backend/src/modules/lab/lab.routes.ts
- `GET /api/public/clinic/:clinicId` — dentvision-backend/src/modules/public/public.routes.ts
- `GET /api/public/clinic/:clinicId/slots` — dentvision-backend/src/modules/public/public.routes.ts
- `POST /api/public/booking` — dentvision-backend/src/modules/public/public.routes.ts
- `GET /api/public/document/:token` — dentvision-backend/src/modules/public/public.routes.ts
- `POST /api/public/document/:token/sign` — dentvision-backend/src/modules/public/public.routes.ts
- `GET /api/public/privacy` — dentvision-backend/src/modules/public/public.routes.ts
- `GET /api/public/terms` — dentvision-backend/src/modules/public/public.routes.ts
- `GET /api/ops/suppliers` — dentvision-backend/src/modules/ops/ops.suppliers.routes.ts
- `GET /api/bi/saas-metrics/history` — dentvision-backend/src/modules/bi/bi.routes.ts
- `GET /api/bi/customer-metrics/:clinicId/history` — dentvision-backend/src/modules/bi/bi.routes.ts
- `GET /api/bi/snapshots` — dentvision-backend/src/modules/bi/bi.routes.ts
- `GET /api/diagnostics/platform/commissions` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/platform/settlements/generate` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/platform/settlements` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/settlements/:id/pay` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/centers/:id/study-price` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/centers/:id/subscription` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/centers/:id/subscription/activate` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/finance/wallets/:ownerType/:ownerId` — dentvision-backend/src/modules/finance/finance.routes.ts
- `POST /api/finance/sales` — dentvision-backend/src/modules/finance/finance.routes.ts
- `GET /api/finance/expenses` — dentvision-backend/src/modules/finance/finance.routes.ts
- `POST /api/finance/expenses` — dentvision-backend/src/modules/finance/finance.routes.ts
- `POST /api/ai-governance/course/outline` — dentvision-backend/src/modules/ai-governance/ai-governance.routes.ts
- `GET /api/meta/callback` — dentvision-backend/src/modules/meta-oauth/meta.routes.ts
- `POST /api/meta/refresh` — dentvision-backend/src/modules/meta-oauth/meta.routes.ts
- `GET /api/patient-portal/conversation/stream` — dentvision-backend/src/modules/patient-conversation/patientConversation.routes.ts
- `GET /api/patient-portal/me` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `GET /api/patient-portal/treatment-plans` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `GET /api/patient-portal/documents/:id/content` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `PUT /api/patient-portal/me/profile` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `GET /api/patient-portal/clinics` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `POST /api/patient-portal/appointments/:id/cancel` — dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts
- `POST /api/patient-inbox/escalations/:id/resolve` — dentvision-backend/src/modules/patient-conversation/patientInbox.routes.ts
- `GET /api/v1/ping` — dentvision-backend/src/modules/developer/v1.routes.ts

</details>

## Модели данных

### Нет ни одного прямого вызова Prisma-клиента

Учитываются и прямые вызовы клиента, и чтение через `include`/`select`
родителя — без второго счёт врал: `Permission`, `RolePermission` и
`PersonRole` читаются именно так, в `middleware/rbac.ts`.
Всё равно повод посмотреть, а не приговор.

`SpecTemplate`, `FinancialTransaction`, `Schedule`

### Пишутся, но никогда не читаются

Данные копятся и никому не показываются — либо незаконченный workflow,
либо запись «на будущее».

| Модель | Записей |
|---|---|
| `Revenue` | 1 |
| `ActionEvidence` | 1 |

### Читаются, но никогда не пишутся из приложения

Заполняются миграцией, сидом или вручную.

`ShopBanner`, `ShopPromotion`, `LedgerEntry`, `ServiceAccess`, `Operator`, `Radiologist`, `DiagnosticBooking`, `PatientAssignment`

## Права по ролям

`SUPERADMIN` здесь намеренно отсутствует: он не хранится в карте,
а обрабатывается в `roleHasPermission`. `DIRECTOR` — алиас OWNER,
`CASHIER` — алиас ADMIN; оба задокументированы в `lib/permissions.ts`.

| Роль | Прав | Ключи |
|---|---|---|
| **OWNER** | 36 | `patients.read` `patients.write` `patients.delete` `appointments.read` `appointments.write` `appointments.delete` `medical.read` `medical.write` `medical.delete` `medical.manage` `billing.read` `billing.write` `billing.delete` `billing.manage` `inventory.read` `inventory.write` `inventory.delete` `lab.read` `lab.write` `lab.delete` `staff.read` `staff.write` `staff.delete` `staff.manage` `settings.manage` `analytics.read` `diagnostics.read` `diagnostics.write` `academy.manage` `shop.manage` `community.read` `community.write` `audit.read` `bi.read` `backup.read` `dashboard.read` |
| **ADMIN** | 26 | `patients.read` `patients.write` `patients.delete` `appointments.read` `appointments.write` `appointments.delete` `medical.read` `medical.write` `billing.read` `billing.write` `billing.manage` `inventory.read` `inventory.write` `lab.read` `lab.write` `staff.read` `staff.write` `settings.manage` `analytics.read` `diagnostics.read` `diagnostics.write` `academy.manage` `shop.manage` `community.read` `community.write` `bi.read` |
| **MANAGER** | 15 | `patients.read` `appointments.read` `medical.read` `billing.read` `inventory.read` `inventory.write` `lab.read` `staff.read` `settings.manage` `analytics.read` `diagnostics.read` `shop.read` `academy.read` `bi.read` `dashboard.read` |
| **DOCTOR** | 15 | `patients.read` `patients.write` `appointments.read` `appointments.write` `medical.read` `medical.write` `medical.manage` `billing.read` `inventory.read` `lab.read` `lab.write` `diagnostics.read` `shop.read` `academy.read` `community.read` |
| **ASSISTANT** | 10 | `patients.read` `appointments.read` `appointments.write` `medical.read` `inventory.read` `lab.read` `shop.read` `academy.read` `community.read` `diagnostics.read` |
| **LAB** | 7 | `patients.read` `appointments.read` `lab.read` `lab.write` `inventory.read` `shop.read` `diagnostics.read` |
| **STUDENT** | 5 | `patients.read` `appointments.read` `medical.read` `shop.read` `academy.read` |
| **SUPPORT** | 7 | `patients.read` `appointments.read` `billing.read` `bi.read` `admin.read` `shop.read` `analytics.read` |
| **DIRECTOR** | 36 | `patients.read` `patients.write` `patients.delete` `appointments.read` `appointments.write` `appointments.delete` `medical.read` `medical.write` `medical.delete` `medical.manage` `billing.read` `billing.write` `billing.delete` `billing.manage` `inventory.read` `inventory.write` `inventory.delete` `lab.read` `lab.write` `lab.delete` `staff.read` `staff.write` `staff.delete` `staff.manage` `settings.manage` `analytics.read` `diagnostics.read` `diagnostics.write` `academy.manage` `shop.manage` `community.read` `community.write` `audit.read` `bi.read` `backup.read` `dashboard.read` |
| **CASHIER** | 26 | `patients.read` `patients.write` `patients.delete` `appointments.read` `appointments.write` `appointments.delete` `medical.read` `medical.write` `billing.read` `billing.write` `billing.manage` `inventory.read` `inventory.write` `lab.read` `lab.write` `staff.read` `staff.write` `settings.manage` `analytics.read` `diagnostics.read` `diagnostics.write` `academy.manage` `shop.manage` `community.read` `community.write` `bi.read` |

## Фоновые задачи

- `aiApprovalSweeper.ts`
- `biSnapshotCron.ts`
- `patientConversationOnCall.ts`
- `recallAgent.ts`
- `reminderCron.ts`
- `settlementCron.ts`
- `subscriptionCron.ts`
- `workflowRetry.ts`

## Инструменты AI

`askClinicStaff`, `assessUrgency`, `book_appointment`, `cancelAppointment`, `cancelMyAppointment`, `composeCeoBrief`, `createAppointment`, `createDiagnosticReferral`, `createInvoice`, `createLabOrder`, `createTreatmentPlan`, `draftPromoCopy`, `escalate_to_human`, `getClinicLoadPlan`, `getDashboardStats`, `getDebtors`, `getDoctorUtilization`, `getInventory`, `getLabOrders`, `getMyAppointments`, `getMyAvailableSlots`, `getMyClinicAccess`, `getMyDiagnostics`, `getMyDocuments`, `getMyInvoices`, `getMyTreatmentPlans`, `getMyTreatments`, `getMyVisits`, `getPatientCard`, `getPromotions`, `getRecallList`, `getRevenue`, `getSchedule`, `getTreatmentPlans`, `getVisits`, `get_available_slots`, `navigate`, `requestAppointment`, `rescheduleAppointment`, `searchCourses`, `searchPatients`, `searchProducts`, `updateAppointmentStatus`, `updateLabOrderStatus`

## Самоаудит слоя AI OS (Stage 12)

Четыре проверки полноты, которые уже отдельно проверяют
`toolPermissions.test.ts` и `skills.test.ts` — здесь тот же факт в
человекочитаемом виде, плюс пятая (`e2e`-покрытие), у которой своего
юнит-теста нет. Пустой список = проверка проходит.

### Инструменты без записи в TOOL_PERMISSIONS/UNGATED_TOOLS

_нет — каждый инструмент staff-поверхности классифицирован._

### Skills, ссылающиеся на несуществующий инструмент

_нет — каждый skill ссылается только на существующие инструменты._

### Агенты, недостижимые ни из одной роли

Реестр (`registry.ts::agentsForRole`) выдаёт агента только когда его
`requiredPermissions` пересекается с реальной ролью из матрицы прав —
«недостижим» здесь означает именно это, а не низкое использование.
SUPERADMIN/GUEST/SUPPLIER/LECTURER — не клиничные роли и не входят
в матрицу выше, но реально используются в AI OS (`os/access.ts`,
`orchestrator.ts`), поэтому засчитаны как достижимые отдельно.

_нет — каждый агент достижим хотя бы одной ролью._

### Маршруты без негативного теста в e2e/

Грубая, файловая эвристика (см. комментарий в `routesWithoutNegativeTest`):
маршрут считается «покрытым», если какой-то `e2e/tests/*.spec.ts`,
чьи строковые литералы посегментно совпадают с его URL, где-то в том
же файле содержит код 4xx. Это переоценивает покрытие, а не занижает —
пункт списка стоит посмотреть глазами, а не считать доказанным разрывом.

<details><summary>Развернуть список</summary>

- `POST /api/auth/google`
- `POST /api/auth/switch-clinic`
- `POST /api/auth/clinics`
- `POST /api/auth/demo-clinic`
- `POST /api/auth/join-clinic`
- `POST /api/auth/invitations`
- `GET /api/auth/invitations/lookup`
- `POST /api/auth/reset-password`
- `GET /api/iam/permissions`
- `GET /api/iam/types`
- `GET /api/iam/me/contexts`
- `POST /api/iam/invitations`
- `GET /api/iam/invitations`
- `GET /api/iam/invitations/lookup`
- `POST /api/iam/join-by-invite`
- `GET /api/iam/roles`
- `POST /api/iam/persons/:personId/roles`
- `DELETE /api/iam/persons/:personId/roles/:roleId`
- `GET /api/clinics/:id`
- `PATCH /api/clinics/:id`
- `GET /api/clinics/:id/settings`
- `PUT /api/clinics/:id/settings`
- `POST /api/clinics/:id/invite`
- `POST /api/clinics/:id/staff`
- `PATCH /api/clinics/:id/staff/:userId`
- `DELETE /api/clinics/:id/staff/:userId`
- `GET /api/patients/:id/summary`
- `GET /api/patients/:id/history`
- `GET /api/patients/:id/images`
- `GET /api/patients/:id/treatment-plan`
- `POST /api/patients/:id/deposit`
- `POST /api/appointments/:id/close`
- `GET /api/medical/patients/:patientId/visits`
- `POST /api/medical/treatment-plan`
- `PATCH /api/medical/treatment-plan/:id`
- `GET /api/medical/treatment-plan/:patientId`
- `POST /api/medical/teeth`
- `GET /api/medical/teeth/:patientId`
- `POST /api/medical/images`
- `GET /api/medical/images/:patientId`
- `DELETE /api/medical/images/:id`
- `GET /api/medical/icd10`
- `GET /api/billing/summary`
- `GET /api/billing/my-payroll`
- `GET /api/billing/reports`
- `POST /api/payments/callbacks/kaspi/clinic/:clinicId`
- `GET /api/subscriptions/:ownerType/:ownerId`
- `POST /api/clinic-billing/cron`
- `GET /api/clinic-billing/me`
- `POST /api/clinic-billing/checkout`
- `POST /api/clinic-billing/confirm`
- `GET /api/clinic-billing/payments/:id`
- `POST /api/shop/favorites`
- `GET /api/shop/favorites`
- `GET /api/shop/product-presets`
- `POST /api/shop/product-presets/quick-add`
- `GET /api/shop/banners`
- `GET /api/shop/promotions`
- `GET /api/shop/recommendations`
- `GET /api/shop/categories/:slug`
- `GET /api/shop/spec-templates`
- `GET /api/shop/delivery-zones`
- `GET /api/shop/delivery-calc`
- `GET /api/shop/delivery-preview`
- `GET /api/shop/products/:id/offers`
- `GET /api/shop/reviews`
- `POST /api/shop/reviews`
- `GET /api/shop/products/:productId/reviews`
- `POST /api/shop/product-presets/seed`
- `DELETE /api/shop/categories/:id`
- `DELETE /api/shop/suppliers/:id`
- `GET /api/shop/admin/products`
- `POST /api/shop/admin/products`
- `PATCH /api/shop/admin/products/:id`
- `DELETE /api/shop/admin/products/:id`
- `GET /api/shop/admin/reviews`
- `PATCH /api/shop/admin/reviews/:id`
- `GET /api/shop/admin/stats`
- `POST /api/suppliers/register`
- `GET /api/suppliers/:id`
- `PATCH /api/suppliers/:id`
- `POST /api/suppliers/:id/status`
- `GET /api/suppliers/:id/members`
- `POST /api/suppliers/:id/members`
- `DELETE /api/suppliers/:id/members/:userId`
- `POST /api/suppliers/:id/documents`
- `GET /api/supplier/me`
- `PATCH /api/supplier/me`
- `POST /api/supplier/documents`
- `GET /api/supplier/dashboard`
- `GET /api/supplier/insights`
- `GET /api/supplier/orders`
- `PATCH /api/supplier/orders/:id/status`
- `POST /api/supplier/promotions`
- `GET /api/supplier/cashback-rules`
- `PUT /api/supplier/cashback-rules`
- `DELETE /api/supplier/cashback-rules/:id`
- `GET /api/supplier/products`
- `POST /api/supplier/products`
- `PATCH /api/supplier/products/:id`
- `DELETE /api/supplier/products/:id`
- `GET /api/supplier/wallet`
- `POST /api/supplier/payouts`
- `GET /api/supplier/analytics`
- `GET /api/supplier/delivery-zones`
- `POST /api/supplier/delivery-zones`
- `PUT /api/supplier/delivery-zones/:id`
- `DELETE /api/supplier/delivery-zones/:id`
- `GET /api/lecturer/me`
- `PATCH /api/lecturer/me`
- `GET /api/lecturer/courses`
- `POST /api/lecturer/courses`
- `PATCH /api/lecturer/courses/:id`
- `DELETE /api/lecturer/courses/:id`
- `GET /api/lecturer/analytics`
- `GET /api/school/hub`
- `GET /api/school/courses/:id`
- `PUT /api/school/courses/:id`
- `DELETE /api/school/courses/:id`
- `POST /api/school/enrollments`
- `GET /api/school/enrollments`
- `PATCH /api/school/enrollments/:id`
- `GET /api/school/clinical-cases`
- `POST /api/school/clinical-cases`
- `PUT /api/school/clinical-cases/:id`
- `GET /api/school/library`
- `GET /api/school/live`
- `GET /api/school/webinars`
- `GET /api/school/office-courses`
- `GET /api/school/textbooks`
- `POST /api/school/commerce/register`
- `GET /api/school/certificates`
- `GET /api/school/lessons/:lessonId/exam`
- `POST /api/school/lessons/:lessonId/exam/submit`
- `POST /api/school/tutor`
- `POST /api/school/homework/review`
- `DELETE /api/school/clinical-cases/:id`
- `POST /api/school/library`
- `PUT /api/school/library/:id`
- `DELETE /api/school/library/:id`
- `GET /api/dentcash/wallet`
- `GET /api/dentcash/transactions`
- `POST /api/dentcash/quote`
- `POST /api/dentcash/platform-rules`
- `GET /api/lecturers/:id`
- `POST /api/lecturers/:id/level`
- `POST /api/lecturers/:id/verifications`
- `POST /api/ai/query/stream`
- `GET /api/ai/threads/active`
- `POST /api/ai/threads/new`
- `POST /api/ai/action`
- `POST /api/ai/session`
- `POST /api/ai/greeting`
- `GET /api/ai/proactive`
- `GET /api/ai/briefing`
- `POST /api/ai/confirm`
- `GET /api/ai/digital-twin`
- `GET /api/ai/twin/proactive`
- `POST /api/ai/feedback`
- `GET /api/ai/memory`
- `DELETE /api/ai/memory/:key`
- `DELETE /api/ai/memory`
- `GET /api/ai/insights`
- `POST /api/ai/insights/:id/dismiss`
- `POST /api/guest/session`
- `POST /api/guest/convert`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/revenue`
- `GET /api/analytics/doctors`
- `GET /api/analytics/patients-growth`
- `GET /api/analytics/ecosystem`
- `GET /api/compliance/sessions`
- `POST /api/compliance/sessions/:id/expire`
- `POST /api/compliance/sessions/expire-all`
- `GET /api/compliance/consents`
- `GET /api/compliance/consents/required`
- `POST /api/compliance/consents`
- `GET /api/compliance/medical/:patientId`
- `POST /api/compliance/medical/log`
- `GET /api/compliance/ai`
- `POST /api/compliance/ai/:id/confirm`
- `GET /api/compliance/ai/stats`
- `POST /api/compliance/checks`
- `GET /api/compliance/checks`
- `GET /api/compliance/dashboard`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences`
- `GET /api/notifications/types`
- `POST /api/files/documents/:id/send-signature`
- `POST /api/files/documents/:id/sign`
- `POST /api/documents/documents`
- `POST /api/documents/documents/:id/send-signature`
- `POST /api/documents/documents/:id/sign`
- `POST /api/documents/upload`
- `GET /api/documents/:id/content`
- `GET /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/audit/backup`
- `POST /api/admin/reset-demo`
- `GET /api/admin/test-accounts`
- `GET /api/admin/stats`
- `GET /api/admin/clinics`
- `POST /api/admin/clinics`
- `PUT /api/admin/clinics/:id`
- `DELETE /api/admin/clinics/:id`
- `PATCH /api/admin/clinics/:id/toggle`
- `PATCH /api/admin/clinics/:id/plan`
- `PATCH /api/admin/clinics/:id/extend`
- `PATCH /api/admin/users/:id/password`
- `GET /api/admin/support`
- `POST /api/admin/support`
- `DELETE /api/admin/support/:id`
- `POST /api/crm/treatment-plans/:id/approve`
- `POST /api/crm/plan-releases/:releaseId/publish`
- `POST /api/crm/plan-releases/:releaseId/withdraw`
- `POST /api/crm/plan-releases/:releaseId/presentation/generate`
- `GET /api/crm/plan-releases/:releaseId/presentation`
- `PATCH /api/crm/presentations/:id/beats/:beatId`
- `POST /api/crm/presentations/:id/publish`
- `GET /api/crm/presentation-funnel`
- `GET /api/crm/treatment-plans/:id/releases`
- `PATCH /api/crm/treatment-plans/:id/stages/:stageId`
- `GET /api/crm/waiting-list`
- `POST /api/crm/waiting-list`
- `GET /api/crm/price-list`
- `POST /api/crm/price-list`
- `GET /api/crm/bookings`
- `POST /api/crm/bookings`
- `POST /api/crm/bookings/:id/confirm`
- `GET /api/crm/reminders/sent`
- `POST /api/crm/reminders/sent`
- `POST /api/crm/reminders/run`
- `POST /api/crm/reminders/cron`
- `GET /api/crm/chairs`
- `POST /api/crm/chairs`
- `GET /api/community/posts`
- `POST /api/community/posts`
- `POST /api/community/posts/:id/like`
- `POST /api/community/posts/:id/save`
- `GET /api/community/posts/:id/comments`
- `POST /api/community/posts/:id/comments`
- `GET /api/community/people`
- `GET /api/community/dm/unread-count`
- `GET /api/community/dm`
- `POST /api/community/dm/open`
- `GET /api/community/dm/:id/messages`
- `POST /api/community/dm/:id/messages`
- `GET /api/public/clinic/:clinicId`
- `GET /api/public/clinic/:clinicId/slots`
- `POST /api/public/booking`
- `GET /api/public/document/:token`
- `POST /api/public/document/:token/sign`
- `GET /api/public/privacy`
- `GET /api/public/terms`
- `POST /api/profile/skills`
- `DELETE /api/profile/skills/:id`
- `POST /api/profile/certificates`
- `DELETE /api/profile/certificates/:id`
- `POST /api/profile/achievements`
- `DELETE /api/profile/achievements/:id`
- `POST /api/profile/portfolio`
- `DELETE /api/profile/portfolio/:id`
- `POST /api/profile/cases`
- `DELETE /api/profile/cases/:id`
- `GET /api/jobs/me/applications`
- `POST /api/jobs/:id/apply`
- `GET /api/ops/suppliers`
- `GET /api/ops/suppliers/:id`
- `POST /api/ops/suppliers/:id/status`
- `POST /api/ops/suppliers/:id/members`
- `GET /api/ops/overview`
- `GET /api/ops/clinics`
- `POST /api/ops/clinics/:id/plan`
- `POST /api/ops/clinics/:id/extend`
- `POST /api/ops/clinics/:id/suspend`
- `POST /api/ops/clinics/:id/activate`
- `GET /api/ops/school`
- `POST /api/ops/lecturers/:id/level`
- `POST /api/ops/automations/advance-supplier-reviews`
- `POST /api/ops/automations/verify-new-lecturers`
- `POST /api/ops/automations/extend-expiring-clinics`
- `GET /api/bi/dashboard`
- `GET /api/bi/mrr`
- `GET /api/bi/churn`
- `GET /api/bi/ltv`
- `GET /api/bi/cac`
- `GET /api/bi/unit-economics`
- `GET /api/bi/cashflow`
- `GET /api/bi/scenarios`
- `GET /api/bi/partner-roi`
- `GET /api/bi/network`
- `GET /api/bi/clinic`
- `GET /api/bi/clinic/:clinicId`
- `GET /api/bi/saas-metrics/history`
- `GET /api/bi/customer-metrics/:clinicId/history`
- `GET /api/bi/snapshots`
- `POST /api/bi/cfo/chat`
- `POST /api/diagnostics/register`
- `GET /api/diagnostics/centers`
- `GET /api/diagnostics/centers/:id`
- `POST /api/diagnostics/centers`
- `PATCH /api/diagnostics/centers/:id`
- `GET /api/diagnostics/laboratories`
- `GET /api/diagnostics/laboratories/:id`
- `POST /api/diagnostics/laboratories`
- `PATCH /api/diagnostics/laboratories/:id`
- `GET /api/diagnostics/registrations`
- `POST /api/diagnostics/registrations/:id/approve`
- `POST /api/diagnostics/registrations/:id/reject`
- `POST /api/diagnostics/seed-test-data`
- `GET /api/diagnostics/studies`
- `GET /api/diagnostics/lab-tests`
- `POST /api/diagnostics/referrals/:id/status`
- `POST /api/diagnostics/files/upload`
- `DELETE /api/diagnostics/files/:id`
- `POST /api/diagnostics/results/ai-generate`
- `POST /api/diagnostics/referrals/:id/comments`
- `GET /api/diagnostics/dashboard`
- `GET /api/diagnostics/centers/:id/pricing`
- `PATCH /api/diagnostics/centers/:id/pricing`
- `POST /api/diagnostics/centers/:id/pricing`
- `GET /api/diagnostics/laboratories/:id/pricing`
- `PATCH /api/diagnostics/laboratories/:id/pricing`
- `GET /api/diagnostics/centers/:id/payments`
- `GET /api/diagnostics/laboratories/:id/payments`
- `GET /api/diagnostics/commission-rules`
- `POST /api/diagnostics/commission-rules`
- `GET /api/diagnostics/platform/commissions`
- `POST /api/diagnostics/platform/settlements/generate`
- `GET /api/diagnostics/platform/settlements`
- `GET /api/diagnostics/settlements`
- `POST /api/diagnostics/settlements/:id/pay`
- `GET /api/diagnostics/stats`
- `POST /api/diagnostics/referrals/:id/mark-paid`
- `POST /api/diagnostics/centers/:id/cashier/collect`
- `POST /api/diagnostics/laboratories/:id/pricing`
- `POST /api/diagnostics/laboratories/:id/cashier/collect`
- `GET /api/diagnostics/laboratories/:id/dashboard`
- `GET /api/diagnostics/centers/:id/study-price`
- `GET /api/diagnostics/centers/:id/subscription`
- `POST /api/diagnostics/centers/:id/subscription/activate`
- `GET /api/diagnostics/centers/:id/dashboard`
- `GET /api/finance/wallets`
- `GET /api/finance/wallets/:ownerType/:ownerId`
- `GET /api/finance/transactions`
- `GET /api/finance/ledger/health`
- `GET /api/finance/commission-rules`
- `POST /api/finance/commission-rules`
- `POST /api/finance/sales`
- `POST /api/finance/transactions/manual`
- `POST /api/disputes/:id/status`
- `POST /api/ai-governance/review`
- `GET /api/ai-governance/supplier/:id/suggest`
- `POST /api/ai-governance/course/outline`
- `GET /api/meta/connect`
- `GET /api/meta/callback`
- `DELETE /api/meta/disconnect/:channel`
- `GET /api/meta/status`
- `POST /api/meta/refresh`
- `GET /api/organizations/:id`
- `PATCH /api/organizations/:id`
- `DELETE /api/organizations/:id`
- `GET /api/persons/:id`
- `PATCH /api/persons/:id`
- `DELETE /api/persons/:id`
- `GET /api/patient-portal/ai/status`
- `POST /api/patient-portal/ai/consent`
- `GET /api/patient-portal/ai/history`
- `POST /api/patient-portal/ai/chat`
- `GET /api/patient-portal/presentation`
- `GET /api/patient-portal/presentation/:releaseId`
- `GET /api/patient-portal/presentation/:releaseId/voice`
- `POST /api/patient-portal/presentation/:releaseId/track`
- `GET /api/patient-portal/conversation`
- `POST /api/patient-portal/conversation/message`
- `POST /api/patient-portal/conversation/ticket`
- `GET /api/patient-portal/conversation/stream`
- `GET /api/patient-portal/me`
- `GET /api/patient-portal/appointments`
- `GET /api/patient-portal/treatments`
- `GET /api/patient-portal/treatment-plans`
- `GET /api/patient-portal/visits`
- `GET /api/patient-portal/invoices`
- `GET /api/patient-portal/documents`
- `GET /api/patient-portal/documents/:id/content`
- `GET /api/patient-portal/diagnostics`
- `PUT /api/patient-portal/me/profile`
- `GET /api/patient-portal/clinics`
- `POST /api/patient-portal/link`
- `POST /api/patient-portal/appointments/:id/cancel`
- `GET /api/patient-portal/available-slots`
- `POST /api/patient-portal/appointments/request`
- `GET /api/patient-portal/access-requests`
- `POST /api/patient-portal/access-requests/:grantId/approve`
- `POST /api/patient-portal/access-requests/:grantId/decline`
- `GET /api/patient-portal/access-grants`
- `POST /api/patient-portal/access-grants/:grantId/revoke`
- `GET /api/patient-portal/access-log`
- `POST /api/cross-clinic/request`
- `GET /api/cross-clinic/status/:receivingPatientId`
- `GET /api/cross-clinic/history/:receivingPatientId`
- `GET /api/patient-inbox/conversations`
- `GET /api/patient-inbox/conversations/:id`
- `POST /api/patient-inbox/conversations/:id/claim`
- `POST /api/patient-inbox/conversations/:id/reply`
- `POST /api/patient-inbox/conversations/:id/resolve`
- `POST /api/patient-inbox/ticket`
- `GET /api/patient-inbox/stream`
- `GET /api/patient-inbox/escalations`
- `POST /api/patient-inbox/escalations/:id/resolve`
- `GET /api/developer/apps`
- `GET /api/developer/apps/:id`
- `POST /api/developer/apps`
- `POST /api/developer/apps/:id/keys`
- `POST /api/developer/webhooks`
- `GET /api/developer/webhooks/:id/deliveries`
- `GET /api/v1/ping`
- `GET /api/partners/tiers`
- `POST /api/partners/tiers`
- `GET /api/partners/:id`
- `POST /api/partners/:id/tier`
- `POST /api/partners/:id/kpis`
- `POST /api/partners/:id/slas`
- `POST /api/partners/:id/campaigns`
- `PATCH /api/workflows/:id`
- `POST /api/workflows/:id/run`
- `GET /api/workflows/:id/runs`
- `GET /api/data/metrics`
- `POST /api/data/metrics`
- `GET /api/data/metrics/:key/value`
- `GET /api/data/dashboards`
- `POST /api/data/dashboards`

</details>
