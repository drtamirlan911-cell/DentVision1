# SYSTEM_MAP — что система содержит на самом деле

> **Сгенерировано** `npm run system-map` из исходников.
> Не редактируйте руками — перезапустите генератор.
> Суждения («это скрытая функция», «это мёртвый код») живут в `SYSTEM_AUDIT.md`;
> здесь только факты, которые можно вывести из кода.

Собрано: 2026-08-20

## Сводка

| Измерение | Значение |
|---|---|
| Смонтированных роутеров | 58 |
| Обработчиков маршрутов | 528 |
| Маршрутов без потребителя на фронте | **77** |
| Роутеров, объявленных но не смонтированных | 5 |
| Prisma-моделей | 138 |
| — без прямых вызовов Prisma-клиента | **13** |
| — только пишутся, никогда не читаются | **9** |
| — только читаются, никогда не пишутся | 4 |
| Ролей в матрице прав | 10 |
| Фоновых задач | 4 |
| Инструментов AI | 64 |

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
| `/api/ai` | aiRouter | 18 | **2** |
| `/api/guest` | guestRouter | 2 | **2** |
| `/api/analytics` | analyticsRouter | 4 | **4** |
| `/api/analytics` | ecosystemRouter | 1 | **1** |
| `/api/compliance` | complianceRouter | 14 | **2** |
| `/api/notifications` | notificationsRouter | 8 | 0 |
| `/api/files` | filesRouter | 8 | **3** |
| `/api/documents` | filesRouter | 8 | **7** |
| `/api/audit` | auditRouter | 2 | 0 |
| `/api/admin` | adminRouter | 18 | **2** |
| `/api/crm` | crmRouter | 8 | 0 |
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
| `/api/bi` | biRouter | 13 | 0 |
| `/api/diagnostics` | diagnosticsRouter | 51 | **7** |
| `/api/legal` | legalRouter | 0 | 0 |
| `/api/partner/legal` | legalPartnerRouter | 0 | 0 |
| `/api/finance` | financeRouter | 8 | **2** |
| `/api/disputes` | disputesRouter | 3 | 0 |
| `/api/ai-admin/webhook` | webhookGatewayRouter | 0 | 0 |
| `/api/ai-governance` | aiGovernanceRouter | 3 | **1** |
| `/api/meta` | metaRouter | 5 | **2** |
| `/api/organizations` | organizationsRouter | 5 | 0 |
| `/api/persons` | personsRouter | 5 | 0 |
| `/api/patient-portal/ai` | aiPatientRouter | 4 | 0 |
| `/api/patient-portal/presentation` | patientPresentationRouter | 3 | 0 |
| `/api/patient-portal/conversation` | patientConversationRouter | 4 | **1** |
| `/api/patient-portal` | patientPortalRouter | 21 | **6** |
| `/api/cross-clinic` | crossClinicRouter | 3 | 0 |
| `/api/patient-inbox` | patientInboxRouter | 7 | 0 |

### Объявлены и импортированы, но не смонтированы

- `dataRouter` — 5 маршрутов недостижимы по HTTP (импортирован в `app.ts`, но нет `app.use`)
- `developerRouter` — 5 маршрутов недостижимы по HTTP (импортирован в `app.ts`, но нет `app.use`)
- `v1Router` — 1 маршрутов недостижимы по HTTP (импортирован в `app.ts`, но нет `app.use`)
- `partnersRouter` — 7 маршрутов недостижимы по HTTP (импортирован в `app.ts`, но нет `app.use`)
- `workflowRouter` — 5 маршрутов недостижимы по HTTP (импортирован в `app.ts`, но нет `app.use`)

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
- `GET /api/diagnostics/platform/commissions` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/platform/settlements/generate` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/platform/settlements` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/settlements/:id/pay` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/centers/:id/study-price` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/diagnostics/centers/:id/subscription` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `POST /api/diagnostics/centers/:id/subscription/activate` — dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts
- `GET /api/finance/wallets/:ownerType/:ownerId` — dentvision-backend/src/modules/finance/finance.routes.ts
- `POST /api/finance/sales` — dentvision-backend/src/modules/finance/finance.routes.ts
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

</details>

## Модели данных

### Нет ни одного прямого вызова Prisma-клиента

**Это не значит «не используется».** Модель, к которой обращаются
только через `include`/`select` родителя, попадёт в этот список: так,
`Permission` и `RolePermission` читаются через `role.permissions` в
`middleware/rbac.ts`. Список — повод посмотреть, а не приговор.

`AIAction`, `AIAlert`, `SpecTemplate`, `BISnapshot`, `FinancialTransaction`, `Revenue`, `PlatformExpense`, `SaaSMetrics`, `CustomerMetrics`, `Operator`, `Radiologist`, `DiagnosticBooking`, `Schedule`

### Пишутся, но никогда не читаются

Данные копятся и никому не показываются — либо незаконченный workflow,
либо запись «на будущее».

| Модель | Записей |
|---|---|
| `SupplierDocument` | 2 |
| `ExpertVerification` | 2 |
| `Payout` | 2 |
| `PartnerKPI` | 1 |
| `PartnerSLA` | 1 |
| `ReferralComment` | 1 |
| `AiAdminEscalation` | 1 |
| `RolePermission` | 2 |
| `PersonRole` | 8 |

### Читаются, но никогда не пишутся из приложения

Заполняются миграцией, сидом или вручную.

`ShopBanner`, `ShopPromotion`, `LedgerEntry`, `ServiceAccess`

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

- `patientConversationOnCall.ts`
- `reminderCron.ts`
- `settlementCron.ts`
- `subscriptionCron.ts`

## Инструменты AI

`addToFavorites`, `addTooth`, `addVisit`, `askClinicStaff`, `assessUrgency`, `book_appointment`, `cancelAppointment`, `cancelMyAppointment`, `composeCeoBrief`, `createAppointment`, `createInvoice`, `createOrder`, `createPatient`, `createTreatmentPlan`, `draftPromoCopy`, `enrollCourse`, `escalate_to_human`, `findCourse`, `generateReport`, `getAvailableSlots`, `getClinicLoadPlan`, `getCourses`, `getDashboardStats`, `getDebtors`, `getDoctorUtilization`, `getEnrollments`, `getFavorites`, `getInventory`, `getInvoices`, `getLabOrders`, `getMedicalCard`, `getMyAppointments`, `getMyAvailableSlots`, `getMyClinicAccess`, `getMyDiagnostics`, `getMyDocuments`, `getMyInvoices`, `getMyTreatmentPlans`, `getMyTreatments`, `getMyVisits`, `getPatient`, `getPatientCard`, `getPatientHistory`, `getPromotions`, `getRecallList`, `getRevenue`, `getSchedule`, `getTreatmentPlan`, `getTreatmentPlans`, `getVisits`, `get_available_slots`, `navigate`, `openImaging`, `recommendProduct`, `recordPayment`, `requestAppointment`, `rescheduleAppointment`, `searchCourses`, `searchPatient`, `searchPatients`, `searchProducts`, `updateAppointment`, `updateAppointmentStatus`, `updatePatient`
