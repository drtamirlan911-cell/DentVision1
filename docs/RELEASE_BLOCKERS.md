# DentVision — Release Blockers & Deferred Work Register

> Canonical working register for issues discovered during autonomous audit/release work. Items remain open until verified by tests/evidence.

## Open

### RB-001 — Medical/Dental Laboratory 403 Forbidden
- **Status:** OPEN
- **Priority:** P0
- **Area:** Diagnostics / Laboratory / RBAC
- **Observed:** medical-lab and dental-lab roles produce HTTP 403 on diagnostics-related requests in E2E.
- **Required:** trace exact method/URL, role, organization/laboratory context, authorization middleware, scope resolver and DB membership/tenant scope.
- **Finding (2026-09-21):** unified auth stores `organizationId` as the `Organization.id`, while laboratory/diagnostic scope checks and memberships require the underlying `Laboratory.id` (`Organization.originalId`). The authenticated context did not preserve that original entity ID, causing partner-lab scope checks to compare different identifiers and return 403.
- **Fix applied:** auth now carries `organizationOriginalId`; diagnostics, dental-lab platform, and medical-lab scope resolution use the original entity ID when resolving laboratory access.
- **Remaining:** CI verification is required; the same run also showed 500 responses for medical-lab roles, so those must be traced separately if they persist.
- **Verification:** positive/negative tests for medical-lab owner/technician and dental-lab owner/technician plus cross-lab isolation and CI evidence.

### RB-002 — Visual release gate: unnamed interactive controls
- **Status:** IN PROGRESS
- **Priority:** P0
- **Area:** Accessibility / Visual Release Gate
- **Observed:** prior E2E runs reported unnamed interactive controls, including diagnostics/lab roles.
- **Verification:** rerun after fixes; inspect DOM + screenshot + computed state; check hidden/mobile controls.

### RB-003 — Visual release gate: undersized touch targets
- **Status:** IN PROGRESS
- **Priority:** P0
- **Area:** Responsive / Accessibility
- **Observed:** Patient Portal / Shop and consent-related controls were below the required touch target.
- **Verification:** all critical mobile/tablet widths and interactive states.

### RB-004 — Full visual/design release evidence
- **Status:** OPEN
- **Priority:** P0
- **Area:** Release Gate
- **Required evidence:** screenshots, DOM/accessibility, computed styles, console/network, trace/video, real interactions across critical routes, roles, states and viewports.
- **Rule:** screenshots alone do not close this blocker.

### RB-005 — Browser/role/context regression after current fixes
- **Status:** OPEN
- **Priority:** P0
- **Area:** E2E / RBAC / UX
- **Required:** complete CI rerun after each root-cause fix; verify neighboring scenarios and negative authorization paths.

### RB-007 — Mobile laboratory drawer visual regression
- **Status:** FIXED — pending CI visual recheck
- **Priority:** P0
- **Area:** Responsive navigation / Mobile UX
- **Evidence:** failure artifact contained 24 screenshots across laboratory owner/technician variants. On 390px screenshots the open drawer shared the bottom-navigation z-layer, leaving bottom navigation visible above/through the drawer; the drawer width also left a large uncovered content area; the header rendered duplicate DentVision wordmark text.
- **Fix:** mobile drawer now uses a wider bounded width, z-layer above bottom navigation/backdrop, modal interaction semantics, Escape close and body scroll lock; duplicate header wordmark text removed.
- **Verification:** inspect all 390/412px lab-role screenshots after CI and exercise open/close/Escape/outside-click/touch behavior.

### RB-008 — Academy lecturer without organization scope
- **Status:** PARTIALLY FIXED — production identity remediation remains open
- **Priority:** P1
- **Area:** Identity / Academy / Data integrity
- **Observed:** production unified-schema migration on 2026-09-29 reported one lecturer role without an organization scope and skipped its scoped PersonRole.
- **Runtime evidence:** migration completed successfully, but one lecturer was skipped because no Academy organization scope could be resolved.
- **Implementation hardening:** Academy course CRUD now accepts scoped `academy.manage` and requires an active Academy organization; E2E seeds a real scoped lecturer and rejects cross-Academy mutation.
- **Required:** identify the affected lecturer/academy relationship in production, restore the canonical Academy organization link if the source relationship is valid, then rerun/verify IAM context generation. Do not assign a synthetic tenant.

### RB-009 — Public catalog response vs authenticated catalog policy
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P1
- **Area:** Marketplace / Academy / Content access
- **Observed:** unauthenticated production calls return 200 but filtered catalog arrays (Marketplace data empty; Academy KPI counts populated while public course/event arrays are filtered).
- **Finding:** the canonical content-catalog response guard intentionally filters Marketplace/Academy items according to active authenticated content context.
- **Fix:** audience policy now applies to Academy course, webinar, live, office-course, textbook and commerce-registration routes. PUBLIC/PATIENT contexts cannot expose PROFESSIONAL-only Academy items or register them.
- **Regression:** Academy E2E verifies all four format catalog endpoints omit a PROFESSIONAL-only fixture from the public result set.
- **Verification:** exact-head CI/E2E still required; public 200 alone remains insufficient.

