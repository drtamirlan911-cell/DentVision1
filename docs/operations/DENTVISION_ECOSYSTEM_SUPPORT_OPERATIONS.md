# DentVision Ecosystem Support & Operations Model

**Status:** PROPOSED DESIGN — not proof of implementation
**Purpose:** one auditable operating model for support, incidents, requests, service health and release readiness across every DentVision participant type.

## 1. Product rule
Support is a shared platform capability, not a clinic-only module and not a collection of disconnected admin pages. Reuse canonical Identity, Active Workspace, Organization, Branch, Role, Permission, Data Scope, Audit, Notification and Finance foundations. Do not create a second user, organization, role or ticket identity model.
The interface should answer: What needs attention? Who owns it? What is the next action? What is blocked? What evidence proves resolution?

## 2. Role-scoped views
- End user/customer: report a problem, track status, add safe attachments, see next update, reopen with reason.
- Workspace owner/admin: manage their own members' requests, notices and configuration; never see other tenants.
- Frontline support: triage, classify, request safe diagnostics, assign owner, link duplicates, use approved templates and escalate.
- Domain specialist: resolve assigned cases within authorized clinic, diagnostics, laboratory, supplier, marketplace, Academy, finance, identity, mobile or integration scope.
- Incident commander/on-call: coordinate impact, timeline, mitigation, updates and post-incident review.
- Platform operator/superadmin: cross-tenant overview only through explicit audited privilege; operator status does not automatically grant access to clinical content.
- Engineering/release manager: connect defects to repository issues, PRs, CI runs, releases, rollback and verification evidence.
- Auditor/compliance: read-only scoped access to event history and policy evidence.
Authorization must be enforced server-side on every operation. Hiding a button or route is not authorization. Impersonation and patient-record access are not default support capabilities.

## 3. Unified case lifecycle
New → Acknowledged → Triaged → In progress → Waiting for requester / Waiting for partner / Blocked → Resolved → Verified → Closed.
- Reopening requires a reason and preserves history.
- Blocked requires blocker type, owner and next review time.
- Waiting may pause a resolution clock only under an approved policy; elapsed time remains visible.
- Resolution requires a resolution code, user-facing summary and verification evidence. Security, clinical and financial incidents need appropriate audit and approval.
- Duplicates link to a canonical case but retain reporter, tenant, timestamps and notification history.
- A message sent or status changed alone does not prove resolution.

## 4. Case categories
1. Identity, access, workspace and membership; 2. product defect/workflow; 3. clinical safety/patient-data integrity; 4. privacy/security; 5. payments/billing/refunds/reconciliation; 6. diagnostics and labs; 7. marketplace/supplier/orders; 8. Academy; 9. mobile/offline/sync; 10. availability/performance/integrations; 11. onboarding/how-to; 12. feature request/feedback.
Use one primary category plus optional tags; avoid unbounded free-form taxonomy.

## 5. Severity and service targets
Severity depends on impact, scope and urgency, not customer status alone. These are proposed targets requiring owner approval before production enforcement:
- S0 Critical: active patient-safety risk, confirmed cross-tenant exposure, active compromise, widespread outage or financial-integrity incident. Page on-call immediately; acknowledge within 5 minutes; coordinate continuously until contained.
- S1 High: core workflow unavailable across organizations, data integrity at risk or broad payment failure. Acknowledge within 15 minutes during covered hours; update at least every 30 minutes.
- S2 Normal: one organization/role materially blocked without a workaround. Acknowledge within 4 business hours; update each business day.
- S3 Low/guidance: question, minor issue with workaround or feature request. Acknowledge within 1 business day; provide next step or review date.
Publish coverage hours, timezone, holidays and target-versus-guarantee wording before enabling SLA timers. Clinical-safety and security reports bypass ordinary queues.

## 6. Incident management
An incident is a case with multi-user/tenant impact, safety/security/financial risk or a need for coordinated mitigation. Record severity, commander, technical lead, communications owner, affected domains and time window, minimum-necessary impact data, detection time, known/unknown facts, timeline, mitigation, rollback trigger, customer-update cadence, recovery signals, data-integrity checks and linked corrective actions with owners/due dates.
Never put credentials, tokens, payment secrets, full patient records or raw PHI in tickets, logs, notification previews or incident titles. Link to access-controlled evidence instead.

## 7. One operations dashboard
Default cards: new/unassigned; overdue acknowledgement; breached targets; active S0/S1; next update due; cases by domain/severity/tenant impact/owner; blocked cases and age; reopen rate; median first response and resolution; backlog age; incoming-versus-resolved trend; recurring defects/release regressions; service health/maintenance; unresolved security, clinical-safety and data-integrity actions.
Every metric needs a definition, time range, timezone, source query and last-updated timestamp. Drill-down preserves scope. Show stale/error states instead of silently displaying misleading numbers.

## 8. Ownership and escalation
Every active case has exactly one accountable owner and a next action. Collaboration does not remove accountability. Escalation path: frontline → domain specialist → on-call/incident commander → engineering or security/clinical lead → product owner/executive decision.
Escalate on severity, overdue acknowledgement, missing owner, repeated reopen, blocked duration or linked production regression. Record trigger, previous/new owner, timestamp and reason. Name primary and backup owners before automated paging.

