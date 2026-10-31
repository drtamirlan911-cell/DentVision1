# Master Spec 5.0 — compliance audit

**Audit date:** 2026-10-31  
**Repository:** drtamirlan911-cell/DentVision1  
**Audited branch:** fix/d1-d10-trial-archive-signing-api-20261029  
**Audited baseline HEAD:** 1284de604b638937ee2939f3f198f8674a5fa6d4 (follow-up source baseline: PR HEAD 63469c181d68c9320ea0f7eec761be856b7cf834)  
**PR:** #330 — OPEN / DRAFT  
**Base / main:** ac913cc3389a294d0b135a852b035ddddb1018ca  
**Normative specification:** docs/DENTVISION_MASTER_SPEC.md, Version 5.0, 2026-09-17

## Executive finding

**DentVision does not yet meet all requirements in Master Spec 5.0.** The repository contains substantial implementation: unified organization/IAM foundations, clinic workflows, diagnostic and laboratory modules, supplier operations, Shop, Academy, Jobs, Community, Finance, AI sessions/tools, Android screens and a broad automated test suite. However, source existence and route reachability are not equivalent to complete cabinets or cross-organization business workflows.

At this HEAD, **18 of 24 sections are PARTIAL, 4 are OPEN against their acceptance criteria, and 2 are GUIDANCE sections rather than implementation gates. No section is certified as completely compliant end-to-end.** This is a compliance classification, not a percentage of code completed.

Main reasons:
- several participant workflows are only partially verified, especially the independent dental-laboratory owner workflow and employer/job lifecycle;
- canonical target routes often redirect to older/shared screens, and some public resource routes do not provide the resource-specific destination described by the spec;
- the baseline test suite explicitly recorded missing Shop buyer cancellation (404); a restricted cash-on-delivery cancellation has since been added on the follow-up branch, but remains pending exact-head verification and does not cover provider-backed online refunds;
- financial lifecycle and medical-analysis settlement evidence remains open;
- PHI encryption/backfill and AI transcript handling are not fully closed;
- a real WebGL/3D 32-tooth odontogram is still listed as unfinished;
- staging/production checks and the full release-gate sequence are not complete.

## Audit method and evidence boundary

Reviewed:
- docs/DENTVISION_MASTER_SPEC.md sections 1–24;
- docs/00_CONSTITUTION/02_PRODUCT_DNA.md;
- DENTVISION_OPERATING_DIRECTIVE.md;
- DENTVISION_EXECUTION_PLAN.md, DENTVISION_CONTEXT.md, DENTVISION_EXECUTION_LOG.md;
- docs/RELEASE_BLOCKERS.md, docs/SYSTEM_MAP.md, docs/business/DENTVISION_PARTNER_ECONOMICS.md, docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md;
- frontend route declarations, layouts, workspace switcher, IAM hooks and representative cabinet screens;
- backend router mounts, IAM/context and organization services, patient/appointment/lab/diagnostics/Shop/supplier/Academy/Finance/AI implementations and Prisma schema;
- E2E coverage for clinical core, patient, tenant isolation, RBAC, organization owner lifecycle, business-owner journeys, partner lifecycle, lab orders, diagnosis, Marketplace and Academy;
- current generated route/role/test inventories and current-head GitHub Actions status.

The repository tree contained 1,945 entries at the audited tree. This was a source-and-test audit, not a staging or production penetration test. No staging/production database, PHI backfill, production environment, payment-provider account, branch-rule settings or Android device was accessed or changed. Claims requiring those environments remain open.

### Status definitions

- **PARTIAL** — code or UI exists, but at least one required workflow, participant, negative test or current runtime proof is missing.
- **OPEN** — the section's acceptance criteria or required release evidence are not met.
- **GUIDANCE** — normative principle/benchmark guidance; not a standalone feature that can be marked shipped.
- A route, model, page or unit test alone is never treated as proof that a cabinet is complete.

## Section-by-section compliance matrix

