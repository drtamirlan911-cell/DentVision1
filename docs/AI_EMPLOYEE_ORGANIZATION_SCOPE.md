# AI Employee Organization / Branch Scope — design contract

**Status:** architecture decision draft; source audit only. No Organization/Branch task migration is authorized by this document.  
**Canonical product requirement:** `docs/DENTVISION_MASTER_SPEC.md` §§15, 17 and 19.  
**Current implementation baseline:** clinic-scoped AI Employee task ledger, retained as the compatibility path.

## 1. Decision

DentVision must keep one AI Employee task system and one human-approval lifecycle. The existing clinic queue remains readable and operable. New non-clinic tasks must be scoped by the authenticated canonical `Organization`, with an optional verified `Branch`; they must not be inferred from a global user role, an untrusted JWT field, a route parameter or model-generated text.

Do not build a parallel task table for suppliers, diagnostic centers, laboratories, Academy or employers. Do not make `clinic_id` nullable as a stand-alone change. Do not enable a workspace until its event producer, IAM scope, task read/transition, approval, audit and cabinet UI all use the same scope contract.

## 2. Verified source facts

The following are observations from the current repository source, not assumptions about production data:

| Area | Current source contract | Consequence |
|---|---|---|
| Product requirement | Master Spec §15 requires active organization/cabinet context; §17 requires minimum-necessary cross-organization sharing; §19 requires organization/branch-switch and negative-isolation tests. | Workspace and branch scope are release requirements, not optional metadata. |
| Workspace identity | `iam/contexts.ts` defines `ScopeType` and canonical `WorkspaceContext` with `scopeType`, domain `scopeId`, canonical `organizationId`, and optional `branchId`. | Use the real context resolver; do not invent scope from role names. |
| Canonical membership | `Organization → Person → PersonRole` is authoritative for migrated partner workspaces. `PersonRole.scopeType='organization'` and `scopeId=Organization.id`. Legacy membership tables are compatibility sources only where canonical membership is absent. | Every new task read/write must re-resolve membership and scoped role. |
| Branch identity | `Branch.organizationId` links a branch to an organization. `BranchMember` links a `Person` to a branch with an `active` flag. Legacy clinics also have `ClinicMember.branchId`. | Branch access requires a server-side membership resolver; the JWT's `branchId`, `branchIds` and `assignedBranchId` are hints only. |
| AI tool access | `resolveAiToolAccess()` verifies clinic or organization membership and returns role, `clinicId`, `organizationId`, organization type and domain identity. It does not return a verified branch scope. | It cannot, by itself, authorize a branch-bound task queue. |
| Event envelope | `CRMEvent`, `EventContext`, `EventBus.publish()` and `AIEvent` currently require `clinicId`; `AIEvent` has a Clinic relation. | Current durable events are clinic events. Partner read-only AI tools do not create organization task events. |
| Task ledger | `20260910_add_ai_employee_tasks` creates `clinic_id TEXT NOT NULL`; create/list/transition/readback SQL all filter by `clinic_id`. | Current durable queue is a clinic slice only. |
| Task API | `/api/ai/approvals/tasks` and transition currently require a verified `access.clinicId`. | Organization members are denied the durable task queue by design today. |
| Approval model | `AiApproval` already has nullable `clinicId` and `organizationId`. | Storage has an organization field, but that alone does not establish organization approval support. |
| Approval visibility/execution | `activityQuery.ts` resolves a clinic membership from `clinicId`; approval routes use `assertSameClinic()` and pass `approval.clinicId` into the kernel. | Organization-scoped approvals are not yet end-to-end supported by visibility, approve/reject and execution routes. |
| Audit | `AgentActivity` has `clinicId` and `organizationId`; `ActionEvidence` currently has `clinicId` only. | Organization/branch audit evidence needs a consistent scope extension. |

## 3. Canonical task scope

Every new task must carry a server-resolved scope object equivalent to:

