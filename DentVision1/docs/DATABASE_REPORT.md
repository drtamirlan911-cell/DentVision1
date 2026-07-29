# DentVision V2 — Database Report

**Date:** 2026-07-17

---

## SCHEMA COMPARISON

| Property | Legacy (server/) | New (dentvision-backend/) |
|---|---|---|
| **Models** | 47 | 27 |
| **Enums** | 0 (strings) | 5 |
| **Column mapping** | Extensive @map("snake_case") | None |
| **Decimal precision** | @db.Decimal(10,2) | Float (unsafe for money) |
| **Indexes** | 1 | 14 models |
| **FK cascades** | None specified | Most use onDelete: Cascade |
| **Unique constraints** | 3 | 6 |
| **Soft deletes** | 0 | 0 |
| **Multi-tenancy (clinicId)** | Nearly all models | ~10 models |

---

## NEW SCHEMA ISSUES

### CRITICAL: All IDs Use @default("")
Every model uses `@default("")` instead of `@default(uuid())`. No database-level ID protection. If app code forgets to supply an ID, the record gets an empty string.

### HIGH: 20 Models Lost (43%)

**Missing from CRM:**
- Treatment (individual records per appointment)
- MedicalCard (structured medical history)
- Booking (online appointment requests)
- WaitingList, Debt, Referral, Promotion, Expense, Subscription

**Missing from Shop:**
- ShopCategory, ShopSupplier, ShopOrderItem, ShopReview

**Missing from School:**
- SchoolModule, SchoolCertificate, SchoolClinicalCase, SchoolLibrary

**Missing from User:**
- Invitation, PasswordReset, UserSkill, UserCertificate, UserAchievement, UserPortfolioItem, UserCase, UserReview, UserActivity, ServiceAccess

### HIGH: No Soft Deletes
Zero models have `deletedAt`. All deletions are permanent. Clinical and financial data cannot be recovered.

### HIGH: Inconsistent Multi-Tenancy
Models lacking `clinicId` that need it:
- Visit, Tooth, TreatmentPlan, PatientImage
- Document (has field but no FK relation)
- AISession, AIMemory (have field but no FK relation)

### MEDIUM: Missing FK Relations
- AISession.clinicId → no @relation to Clinic
- AIMemory.clinicId/userId → no @relation
- Document.clinicId → no @relation
- AuditLog.clinicId/userId → plain strings, no FK
- AIMessage.sessionId → no @relation to AISession
- Appointment.doctorId → no @relation to User

### MEDIUM: Float Instead of Decimal
Financial fields (Invoice.amount, Order.total, Product.price) use Float. This causes rounding errors in accounting.

---

## N+1 QUERY RISKS

| Model | Outbound Relations | Risk |
|---|---|---|
| Patient | 7 (Clinic, Visit, Appointment, Tooth, TreatmentPlan, PatientImage, Document) | CRITICAL |
| User | 7 (memberships, aiSessions, notifications, aiActions, aiAlerts, orders, enrollments) | HIGH |
| Clinic | 7 (members, patients, appointments, labOrders, invoices, inventory, orders) | HIGH |
| Course | 2 (lessons, enrollments) | MEDIUM |

---

## MIGRATION STATUS

**No migrations exist.** Database was created via `prisma db push`. No version history, no rollback capability.

---

## RECOMMENDATIONS

1. Replace `@default("")` with `@default(uuid())` on all models
2. Add `deletedAt DateTime?` on Patient, Appointment, Invoice, Order, Visit, TreatmentPlan, User
3. Add `clinicId` to Visit, Tooth, TreatmentPlan, PatientImage
4. Add FK relations for all orphaned fields
5. Restore Treatment model (individual records per appointment)
6. Restore MedicalCard as structured model (not Json blob)
7. Restore Shop infrastructure (categories, suppliers, order items)
8. Restore ServiceAccess for SaaS gating
9. Run `prisma migrate dev` to create initial migration
10. Use `Decimal(10,2)` instead of Float for all financial fields