| # | Master Spec section | Status | Audit result and concrete evidence/gaps |
|---:|---|---|---|
| 1 | North Star | **PARTIAL** | Product is no longer clinic-only at the architecture level: Organization/Person/IAM, diagnostics, laboratories, supplier, Academy, Shop, Jobs, Community, Finance and AI modules exist. First-class business parity is not proven for every participant. Independent dental-lab production, employer/job-seeker lifecycle, medical-organization workflows and partner settlement still need complete evidence. |
| 2 | Product experience law | **PARTIAL** | Welcome gives visitors task/role entry points; authenticated visitors are redirected to /ai. IntelligenceLayout, WorkspaceSwitcher, WorkspaceWorkflowBridge and AI query/stream routes provide the intended operating shell. Persistent First Value / Next Best Action loop and consistent contextual queue for every participant are not demonstrated. The operating directive and current-state index still list product-led growth work as open. |
| 3 | Canonical identity, organization and context architecture | **PARTIAL** | Canonical Organization → Person → PersonRole model, orgContext.ts, authContext.ts, IAM context listing and POST /api/iam/switch-context are present. Context switching validates organization-scoped roles and branch ownership; archived organizations are excluded. Full multi-organization role-union and negative tenant/branch/AI matrix is not closed: RB-034 remains OPEN despite its diagnostic workflow passing, and RB-035 remains IN PROGRESS. |
| 4 | Organization onboarding and entry model | **PARTIAL** | Welcome.tsx and Onboarding.tsx implement public intent selection, personal contexts, create/join and invitations. Self-service organization creation exposes six types: clinic, diagnostic center, medical laboratory, dental laboratory, supplier and academy. Personal intents include professional, patient/buyer, jobs, student and employer. Full organization setup/completion checklists and onboarding for every organization type named in §3 (for example medical organization, manufacturer and professional group) are not verified. |
| 5 | Global shell and interface architecture | **PARTIAL** | Desktop shell, sidebar, contextual workspace switcher, command palette, AI/context bridge and responsive bottom navigation exist. Mobile web visual coverage is part of CI. This does not establish all 15 cabinet requirements across desktop/mobile; Android release gate covers unit tests and preview APK assembly, while device install/runtime verification remains listed as open. |
| 6 | Canonical route architecture | **PARTIAL** | src/index.tsx declares many target routes and legacy aliases. Several target paths are redirects rather than resource-specific experiences: /organizations and /organizations/:organizationId redirect to /settings; /professionals/:professionalId redirects to /profile; /services/:serviceId redirects to /shop. Medical/dental-lab subroutes frequently collapse to a shared workspace or older CRM destination. docs/SYSTEM_MAP.md reports 98 backend route handlers without a detected web/mobile consumer. These may include intentional service/webhook endpoints, but each needs an owner/contract or explicit exclusion; route existence alone does not prove functional parity. |
| 7 | Cabinet specifications by participant | **PARTIAL** | Fourteen role labels are present in .dentvision/roles.json; role-design E2E includes clinic, patient, diagnostic, medical-lab, dental-lab, platform and support roles. E2E covers business-owner onboarding/staff/branch actions, diagnostic and medical-lab partner lifecycles, Academy course enrollment, Marketplace orders and clinical flows. A full independent dental-lab owner chain (case intake → production routing → technician workbench → QC/remake → delivery → invoice/settlement) is not demonstrated. A dedicated end-to-end employer/job-seeker lifecycle is also not present in the inspected E2E suite. |
| 8 | Organization management | **PARTIAL** | Organization profile, branches, membership/roles, invitations, legal/verification, archive/restore and supplier/lecturer controls exist. The full cross-organization Control Center from §8 is not proven: departments, rooms/workstations, modality/equipment capacity, holidays, integration lifecycle, SLA/escalation rules and exception governance need workflow-level verification for each supported organization type. |
| 9 | Workflow-first interface rule | **PARTIAL** | Clinic schedule/queue, diagnostics referrals/worklists, medical-lab lifecycle and supplier order state machine have real domain endpoints. Dental lab status transitions and production event persistence exist in clinic lab-order code, but this is not equivalent to a fully verified independent dental-lab cabinet. Baseline commit 1284de6 recorded SHOP-013 as a missing buyer cancellation (404). The follow-up adds a buyer-owned, pending cash-on-delivery cancellation with stock restoration; exact-head E2E is still required, and provider-backed online void/refund remains absent. |
| 10 | Domain-specific benchmark principles | **GUIDANCE** | The spec documents maturity expectations for dental practice, dental lab, diagnostics/radiology and medical lab. These are design/operational standards, not a standalone shipped module. The actual gap is assessed under cabinet, lab and workflow sections above. |
| 11 | Cross-organization ecosystem workflows | **PARTIAL** | e2e/tests/partner-lifecycle.spec.ts tests diagnostic referral → accept/process/result → clinic visibility and medical-lab order → lifecycle/result/delivery. Academy has course enrollment/progress/completion tests; Marketplace has order creation/price validation. Dental-lab partner-owned case handoff and complete commercial settlement, supplier fulfillment-to-payout and all consent/provenance steps are not proven as complete cross-org flows. |
| 12 | Clinical graph and diagnostics | **PARTIAL** | Patient, visit/diagnosis, treatment case, appointment, treatment plan, lab order, document, payment and patient-presentation code exists. e2e/tests/clinical-core.spec.ts covers patient → treatment case → appointment → close → patient summary. Full imaging/DICOM acquisition/viewer/report/signing, AI finding confirmation and the full outcome loop are not evidenced end-to-end. The real 32-tooth WebGL/3D odontogram is explicitly still open; current Odontogram3D.tsx is an SVG-based chart, not a 3D WebGL scene. |
| 13 | Laboratory domain contracts | **PARTIAL** | Medical-lab order/result lifecycle has partner E2E coverage. Clinic-side dental lab orders support status transitions, remake/delay metadata and durable dental-lab order events; e2e/tests/lab-order.spec.ts tests these clinic-facing routes. The separate dental-lab owner's complete production/QC/delivery lifecycle, technician assignment and full medical-lab specimen chain-of-custody/QC evidence are not yet established. |
| 14 | Finance and economics by organization type | **PARTIAL** | Canonical partner economics policy v1.2 specifies settlement-first commission snapshots, fees/caps/tiers and transparent partner net. Finance routes include partner-economics dashboard/reconciliation/transparency, ledger health, payouts and settlement-related jobs. The current-state record still lists accepted-paid-settled economics and medical-analysis settlement as open. The official Kaspi merchant contract/callback and production payment verification are also open (RB-019 and related blockers). |
| 15 | AI operating layer | **PARTIAL** | AI query/stream, active context builder, workspace-scoped durable sessions/threads, tool execution, action permission checks and approval surfaces are present. The implementation has a substantial AI foundation, but the spec requires contextual AI across every participant cabinet, permission-safe recommendations/actions and durable context. The full per-cabinet agent/workflow matrix is not demonstrated; AI transcript persistence (AIMessage.content / AISession.messages) is a distinct unresolved PHI surface in RB-029. |
| 16 | Global navigation rules | **PARTIAL** | Server IAM resolution and guarded routes are present; role/context gate checks many routes. Current generated map identifies unmatched backend routes, while source declares aliases to shared destinations. Dead-link, action-handler, deep-link, post-context-switch and mobile/desktop parity evidence remains incomplete under RB-002–005, RB-025 and D10. |
| 17 | Security, privacy and minimum necessary access | **PARTIAL** | Organization/branch/assignment scoping, explicit permissions, cross-clinic controls, consent workflows, IIN hashing/encryption and structured medical-history envelope support exist. Critical acceptance remains open: RB-029 PHI consumer audit/backfill and AI transcripts, RB-030 offline queue E2E, RB-031 WebKit request/CORS lifecycle, RB-033 branch protection and RB-035 full patient API/RBAC matrix. Production CORS/WebSocket/environment proof is absent. |
| 18 | Quality law | **PARTIAL** | Shared design system, lint/type/build/unit checks, role/UX/mobile E2E and visual evidence gates exist. On audited HEAD, frontend lint, backend lint, build/type/unit step, Quality Gate and RB-034 diagnostic passed; visual/role/owner release gates were not all complete. RB-002–004 and RB-007 remain open for named controls, touch targets and full visual evidence. Android runtime is separate and remains unverified. |
| 19 | Release gates for organization/cabinet model | **OPEN** | Exact-head release sequence is incomplete. CI run 41183045451 remains IN PROGRESS: core E2E, Browser UX and Mobile Design steps passed; Role/Context was in progress and Visual Agent, Business Owner, Organization Owner, Playwright CLI and final evidence steps were still pending. Quality Gate 41183045517 passed; RB-034 diagnostic 41183045421 passed. Those two passes do not close the full release gate. |
| 20 | P0/P1/P2 execution plan | **OPEN** | Several phases are implemented, but P0 context/security, P1 full participant vertical slices, P2 cross-org settlement, P3 AI coverage and P4 UX/Android/WebGL are not all complete. Execution plan contains 45 unchecked checklist items across active and historical matrices; this count includes repeated historical worklists and must not be used as a readiness percentage. |
| 21 | Definition of Done for a cabinet | **OPEN** | No evidence currently certifies every cabinet through the full required chain: entry → context → permission → home → queue → entity → workflow → persistence → notification → finance/outcome → audit → mobile → E2E. Diagnostic and medical-lab journeys are further along; dental-lab, supplier, employer/jobs, patient/buyer and all role combinations need complete vertical proof. |
| 22 | Documentation and implementation control | **PARTIAL** | Canonical Master Spec, Product DNA, Execution Plan, Context, Log, economics and generated System Map exist; work is recorded in current PR branch. Machine-readable .dentvision/current-state.json is marked generated:false and releaseStatus: UNVERIFIED; its lastVerifiedMergeCommit does not match this PR's current base. Reconcile the snapshot through the intended index/update process rather than treating it as release evidence. Role inventory (14 labels) and System Map permission-role count (11) also need a documented mapping. |
| 23 | Competitive benchmark principle | **GUIDANCE** | Comparison axes and domain benchmark principles are documented. This section does not itself constitute an implementation gate; benchmark-to-workflow gap evidence belongs under §§7, 9, 10, 13 and 14. |
| 24 | Final product invariant | **OPEN** | Single-ecosystem foundation exists, but the invariant is not yet achieved across all first-class centers of work: some partner routes are aliases, dental-lab owner lifecycle is not proven end-to-end, economics/settlement is incomplete and cross-organization security/PHI release matrix remains open. |