```ts
interface AiTaskScope {
  scopeType: ScopeType;
  scopeId: string;             // domain identity from canonical WorkspaceContext
  organizationId: string;      // canonical Organization.id
  branchId: string | null;     // null means explicitly organization-wide
  clinicId: string | null;     // compatibility field for clinic workflows only
  roleKey: string;             // active scoped PersonRole / verified legacy role
  allowedBranchIds: string[];  // resolved from current DB membership, not JWT
  permissions: ReadonlySet<string>;
}
```

Rules:

1. `organizationId` is the tenant boundary for new organization-backed tasks. The domain `scopeId` is retained to distinguish the active workspace identity; it is not a substitute for `organizationId`.
2. `scopeType` must be an actual canonical workspace type from `WorkspaceContext`. Do not introduce a new type for medical vs dental laboratory until the canonical Organization taxonomy explicitly supports it; current source maps both through `LABORATORY` plus organization/role data.
3. `branchId=null` is permitted only for a verified organization-wide task. A branch-bound task must name a branch whose `organizationId` matches the active organization and whose membership is valid for the caller/recipient.
4. Clinic compatibility is explicit: legacy rows remain `CLINIC` scoped and retain their `clinicId`. A clinic that has a canonical Organization link must also resolve that canonical `organizationId`; unresolved legacy clinics remain clinic-only until safely reconciled.
5. Platform/superadmin tasks are not inferred from `organizationId=null`. They require a separately specified platform scope and permission policy before any task producer is enabled.
6. A task cannot be read, transitioned, approved or used as an idempotency collision across a different organization or branch.

## 4. Schema and event-envelope evolution

The migration must be additive and preserve task/event history.

### Task ledger

Extend the existing `ai_employee_tasks` table with:

- `scope_type` — canonical workspace scope;
- `scope_id` — domain workspace identity;
- `organization_id` — canonical tenant identity for migrated/new tasks;
- `branch_id` — nullable only for explicit organization-wide work;
- retain `clinic_id` for legacy clinic compatibility.

Before enabling new writes:

1. Backfill old rows as `scope_type='CLINIC'`, `scope_id=clinic_id`; map `organization_id` only through a verified `Organization(originalType='Clinic', originalId=clinicId)` lookup.
2. Preserve rows without a canonical organization mapping as explicit legacy clinic tasks; never guess a tenant.
3. Add database check constraints for valid scope combinations and indexes for `(organization_id, scope_type, scope_id, branch_id, status, created_at)` and legacy clinic reads.
4. Keep the non-destructive idempotency key introduced in PR #351. Before organization task writes are enabled, include canonical scope type, organization ID, branch ID (or explicit org-wide marker), source event, action and role in the deterministic hash.
5. Do not add cascade-delete behavior from Organization/Branch to the durable task ledger. Task history must survive source entity retention/deletion; current access still revalidates against active membership and scope.

### Durable event queue

Do not publish partner tasks through a fabricated `clinicId`. Evolve the existing event envelope with a discriminated workspace scope and retain a clinic adapter for current producers:

- legacy clinic producers continue to publish clinic events unchanged;
- new organization producers must provide canonical `organizationId`, canonical `scopeType/scopeId`, actor user and optional verified `branchId`;
- `AIEvent` persistence and claim/readback must retain the full scope; new event payloads remain encrypted at rest;
- exactly one tenant scope is required; no implicit clinic fallback, organization guessing or role-only authorization;
- add event types only when their underlying domain workflow exists and can produce an authorized, minimal event.

The current clinic EventBus subscriber must continue to process legacy clinic events during rollout. A partner producer must not emit a clinic-shaped event to gain access to the old queue.

## 5. IAM and branch authorization

Create one reusable server-side task-scope resolver. It must call the canonical workspace/IAM resolver and independently validate branch scope.

