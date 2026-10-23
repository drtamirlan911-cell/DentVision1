# DentVision — Ecosystem Operations & Support Control Plane

**Status:** Operating contract; implementation status must be proven against code and exact-HEAD tests.  
**Scope:** Cross-ecosystem user support, incident operations, and a simple implementation/evidence register.  
**Authority:** This document is an operational checklist, not a competing product specification or roadmap. The Master Spec defines product behavior; Product DNA defines quality; the Execution Plan defines sequence; Release Blockers defines release risks; Execution Log stores evidence.

## Goal

Every supported participant—patient/buyer, professional, clinic, diagnostic center, medical or dental lab, supplier/manufacturer, academy/lecturer/student, employer/job seeker, community user, or platform operator—must have one discoverable way to get help, track a case, and understand the next action. Reuse the existing identity, organization, IAM, workspace, notification, support-ticket and audit foundations. Do not create a parallel organization model, CRM, permission system, or ticket database.

**Loop:** detect → classify → assign → acknowledge → investigate → resolve → verify → document root cause → prevent recurrence.

## User experience contract

- One discoverable **Help & Support** entry from the global shell and contextual AI Workspace; reuse existing navigation.
- From a failed workflow, offer a contextual explanation and a safe next step without losing active organization/branch/workspace context.
- Provide searchable guidance, service status, contact/case creation, and the user's own cases.
- Show case ID, status, accountable team/role, last update, next action, and any information needed from the requester.
- Keep a non-AI fallback; support must work when AI is unavailable.
- Mobile, keyboard, screen-reader and localization behavior are release requirements, not polish tasks.
- AI may classify, summarize, search approved runbooks, and draft a case. It must never bypass IAM, expose another tenant's data, claim an unverified fix, or perform irreversible clinical/financial actions without the required authorization and confirmation.

## Case lifecycle

`NEW → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING_FOR_USER / WAITING_FOR_DEPENDENCY → RESOLVED → VERIFIED → CLOSED`

Reopening returns a reproducible issue to triage while preserving history. Duplicates link to a canonical case. Every status, assignment, priority and handoff records actor, time, reason and old/new value. A case cannot be VERIFIED without a resolution note and evidence. Do not treat administrative closure as requester-confirmed resolution.

Minimum case data: immutable ID; timestamps; requester reference; authorized organization/workspace/branch context; effective role; category; impact/priority; sanitized summary; status; accountable owner; safe evidence references; next action; resolution; verification result; audit trail.

Never copy patient charts, full medical history, passwords, access tokens, payment secrets, unrestricted headers or raw production payloads into support text. Prefer opaque references and redacted, access-controlled evidence. Support authorization is not a global bypass; staff see only the minimum required for their task. Any temporary elevated access must be approved, time-limited, reason-bound and audited.

## Priority and escalation

| Priority | Examples | Proposed internal handling target |
|---|---|---|
| P0 Critical | Patient-safety risk, PHI/cross-tenant exposure, active compromise, broad outage, financial-integrity incident | Immediate escalation and containment; update every 30 minutes while active |
| P1 High | Core workflow unavailable, payment/settlement at risk, no safe workaround | Acknowledge within 1 business hour; update every 4 business hours |
| P2 Normal | Degraded workflow with safe workaround | Acknowledge within 1 business day; update each business day |
| P3 Low | How-to, cosmetic defect, enhancement | Acknowledge within 2 business days; state next step |

These are proposed internal targets, not a claim of current staffing or a public contractual SLA. Define coverage hours and approved targets before publishing them. Safety, security, privacy and financial-integrity signals are escalated regardless of the user's selected priority.

Accountable routing: domain support (clinical/CRM, diagnostics, labs, commerce, academy/jobs/community, finance, IAM, mobile/offline); platform operations (availability, jobs/queues, integrations, deployment); security/privacy (access, PHI, retention, suspicious activity); clinical safety owner (unsafe clinical output/context); finance owner (payments, reconciliation, settlement); product owner (repeated friction/adoption). One accountable owner per case; handoffs preserve history and next action.

## Operations view — aggregate canonical sources, do not duplicate them

1. **Service health:** frontend/API/database, queues/jobs, integrations, latency/error rates, last successful check and freshness.
2. **Support queue:** unassigned/overdue cases, P0/P1 incidents, waiting states, repeat reports and accountable owner.
3. **Workflow health:** aging/failed appointments, diagnostic referrals, medical-lab tests, dental-lab orders, orders/payments/reconciliation, onboarding/invitations, academy enrollment and offline-sync failures—only where canonical events/statuses exist.
4. **Adoption/friction:** onboarding completion, time to first successful workflow, repeated help searches, abandonment and support contacts per active organization. Show denominator/time window; never rank staff from raw counts without context.
5. **Release control:** exact commit, CI run, required gates, open blockers, deployment/smoke-test timestamp, rollback target and evidence links.
6. **Security/data integrity:** authorization denials, tenant-boundary signals, audit gaps, failed jobs, suspicious payment transitions and privacy-safe alerts.