## Confirmed implementation evidence

- Canonical organization and person/role context foundations: dentvision-backend/src/lib/orgContext.ts, dentvision-backend/src/lib/authContext.ts, dentvision-backend/src/modules/iam/iam.routes.ts.
- Organization onboarding, profile, legal verification, branch, archive and restore flows: src/pages/Onboarding.tsx, src/components/WorkspaceSwitcher.tsx, dentvision-backend/src/modules/organizations/organizations.routes.ts.
- Clinic clinical workflow: e2e/tests/clinical-core.spec.ts, e2e/tests/patient-workflow.spec.ts, e2e/tests/appointment.spec.ts.
- Tenant/RBAC tests: e2e/tests/tenant-isolation.spec.ts, e2e/tests/rbac.spec.ts, e2e/tests/money-medical-negative.spec.ts.
- Diagnostic and medical-lab partner flows: e2e/tests/partner-lifecycle.spec.ts.
- Laboratory order state-machine tests: e2e/tests/lab-order.spec.ts.
- Marketplace order creation/pricing and Academy enrollment/progress: e2e/tests/marketplace.spec.ts, e2e/tests/academy.spec.ts.
- AI session/context/tool foundation: dentvision-backend/src/modules/ai/ai.routes.ts, dentvision-backend/src/modules/ai/os/context.ts, dentvision-backend/src/modules/ai/os/tools.ts.
- Finance/partner-economics routes and scheduled reconciliation: dentvision-backend/src/modules/finance/finance.routes.ts, dentvision-backend/src/jobs/partnerEconomicsReconciliationCron.ts, docs/business/DENTVISION_PARTNER_ECONOMICS.md.

