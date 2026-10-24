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
- **Status:** OPEN
- **Priority:** P1
- **Area:** Identity / Academy / Data integrity
- **Observed:** production unified-schema migration on 2026-09-29 reported one lecturer role without an organization scope and skipped its scoped PersonRole.
- **Runtime evidence:** migration completed successfully, but one lecturer was skipped because no Academy organization scope could be resolved.
- **Required:** identify the affected lecturer/academy relationship in production, restore the canonical Academy organization link if the source relationship is valid, then rerun/verify IAM context generation. Do not assign a synthetic tenant.

### RB-009 — Public catalog response vs authenticated catalog policy
- **Status:** OPEN
- **Priority:** P1
- **Area:** Marketplace / Academy / Content access
- **Observed:** unauthenticated production calls return 200 but filtered catalog arrays (Marketplace data empty; Academy KPI counts populated while public course/event arrays are filtered).
- **Finding:** the canonical content-catalog response guard intentionally filters Marketplace/Academy items according to active authenticated content context.
- **Required:** verify authenticated professional/owner contexts expose the expected catalog and that cross-tenant/catalog audience isolation is preserved. This is not closed by the public 200 response.

### RB-029 — Patient clinical history JSON is not encrypted at rest
- **Status:** OPEN — implementation gap confirmed on current `main` by source inspection
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Evidence:** `dentvision-backend/src/lib/phi.ts` encrypts `medicalHistory` only when the value is a string. The current Patient upsert and PATCH paths in `dentvision-backend/src/modules/patients/patients.routes.ts` merge history as a JavaScript object and persist it as `Prisma.InputJsonValue`; serialization reads the object directly. Current-main file SHAs checked: `phi.ts` `da64d8174962a4ee52ac7c45d44f77a8789e8d89`, `patients.routes.ts` `c6f544c8e0a66e45daa0db3d26bdbb32b7a2ba75`.
- **5 Why / root cause:** the data is stored as JSON → the encryption helper handles strings only → canonical write paths persist JSON objects directly → the read/consumer contract assumes a structured object → no compatible envelope, full consumer inventory or safe backfill has been implemented.
- **Risk:** allergies, clinical notes, categories, source metadata and tooth/clinical details may remain readable in database backups/dumps. Phone, email, address and notes also require an explicit threat-model decision.
- **Required next action:** map all Patient write/read paths, filters, reports, AI context and integrations before choosing an encrypted-at-rest representation. Design an audited migration/backfill with dry-run, resumability, progress counts, integrity checks, legacy compatibility and rollback. Do not encrypt the JSON column blindly.
- **Closure criteria:** persisted sensitive values are not plaintext; authorized API responses preserve the structured history; tenant/branch isolation holds; legacy rows remain readable during migration; missing/wrong keys fail closed; migration dry-run and rollback are tested. No production backfill or key rotation is claimed.

### RB-019 — Platform Kaspi API contract and network bounds
- **Status:** OPEN — official provider contract not independently verified
- **Priority:** P1
- **Area:** Payments / External API
- **Evidence:** `docs/KASPI_CLINIC_SETUP.md` currently shows a generic webhook shape for a configured clinic gateway. That sample is an internal adapter contract, not proof that the official Kaspi acquiring API uses the same endpoint, header, signature payload or status semantics.
- **Risk:** a provider mismatch can cause false payment confirmation, replay/race defects, duplicate settlement or production integration failure.
- **Required next action:** verify the provider-issued contract for the actual merchant/gateway; constrain production API base URLs to approved hosts; verify signature canonicalization, amount/currency, timestamp/replay protection, idempotency, status transitions, timeouts and bounded response parsing. Do not label generic HMAC behavior as official Kaspi compatibility without primary contract evidence.
- **Closure criteria:** contract evidence is retained, adapter semantics match it, and positive/negative callback tests pass on the exact target SHA.

### RB-033 — Main branch protection and required release checks are disabled
- **Status:** OPEN — confirmed by GitHub branch metadata
- **Priority:** P0
- **Area:** Release governance / CI enforcement
- **Evidence:** GitHub `GET /repos/drtamirlan911-cell/DentVision1/branches/main` returned `protected: false`, `protection.enabled: false`, `required_status_checks.enforcement_level: off`, and no required contexts. Existing GitHub issue #259 already describes this control gap.
- **Root cause (5 Why):** direct pushes can bypass CI → no branch protection is active → no required-check policy is enforced → repository configuration does not encode the documented release contract → release governance depends on operator discipline rather than a technical control.
- **Risk:** an unverified or insecure commit can reach `main` without mandatory checks; tenant isolation, PHI, payment and visual gates are not enforceable at the repository boundary.
- **Required next action / owner:** repository administrator must enable protection/rules for `main`, require PR-based changes and the stable status checks used by the actual workflows (including `quality`, `lint-test`, `frontend-lint`, `backend-lint`, `e2e`, and the Android build check where applicable). Do not require guessed check names; select the exact names reported by GitHub for the required workflows.
- **Closure criteria:** GitHub reports protection enabled and required checks enforced; a test PR demonstrates a failed required check blocks merge. The current connected read-only GitHub interface cannot apply this settings change, so it remains a manual admin action.

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