Every panel shows source, freshness, scope and clear empty/error states. “No data” is not “healthy.” Tenant-scoped users never see another organization's operational data. Do not invent a parallel telemetry store: missing telemetry is an explicit gap.

## Root cause and incident process

Separate a **case** (one request), **incident** (service impact), **problem** (root cause), and **change/release** (controlled fix). P0/P1 incidents record impact, start time, affected domains, incident lead, mitigation, communication cadence, recovery evidence and post-incident review. Review includes 5-Why/root cause, detection gap, preventive actions, owners, due dates and regression tests. Broad reports must not contain identifiable clinical data.

## Implementation/evidence register

The table below is a checklist, not a claim of implementation. Current status is **NOT VERIFIED** until linked to code and passing evidence.

| Capability | Current status | Evidence required for VERIFIED |
|---|---|---|
| Help entry points for every participant type | NOT VERIFIED | Role matrix + desktop/mobile E2E + accessibility |
| Case lifecycle, assignment and handoff | NOT VERIFIED | API/unit/E2E lifecycle, audit and authorization tests |
| Queue search/pagination/staff directory | PARTIAL — API helper changes exist on current branch; end-to-end behavior unverified | Backend route/controller + UI consumer + paging/search/role tests |
| Priority escalation and incident linkage | NOT VERIFIED | P0/P1 simulation, owner assignment, communication and recovery evidence |
| AI triage and approved knowledge | NOT VERIFIED | Prompt-injection/privacy tests, IAM enforcement, human confirmation, AI-off fallback |
| Service health and freshness | NOT VERIFIED | Real source integrations, stale-source and outage simulation |
| Domain workflow monitoring | NOT VERIFIED | Canonical event/status mapping and per-domain integration tests |
| Release evidence view | PARTIAL — repository has release docs/gates; unified operational view unverified | Exact-SHA CI, blockers, deployment and rollback evidence linked in one view |
| Privacy-safe support and tenant isolation | NOT VERIFIED | RBAC/IDOR/cross-tenant tests, redaction tests and audit review |
| Knowledge/runbooks and user feedback | NOT VERIFIED | Reviewed articles, ownership, freshness, metric definitions and privacy review |
| Mobile/offline case support | NOT VERIFIED | Retry/conflict tests and proof sensitive payloads are not persisted or logged |

Allowed states: **VERIFIED** (current evidence linked), **PARTIAL** (working slice and explicit gaps), **BLOCKED** (named dependency/risk), **NOT STARTED** (no implementation evidence), **NOT APPLICABLE** (rationale). Each row must include owner, source path/API, exact commit SHA, test/CI run, evidence URL, last-verified date, gap and next action. Unknown field means it cannot be VERIFIED.

## Delivery gates

**A — Inventory:** map existing support/help/feedback UI, support APIs/models, IAM, notifications, audit, health checks, runbooks and release gates. Record actual source paths and route/role coverage before changing code.

**B — Safe case workflow:** implement only missing lifecycle transitions on existing foundations. Test create, assign, handoff, wait, resolve, verify, reopen, duplicate, audit, tenant isolation and redaction.

**C — Operations:** aggregate real health/events with freshness metadata. Test degraded dependency, stale source, queue backlog, escalation and recovery.

**D — AI/knowledge:** use approved support knowledge and narrowly scoped tools. Prove AI cannot bypass IAM, leak tenant context, or fabricate resolution; maintain a non-AI fallback.

**E — Outcomes:** measure first response/resolution by priority, reopen/repeat-contact rate, workflow failures and onboarding completion only with defined denominators, privacy approval and named owners.

## Definition of done

Release-ready only when all participant types can find role-correct support; case ownership/lifecycle is persisted and audited; tenant isolation and sensitive-data redaction pass; P0/P1 escalation is exercised; operational panels use real freshness-qualified sources; AI permissions/confirmation and fallback are tested; mobile/offline paths are verified where supported; and every checklist item links exact-commit evidence. Existing release blockers remain open until their own verification passes.

## Immediate next actions

1. Inspect current support model, routes/controllers, UI consumers, IAM and audit behavior.
2. Map each checklist row to exact files/tests and classify verified/partial/blocked/not started.
3. Fix P0 safety/security/data-integrity gaps before dashboard polish.
4. Implement one bounded vertical slice at a time and record evidence in the canonical Execution Plan/Log.
5. Keep the Execution Plan as the sole sequencing authority; this file is only the operational checklist.