## Confirmed gaps that must not be hidden by route or screen counts

1. **Shop order cancellation:** SHOP-013 currently asserts HTTP 404 for the absent user-facing cancel endpoint.
2. **Dental laboratory cabinet:** clinic-side lab orders and status transitions exist; complete partner-owned production/QC/remake/delivery and settlement E2E is not evidenced.
3. **Public participant profiles:** organization/professional target routes currently redirect to generic settings/profile destinations instead of proving resource-specific public profiles.
4. **Finance lifecycle:** accepted → paid → settled and medical-analysis settlement remain open in the repository current-state record.
5. **Odontogram:** current SVG chart is not the required real 32-tooth WebGL/3D model. current-state index lists this as open; frontend package has no Three.js / React Three Fiber / Babylon dependency.
6. **PHI:** Patient medical-history encryption support is present, but staging/production backfill and AI transcript PHI storage/retention design remain open.
7. **Android:** native screens and build workflow exist; preview APK build/unit gate is not equivalent to device install/runtime validation.
8. **Release gates:** full Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and final evidence sequence has not yet passed on this exact HEAD.

## Generated inventory observations

docs/SYSTEM_MAP.md reports 69 mounted routers, 691 unique route handlers, 653 registered HTTP routes, 98 route handlers without a detected web/mobile consumer, 150 Prisma models, 12 background jobs and 11 permission roles. .dentvision/roles.json enumerates 14 role labels, while .dentvision/tests.json inventories 334 test files. Different role and route counts use different extraction scopes; the repository needs an explicit mapping rather than treating these counts as interchangeable. Unmatched API handlers are not automatically defects (webhooks/internal APIs may be intentionally headless), but each needs an owner, consumer contract or documented exclusion.

