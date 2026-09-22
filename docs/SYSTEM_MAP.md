# DentVision System Map

> Generated from repository state

## Summary

- Mounted routers: **68**
- Unique route handlers: **665**
- Registered HTTP routes after mount: **629**
- Routes without detected web/mobile consumer: **105**
- Prisma models: **148**
- Background jobs: **12**
- Permission roles: **11**

## Canonical request context

```text
Identity -> Active Workspace -> Organization -> Branch -> Role -> Permission -> Data Scope -> AI Context -> AI Session -> Tool -> Audit -> E2E -> Visual Evidence -> Release
```

## Mounted routers

| Prefix | Router | Handlers | No detected consumer |
|---|---|---:|---:|
| /api | compatRouter | 0 | 0 |
| /api/auth | authRouter | 6 | 1 |
| /api/iam | iamRouter | 12 | 1 |
| /api/clinics | clinicsRouter | 10 | 1 |
| /api/patients | patientsRouter | 15 | 4 |
| /api/appointments | appointmentsRouter | 6 | 1 |
| /api/medical | medicalRouter | 15 | 4 |
| /api/billing | billingRouter | 12 | 4 |
| /api/payments | paymentsRouter | 6 | 3 |
| /api/subscriptions | subscriptionsRouter | 2 | 1 |
| /api/clinic-billing | clinicBillingRouter | 5 | 1 |
| /api/inventory | inventoryRouter | 8 | 0 |
| /api/stock-rules | stockRulesRouter | 4 | 0 |
| /api/marketing | marketingRouter | 9 | 0 |
| /api/shop | shopRouter | 37 | 1 |
| /api/suppliers | suppliersRouter | 10 | 3 |
| /api/supplier | supplierWorkspaceRouter | 22 | 0 |
| /api/lecturer | lecturerRouter | 10 | 0 |
| /api/school | schoolRouter | 27 | 0 |
| /api/dentcash | dentcashRouter | 4 | 1 |
| /api/academies | academiesRouter | 5 | 0 |
| /api/lecturers | lecturersRouter | 6 | 2 |
| /api/ai | aiRouter | 22 | 2 |
| /api/guest | guestRouter | 2 | 2 |
| /api/analytics | analyticsRouter | 4 | 4 |
| /api/analytics | ecosystemRouter | 1 | 1 |
| /api/compliance | complianceRouter | 14 | 2 |
| /api/notifications | notificationsRouter | 8 | 0 |
| /api/files | filesRouter | 8 | 3 |
| /api/documents | filesRouter | 8 | 7 |
| /api/audit | auditRouter | 2 | 0 |
| /api/admin | adminRouter | 18 | 2 |
| /api/crm | crmRouter | 13 | 0 |
| /api/crm | crmOpsRouter | 16 | 0 |
| /api/crm | remindersRouter | 7 | 4 |
| /api/crm/cases | treatmentCaseRouter | 7 | 0 |
| /api/crm | chairsRouter | 3 | 0 |
| /api/lab-orders | labRouter | 4 | 1 |
| /api/community | communityRouter | 12 | 0 |
| /api/public | publicRouter | 11 | 6 |
| /api/profile | profileRouter | 13 | 1 |
| /api/jobs | jobsRouter | 5 | 1 |
| /api/ops/suppliers | opsSuppliersRouter | 4 | 0 |
| /api/ops | opsHubRouter | 11 | 0 |
| /api/quality | qualityRouter | 1 | 0 |
| /api/bi | biRouter | 18 | 4 |
| /api/diagnostics | diagnosticsRouter | 28 | 5 |
| /api/legal | legalRouter | 33 | 8 |
| /api/partner/legal | legalPartnerRouter | 0 | 0 |
| /api/finance | financeRouter | 16 | 7 |
| /api/disputes | disputesRouter | 3 | 0 |
| /api/ai-admin/webhook | webhookGatewayRouter | 0 | 0 |
| /api/ai-governance | aiGovernanceRouter | 3 | 1 |
| /api/meta | metaRouter | 5 | 2 |
| /api/organizations | organizationsRouter | 11 | 2 |
| /api/persons | personsRouter | 5 | 0 |
| /api/branches | branchesRouter | 10 | 0 |
| /api/patient-portal/ai | aiPatientRouter | 4 | 0 |
| /api/patient-portal/presentation | patientPresentationRouter | 4 | 0 |
| /api/patient-portal/conversation | patientConversationRouter | 4 | 1 |
| /api/patient-portal | patientPortalRouter | 22 | 6 |
| /api/cross-clinic | crossClinicRouter | 3 | 0 |
| /api/patient-inbox | patientInboxRouter | 9 | 3 |
| /api/developer | developerRouter | 6 | 0 |
| /api/v1 | v1Router | 1 | 1 |
| /api/partners | partnersRouter | 9 | 0 |
| /api/workflows | workflowRouter | 5 | 0 |
| /api/data | dataRouter | 5 | 1 |

### Repeated mounts

- filesRouter — 2 mounts: /api/files, /api/documents

## Background jobs

- aiApprovalSweeper.ts
- aiEmployeeHeartbeat.ts
- biSnapshotCron.ts
- partnerEconomicsReconciliationCron.ts
- patientConversationOnCall.ts
- paymentReconciliation.ts
- payoutReadinessCron.ts
- recallAgent.ts
- reminderCron.ts
- settlementCron.ts
- subscriptionCron.ts
- workflowRetry.ts

> **Generated** `npm run system-map` from source code.
> Do not edit manually — rerun the generator.
> Judgments belong in `SYSTEM_AUDIT.md`; this file contains only facts derivable from code.