### RB-010 — Clinic payment refund over-authorization
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / RBAC / Payment safety
- **Observed:** `POST /api/payments/:id/refund` treated any authorized clinic member as a sufficient owner for clinic-scoped payments.
- **Risk:** clinical staff with payment visibility, including roles without `billing.manage`, could reach a financial reversal mutation.
- **Fix:** clinic refund access now resolves the user's role in the exact clinic and requires canonical `billing.manage` permission; organization access alone is insufficient.
- **Regression:** payment refund test now checks the route uses the scoped `billing.manage` boundary.
- **Verification:** static exact-file inspection passed; fresh CI/E2E is still required for closure.

### RB-011 — Clinic domain ID used as canonical organization ID in Diagnostics
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Diagnostics / IAM / Tenant scope
- **Observed:** referral authorization passed domain `Clinic.id` directly to `assertOrgAccess`, while canonical IAM uses `Organization.id` and stores the source Clinic.id in `originalId`.
- **Risk:** valid clinic-scoped referral workflows could fail after canonicalization.
- **Fix:** added shared `assertClinicOrgAccess` translation with legacy fallback and switched diagnostics referral authorization paths to it.
- **Regression:** `orgContext.test.ts` covers canonical/legacy mapping; diagnostics contract test locks the referral boundary.
- **Verification:** static inspection passed; fresh exact-head CI/E2E remains required.

### RB-012 — SaaS subscription payment can target an arbitrary clinic
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Subscription / IDOR
- **Observed:** generic payment creation accepted `refType=subscription`, arbitrary clinic `refId`, client `saasPlan` and `months` without scoped clinic billing authorization or exact tariff reconciliation.
- **Risk:** a crafted payment could be settled against another clinic and activate its SaaS subscription.
- **Fix:** subscription payment creation now requires `assertClinicBillingAccess` for the target clinic, accepts only paid catalog plans, validates integer months 1–24, and requires exact server-derived tariff total. Settlement repeats the tariff/amount invariant.
- **Regression:** payment settlement tests cover tampered subscription amount; source contract covers creation-time billing and tariff guards.
- **Verification:** fresh exact-head CI/E2E required before closure.

### RB-013 — Clinic-cash payment creation lacks financial permission and ref scope
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Payments / RBAC / Tenant integrity
- **Observed:** clinic-cash payment creation used clinic membership as sufficient authorization and accepted client-supplied appointment/invoice refs without proving they belonged to the selected clinic.
- **Risk:** ordinary clinical members could initiate money-state changes; a finance user could bind a payment to a cross-clinic appointment/invoice.
- **Fix:** clinic cash requires scoped `billing.manage`; appointment refs must belong to the active clinic; invoice refs must belong to the active clinic and the payment cannot exceed the outstanding invoice balance.
- **Regression:** payment route contract locks the billing guard and clinic/ref/amount checks.
- **Verification:** fresh exact-head CI/E2E remains required.

### RB-014 — Lecturer context token uses non-canonical organization type
- **Status:** FIXED — pending exact-head CI/E2E verification
- **Priority:** P1
- **Area:** Identity / Workspace Context / Academy
- **Observed:** `POST /api/iam/switch-context` for `scopeType=LECTURER` emitted `organizationType=LECTURER`, while canonical Academy organization context is `ACADEMY`.
- **Risk:** content-policy resolution and frontend workspace logic could classify an explicitly selected lecturer workspace as a different role/context.
- **Fix:** lecturer switch-context now emits the canonical Academy organization type while preserving lecturer scope/identity.
- **Regression:** `ACADEMY-012` switches a real lecturer context and asserts `organizationType=ACADEMY`, canonical `organizationId`, `organizationOriginalId`, and `lecturerId`.
- **Verification:** local backend TypeScript passes; exact-head E2E required before closure.

## Closed

### RB-006 — Vercel build rate limit
- **Status:** CLOSED — production deployment independently verified
- **Priority:** P1
- **Area:** Production deployment
- **Resolution:** current production deployment `dpl_DuniATXLbvea8NA521pCyVyg4p1N` is READY and is built from current `main` commit `5815fa931cc9603b0ec68fb59bf42d48169f24cc`.
- **Verification:** Vercel production deployment state is READY; Render production deployment `dep-daut9p2d2mec73fl53g0` is LIVE from the same commit. The blocker is no longer present on the current release.

## Operating rule
When a new blocker is discovered:
1. Add it here with a stable ID.
2. Keep it open until the root cause is fixed.
3. Record verification scenario/evidence.
4. Move it to Closed only with the fixing commit/run.

This file is the source of truth for deferred release blockers; they must not exist only in chat notes.