## Release decision

**Release status: NOT READY. Keep PR #330 Draft. Do not merge to main.**

Quality Gate and RB-034 diagnostic passed on audited HEAD, but full CI/E2E sequence remains in progress and release blockers D1–D10 / RB-001–005 / RB-007–009 / RB-010–035 still require their respective exact-head, staging, provider, repository-admin or production evidence.

## Next execution order

1. Finish exact-head CI on HEAD 1284de604b638937ee2939f3f198f8674a5fa6d4; inspect Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and visual evidence. Fix failures without weakening or deleting assertions.
2. Complete D10 route-to-workflow matrix; implement or explicitly defer missing route/workflow contracts such as Shop cancellation and public participant profiles.
3. Add a true dental-lab owner E2E lifecycle, supplier order fulfillment/payout E2E and employer/job-seeker lifecycle; include tenant/branch/role negative cases.
4. Complete accepted-paid-settled finance and medical-analysis settlement, reconciling immutable snapshots against canonical economics document.
5. Finish RB-029 all-reader/writer/transcript privacy review, backup/rollback and approved staging dry-run/backfill; keep production PHI operations separately approved.
6. Verify D1/D2/D8 migrations and read-only-after-expiry / archive retention on approved staging.
7. Close RB-030 offline sync and RB-031 WebKit network evidence; verify RB-033 main branch protection with repository-admin access.
8. Complete RB-035 and remaining tenant/branch/permission negative matrix.
9. Implement and verify real 32-tooth WebGL/3D odontogram, Android install/runtime, and product-led First Value / Next Best Action loop.
10. Re-run D10 and all release gates on one exact final HEAD before changing PR #330 from Draft.

This audit changes documentation only. It does not claim staging/production validation, database migration/backfill, provider certification, Android device runtime, deployment or merge to main.


## Follow-up — buyer Shop order cancellation (2026-10-31)

- The baseline audit at commit `1284de604b638937ee2939f3f198f8674a5fa6d4` explicitly found SHOP-013 absent. The follow-up source baseline was PR HEAD `63469c181d68c9320ea0f7eec761be856b7cf834`.
- Added a buyer-owned cancellation route for **pending cash-on-delivery orders only**, before supplier acceptance and before any online-payment intent. Ownership is scoped by order ID and authenticated buyer ID; another buyer receives 404.
- Stock reservation is restored in the same DB transaction as a compare-and-set transition to `cancelled`; repeated calls do not restore stock twice. DentCash spend/earn reversal uses the existing order-refund service; a pending-refund marker allows a retry without another stock restoration.
- Added a visible cancel/retry action to `/shop/orders`, unit tests and SHOP-013 E2E coverage including buyer isolation and stock restoration.
- Payment settlement now claims `pending → paid` with compare-and-set before writing sale rows; supplier status transitions also use compare-and-set, preventing a late callback or competing actor from overwriting a winning cancellation.
- **Not closed yet:** exact-head CI/E2E must pass. Online/Kaspi, payment-processing, unknown-outcome, paid and supplier-accepted cancellations remain blocked until provider-backed void/refund semantics are implemented and verified. Marketplace section remains PARTIAL.


## Follow-up — RB-029 AI transcript/history API boundary (2026-10-31)

The initial compliance matrix remains a baseline assessment, not a claim of current full closure. A current-source review found that transcript encryption already exists in `AIMessage` and the `AISession.messages` mirror; the stale statement that those columns are wholly plaintext is corrected in `docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md`. This follow-up additionally scopes thread enumeration to the active workspace and protects/decrypts the legacy history route. RB-029 remains OPEN pending full Patient-history downstream audit, learned-memory PHI policy, legacy-data backfill, backup/key-rotation and staging/production evidence.