- Verify the user still exists, session is active, organization is not archived, Person belongs to that Organization and an organization-scoped PersonRole is active.
- Preserve the verified legacy clinic membership fallback only for clinics not yet canonicalized.
- Resolve branch membership from active `BranchMember` rows joined to the Person in the active organization. For pre-canonical clinic records, support the existing `ClinicMember.branchId` contract without letting a stale legacy row override a canonical Person/PersonRole.
- Verify that each branch belongs to the active Organization and is active.
- Treat `req.user.branchId`, `branchIds`, `assignedBranchId` and request query parameters as selection hints only. They must match a branch independently resolved from DB membership.
- Compute permissions using `resolveUserPermissions(userId, organizationId, effectiveRole)` and the existing permission map. A role label alone never grants task visibility or transition rights.
- Define organization-wide vs assigned-branch visibility from canonical permissions and membership. Do not copy the current clinic-only `patientBranchScope` role sets into partner workspaces as an unreviewed shortcut.
- On every list/get/transition/approve/reject request, resolve the active scope again. Context switching or membership revocation must invalidate access immediately.

## 6. Task lifecycle and approvals

Reuse the current task state machine and `AiApproval` model; do not create a second approval system.

- `GET /api/ai/approvals/tasks` must query by the resolved scope key and verified branch set, not a supplied `clinicId` or `organizationId`.
- A transition must load the task under the exact tenant/branch scope before applying the allowed state transition. A task ID alone is never a lookup authorization.
- Organization approvals must be visible only under the matching active organization. `buildApprovalFilter()` must accept a canonical organization scope, and approve/reject must validate `AiApproval.organizationId` instead of requiring a non-null clinicId.
- The approver's current role and tool permission must be re-resolved at decision time. Keep dual control for high-risk actions; a requester cannot approve their own prohibited high-risk action.
- The approved action must re-enter the existing governance kernel with the exact task/approval scope, then verify the resulting record and persist `AgentActivity` plus `ActionEvidence`.
- New task writes now store no arbitrary `actionPayload`; metadata is restricted to known employee/event fields; result JSON is projected to fixed status/outcome values, a boolean verified flag and bounded aggregate counts; raw error text is replaced with a fixed marker. Create/list/transition/readback also sanitize legacy actionPayload/result/error values before returning them. Historical database content is not rewritten by this candidate and remains subject to separate approved retention/at-rest remediation. Do not copy full domain event payloads into task JSONB.

## 7. Subscriber and employee contracts

- Replace the current clinic-only global `AGENT_ROLES` mapping for new organization events with an explicit event + `scopeType` + canonical role + allowed action matrix.
- Use `employeeContractForRole()` only after the effective scoped role is resolved. Unknown role/scope combinations fail closed.
- Task creation retains source event ID/type and deterministic idempotency; the subscriber stores minimal metadata and does not duplicate patient, specimen, candidate, student or customer content.
- A task is not an executor. Existing domain actions and `runAiAction()` remain the only side-effecting paths; task transitions alone cannot execute finance, clinical or external communication operations.

## 8. Cabinet and mobile integration

Reuse one task domain and render the queue only in supported active workspaces.

- Clinic CRM keeps its existing queue and legacy records.
- Diagnostic center, medical laboratory, dental laboratory, supplier, Academy and employer cabinets get queue views only after their domain event producers and scope contracts are implemented.
- Each view must support loading, empty, denied, failure and stale-context states; after organization/branch switching it must discard old rows and reload under the new scope.
- Use current cabinet navigation/permissions and provide mobile-equivalent task visibility and decision controls.
- Do not show a queue entry that has no real source event or executable/manual workflow behind it.

## 9. Required negative and lifecycle tests

At minimum:

1. One user belongs to two Organizations; active context A cannot read or mutate B tasks/approvals.
2. The same source event/action/role in two Organizations produces distinct idempotency keys.
3. Same event retried in one scope creates at most one task.
4. A branch member cannot read or transition a sibling branch's task.
5. An organization-wide owner can read branch tasks only when the canonical permission policy allows it.
6. Inactive/revoked BranchMember and archived Organization immediately deny access.
7. A branch ID copied into a JWT or URL without current DB membership is denied.
8. A legacy clinic task remains readable and transitionable under the verified clinic scope after the additive migration.
9. A canonicalized clinic task cannot be accessed through a stale ClinicMember fallback.
10. Organization approve/reject uses the same scope and risk policy as task reads and the governance kernel.
11. No task, event, result, error, notification or evidence row leaks data across clinic, organization or branch boundaries.
12. Mobile and desktop cabinet tests cover context switch, queue refresh and approval/transition states.