## 9. Knowledge and self-service
Convert recurring resolutions into reviewed articles, onboarding checklists and contextual help. Articles have domain, audience/role, product version, owner and review date. Suggest relevant articles without blocking human escalation. Version and localize templates; never ask users for passwords, tokens or full patient charts. Route stale or low-confidence articles for review.

## 10. Privacy, security and audit
- Enforce tenant, organization, branch, role and data-scope checks on reads, writes, search, exports and attachment downloads.
- Keep immutable event history for assignment, severity, status, ownership, SLA clock, restricted-evidence access, exports and privileged actions.
- Minimize PHI in support telemetry and notifications; scan uploads and define retention.
- Restrict clinical evidence to specifically authorized staff with reason and time-bounded access; break-glass access requires audit and review.
- Keep platform payment disputes separate from clinic cashier/manual confirmation.
- Rate-limit public intake, protect against malicious uploads and avoid leaking whether another tenant/user exists.
- Define retention, deletion, legal hold and jurisdictional requirements before launch.

## 11. Integrations and automation
Reuse IAM/workspace context, notification service, audit log, redacted observability references, GitHub/CI/deployment references, status notices, opaque billing references and knowledge base. Do not duplicate these systems.
AI may classify, summarize, suggest duplicates, draft responses and recommend owners. A human approves external communication, severity reduction, S0/S1 closure, access grants, refunds, clinical actions and destructive operations. AI output must cite evidence and remain within the requester's authorized data scope.

## 12. Implementation ledger
Do not mark a capability implemented because a route, model, document or screen exists. Track statuses and evidence in the existing DENTVISION_EXECUTION_PLAN.md and DENTVISION_EXECUTION_LOG.md; do not create a competing roadmap.

| ID | Capability | Initial status | Evidence required for DONE |
|---|---|---|---|
| SUP-01 | Inventory existing support, feedback, incident and admin capabilities | NOT VERIFIED | repository paths, schema/route map and tests |
| SUP-02 | Tenant-scoped lifecycle and audit history | NOT VERIFIED | API/DB and transition tests |
| SUP-03 | Server-side role/domain permissions and cross-tenant denial | NOT VERIFIED | positive and negative RBAC/IDOR tests |
| SUP-04 | Severity, service hours and SLA clocks | PROPOSED | approved policy and timezone/waiting/holiday tests |
| SUP-05 | Incident commander, timeline, updates and postmortem | NOT VERIFIED | end-to-end incident drill |
| SUP-06 | Assignment, backup ownership and escalation | NOT VERIFIED | routing, timeout and delivery tests |
| SUP-07 | Safe attachments, redaction and restricted clinical evidence | NOT VERIFIED | upload/security tests, PHI review and access audit |
| SUP-08 | Dashboard with defined/reconciled metrics | PROPOSED | metric definitions and stale/error states |
| SUP-09 | Knowledge base and contextual help | NOT VERIFIED | search, permission, versioning and review tests |
| SUP-10 | Notifications, status notices and deduplication | NOT VERIFIED | delivery/retry/idempotency tests and PHI-safe payload review |
| SUP-11 | GitHub/CI/deployment/observability links | PROPOSED | traceable defect-to-release drill with no secrets exposed |
| SUP-12 | AI-assisted triage with evidence and human approval | PROPOSED | role-scope and prompt-injection tests; no autonomous high-risk action |
| SUP-13 | Mobile intake, offline behavior and accessibility | NOT VERIFIED | mobile E2E, accessibility and offline/retry tests |
| SUP-14 | Retention, deletion, export and compliance | NOT VERIFIED | approved policy, audit evidence and lifecycle tests |
| SUP-15 | Service ownership, runbooks, on-call and recovery | NOT VERIFIED | named primary/backup owners and successful tabletop/restore drill |

NOT VERIFIED means this design task has not yet collected repository/runtime evidence; it does not assert that no code exists. PROPOSED means owner approval is needed. No item is DONE at document creation.

## 13. Delivery sequence
**A — Inventory (read-only):** map models, routes, screens, notification events, IAM, logs and tests. Find canonical implementations before building anything.
**B — Safety foundation:** tenant scope, immutable audit, restricted evidence, severity escalation, owner/next-action invariants and regression tests.
**C — Operational MVP:** intake, triage, assignment, lifecycle, safe replies, search, notifications, SLA visibility and backlog dashboard.
**D — Incident readiness:** coordination, status updates, runbooks, postmortems and drills.
**E — Ecosystem parity:** test clinic, diagnostic center, medical lab, dental lab, supplier, lecturer/student, buyer/patient and platform operations contexts; include mobile and accessibility.
**F — Automation:** knowledge suggestions and AI triage only after permission, redaction, audit and human-approval gates pass.

Release acceptance: every SUP item has status, owner and evidence link in the existing plan/log; cross-tenant, privilege-escalation, PHI-leakage and attachment-security tests pass; S0/S1 tabletop proves alerting, ownership, mitigation, recovery verification and postmortem; dashboard metrics reconcile with source records; mobile, accessibility, reliability and performance gates pass; no unsupported SLA/availability/implementation claims.

## 14. Immediate next action
Run Stage A against exact main and the active feature branch. Trace schema → API → IAM → UI → notifications → tests. Update the existing execution plan/log with evidence-backed statuses. Do not build a parallel ticket system unless inventory proves a real gap.