## 10. Rollout order and non-goals

1. **Contract + tests:** implement the server scope resolver and negative matrix before adding partner task producers.
2. **Additive schema:** add scope fields/constraints/indexes; backfill only in approved staging first; preserve all old task rows.
3. **Dual-read compatibility:** keep clinic reads working while verifying scoped queries against seeded canonical Organization/Branch fixtures.
4. **Organization approvals/audit:** extend approval visibility/execution and ActionEvidence scope before enabling consequential partner tasks.
5. **One domain at a time:** activate real domain event producers and queue UI for a single workspace type, then repeat the same acceptance suite for the next cabinet.
6. **Release evidence:** staging counts, migration rollback, restore proof, tenant/branch E2E, mobile checks and exact-head CI/Quality Gate are required. No production data migration is part of this design draft.

**Explicit non-goals:** no global role bypass; no automatic organization switching; no model-selected tenant; no fake clinicId for partner tasks; no separate partner task/approval tables; no unverified branch scope; no task execution outside the governance kernel.

## 11. Additional task-result privacy boundary (candidate in PR #351)

- The clinic task service now stores no caller-supplied action payload and allowlists task metadata.
- Transition result writes are projected to enumerated status/outcome strings, `verified:boolean`, and bounded aggregate count fields only; arbitrary free text, patient/entity identifiers, transcripts and nested provider responses are discarded.
- Task create/list/transition/readback responses apply the same safe projection to legacy rows; any non-empty stored error is returned only as the fixed failure marker.
- This is output minimization, not a historical database purge, encryption migration or authorization expansion. Organization/Branch queue remains disabled until the scope resolver and negative tests defined above are implemented.
## 12. Current deny-by-default route test

- PR #351 adds route-level tests with a verified `EMPLOYER_OWNER` Organization context. Until the organization-scoped queue exists, both task list and task transition must return 403 and must not call the clinic task service. This is an intentional fail-closed compatibility boundary, not temporary UI hiding.
## 13. User-facing capability statement

- The canonical Jarvis guide now states plainly that the durable AI Employee queue is clinic-only. Partner read-only overviews do not constitute task queue support. Task status changes do not execute domain actions; high-risk execution remains in Approval Center and governance kernel.
- A natural-language retrieval test protects the answer to questions about a shared supplier/laboratory queue. This is product-knowledge accuracy, not implementation of organization task storage.

## 14. PR #351 clinic AI branch-scope candidate — 2026-11-20

This is a clinic-tool hardening slice, not the organization-first task queue rollout described above.

- The governance kernel now re-resolves clinic Organization, PersonRole and active BranchMember membership (or legacy ClinicMember.branchId only for clinics without a canonical Organization) before staff clinic data tools execute. Branch/session claims are selectors only. Missing or ambiguous narrow scope and unknown roles fail closed.
- Branch-aware clinic tools are explicitly allow-listed; queries bind patient, appointment, invoice, inventory and patient-linked LabOrder records to the verified branch. Writes derive branch from a verified patient or the verified selected branch. Tools without complete branch predicates stay denied for narrow roles.
- Direct Jarvis shortcuts, briefing, greeting, proactive alerts, Digital Twin and patient insights are restricted so they cannot bypass the kernel's branch context.
- Canonical role mapping has a compatibility alias `cashier → ADMIN`; the new resolver requires an explicit canonical `admin` or `org_admin` PersonRole before granting organization-wide ADMIN scope.
- `AgentActivity`, `AiApproval` and `ai_employee_tasks` still lack a persisted branch key. Therefore narrow branch contexts receive no timeline, approval or task-ledger rows and cannot approve/reject cross-user actions or transition the clinic-wide task ledger. The organization-wide AI ledger remains clinic-only and restricted to verified OWNER/ADMIN without a selected branch.
- **Not solved by this slice:** patient assignment/OWN visibility for DOCTOR and ASSISTANT (RB-035), full negative route/session matrix, branch-aware ledger schema and partner organization-first queue/approval rollout. No schema migration or historical-data update was performed. All changes await exact-head CI, E2E, Quality Gate and appropriate staging proof.
