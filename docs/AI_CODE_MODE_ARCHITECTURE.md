# AI Code Mode — Architecture Decision & Safe Adoption Plan

**Status:** PROPOSED — design gate only; not enabled in application runtime  
**Date:** 2026-11-07  
**Repository baseline:** `main` at `ac913cc3389a294d0b135a852b035ddddb1018ca`  
**Normative product contract:** `docs/DENTVISION_MASTER_SPEC.md` v5.0, especially §15 and §17  
**Related implementation:** `dentvision-backend/src/modules/ai/os/orchestrator.ts`, `os/kernel.ts`, `os/tools.ts`, `os/access.ts`, `os/dataScope.ts`, `os/toolPermissions.ts`

## 1. Decision

Adopt a **Code Mode-inspired orchestration pattern as an optional execution interface**, not as a replacement for DentVision's existing AI OS.

The current architecture already has:
- role/persona/agent selection and a bounded tool loop in `os/orchestrator.ts`;
- a canonical tool catalog in `os/tools.ts`;
- DB-verified access resolution in `os/access.ts`;
- a governance kernel (`runAiAction`) with surface checks, argument sanitization, permission checks, approval handling, execution, activity and evidence recording;
- separate staff, admin and patient tool surfaces;
- deterministic fallback when the model/provider is unavailable.

The Master Spec's required sequence remains authoritative:

`AI Router → Active Context → Role/Workspace Context → Permission Engine → Tool Registry → Model/Reasoning → Action Validator → Preview → Confirmation when required → Execute → Verify → Audit`

Code Mode may optimize *how a plan composes already-authorized capabilities*. It must not become a new authorization system, data-access layer, or alternate path to mutations.

## 2. Why not replace the current orchestrator

The current direct tool-call loop is useful for small, fixed tasks and makes individual tool decisions inspectable. A code-execution interface is potentially useful for dependent multi-step reads, aggregation, filtering, pagination, and large tool catalogs.

Use a hybrid policy:
- **Direct tool calls remain the default** for simple requests, single operations, clinical decisions, and every mutation.
- **Code Mode is considered only for multi-step compositional tasks** where measured token/latency savings justify the additional execution boundary.
- Deterministic shortcuts remain preferred when they already answer the request without a model call.
- The existing provider adapter, model router, usage accounting and deterministic fallback remain in use.

Do not add a second parallel tool registry or duplicate domain rules.

## 3. Proposed target architecture

```text
User request
  → AI Router / active workspace context
  → DB-verified identity + permission resolution
  → policy-selected interface
       ├─ direct tool call (default)
       └─ Code Mode plan (read-only pilot only)
             → isolated execution runtime
             → typed, allow-listed capability facade
             → host-side runAiAction / canonical domain handlers
             → scoped result projection
  → verify results + provenance
  → response
  → activity/evidence audit
```

### 3.1 Capability facade

The sandbox receives only typed functions selected for the current request, for example:
- `getSchedule({ from, to })`
- `getClinicLoadPlan({ date })`
- `getInventory({ lowStockOnly })`
- `getRevenueSummary({ period })`

These names are illustrative. Before exposure, each capability must be mapped to an existing canonical tool and its actual Zod/schema contract.

The facade must not expose:
- Prisma, raw SQL, database clients or ORM objects;
- arbitrary HTTP/fetch, sockets, DNS, filesystem, process, shell or module loading;
- environment variables, provider/API keys, JWTs, cookies or signing secrets;
- raw Express request/response objects;
- arbitrary URL/origin/path execution;
- unrestricted model-selected clinic, organization, branch, patient or user identifiers.

The host derives actor, active organization, clinic and branch context from authenticated server state. Model/code-supplied identity and scope fields are rejected or stripped. The host re-resolves access for every underlying operation; a prior authorization result is not a reusable blanket grant.

### 3.2 Sandbox boundary

Generated code must execute outside the API process in a runtime with:
- outbound network disabled by default;
- no ambient credentials or inherited application bindings;
- no direct access to application memory or data;
- bounded execution time, memory, code size, nesting/loop work, capability calls and output size;
- per-user and per-organization concurrency/rate limits;
- cancellation and timeout behavior;
- a versioned runtime and capability contract.

Cloudflare Dynamic Workers / Code Mode are a candidate implementation, not an assumed dependency. Cloudflare's current documentation labels Code Mode experimental and cautions against unreviewed production use. A separate isolated worker/container may be evaluated against the same threat model. No Cloudflare account, deployment, billing plan, secrets or infrastructure changes are authorized by this design document.

## 4. Safety policy — initial pilot

The first pilot is **read-only and synthetic/staging-data only**.

Allowed pilot operations:
- read-only operational summaries;
- bounded lists and pagination;
- filtering, sorting and aggregation of already-authorized results;
- combining results from multiple read-only canonical tools.

Explicitly excluded:
- patient clinical history, radiographs, diagnoses, odontograms and other PHI;
- patient-facing surfaces and guest surfaces;
- cross-organization or cross-branch discovery;
- arbitrary patient/appointment/order IDs supplied by generated code;
- creating/updating/deleting records;
- appointments, treatment plans, invoices, payments, refunds, wallet/ledger/economics operations;
- sending messages, notifications, reminders or external communications;
- signing, approving, releasing, settling, archiving or changing access;
- multi-step workflows with irreversible or externally visible side effects.

Clinical and financial mutations remain on the existing direct path with preview, explicit human confirmation and the existing high-risk second-approver policy where required. Generated code can never set `confirmed`, create an approval, approve its own plan, or replay an approval.

## 5. Authorization, tenant isolation and audit invariants

Every capability call must:
1. carry a server-generated trace/run ID;
2. bind to the verified principal and active context;
3. pass the existing surface/tool allow-list;
4. pass current organization/clinic/branch and permission checks;
5. use the canonical domain handler rather than a new query implementation;
6. return only the minimum fields required for the plan;
7. record allow/deny/error outcome and result provenance.

The runtime itself must be recorded as an AI activity. Each underlying tool call remains independently auditable; one top-level code-run log is not a substitute for per-tool activity/evidence.

Do not weaken or bypass:
- `runAiAction` and its denial/evidence behavior;
- `resolveAiToolAccess` and canonical IAM;
- `SURFACE_TOOLS`, `TOOL_PERMISSIONS`, `HIGH_RISK_TOOLS` and patient-scope policy;
- active organization/branch context;
- clinical approval, consent and data-minimization rules;
- deterministic finance/economics domain logic.

Before any PHI-bearing pilot, separately audit staff activity argument redaction and evidence snapshots. Current source contains staff-side argument capture; the Code Mode pilot must not increase PHI retention or place raw clinical payloads in code logs, traces, exceptions or model-visible errors.

## 6. Progressive discovery

Do not inject the entire tool catalog into every model prompt.

A discovery interface may expose:
- `searchCapabilities(query, domain?)` — returns names and short descriptions only;
- `describeCapability(name)` — returns the bounded schema, permission class, data sensitivity, side-effect class and limits for one capability.

Discovery results are not authorization. The host still enforces access at execution time. Discovery must not return hidden tool names, partner data, internal schemas, secrets or permission details that reveal inaccessible capabilities.

## 7. Failure and fallback behavior

- Invalid or over-budget code: reject before execution.
- Sandbox timeout/crash: cancel the run and return a safe deterministic error; do not retry side effects.
- Provider outage: use the existing deterministic fallback.
- Capability denial: return a sanitized denial code; never let generated code retry with another tenant or identity.
- Partial read failure: report which read failed; do not fabricate a complete summary.
- Output truncation: mark it explicitly and preserve counts/cursors so the model does not claim completeness.
- Audit-write failure: fail closed for any future side-effecting path; read-only pilot behavior must be explicitly governed and observable.
- Runtime unavailable: route to the existing direct tool loop or deterministic path; never silently widen permissions.

## 8. Rollout gates

### Gate 0 — design and threat model
- Map all exposed tools to canonical handler, permission, tenant scope, sensitivity, side effects and output schema.
- Confirm the chosen runtime's isolation guarantees and operational limits.
- Review data retention, PHI redaction, logging and incident response.
- No application feature flag enabled.

### Gate 1 — offline evaluation
- Use synthetic fixtures only.
- Compare direct calls vs composed execution for the same deterministic tasks.
- Measure total input/output tokens, model round trips, wall-clock p50/p95, capability calls, output size and task correctness.
- Include adversarial tests for tenant ID injection, scope switching, tool name guessing, unbounded loops, oversized output, timeout, network access and secret exfiltration.

### Gate 2 — staging read-only pilot
- Feature flag defaults OFF.
- Restrict to a small explicit read-only allow-list and synthetic/staging tenants.
- Keep direct tool calls as fallback.
- Verify per-capability activity/evidence and compare results against direct execution.
- No production PHI, payments, external messaging or mutations.

### Gate 3 — limited production read-only
Requires security review, privacy review, stable exact-HEAD CI, staging evidence, approved data-retention policy, monitoring, kill switch and rollback drill. Start with non-clinical aggregate data only.

### Gate 4 — future mutation consideration
Out of scope for this proposal. Requires a separate decision, explicit approval semantics, replay/idempotency review, transaction boundaries, concurrency tests and domain-owner sign-off. No generated code may approve or execute its own mutation.

## 9. Acceptance criteria

The pilot is not ready until all are true:
- no direct network, filesystem, process, database or secret access from generated code;
- every capability call re-enters host-side canonical authorization;
- cross-tenant, cross-organization and cross-branch negative tests pass;
- inaccessible tools cannot be discovered or invoked;
- all calls and denials have traceable activity/evidence;
- PHI is absent from code logs and model-visible errors;
- timeout, cancellation, output cap and rate limits are tested;
- direct-tool and deterministic fallbacks work;
- measured savings are material without a correctness or security regression;
- exact-HEAD CI and required release gates pass.

## 10. Immediate implementation sequence

1. Keep current direct orchestration unchanged.
2. Add a generated capability inventory/test that cross-checks registry entries against permission, sensitivity, scope and side-effect metadata; fail CI on unclassified tools.
3. Build an offline benchmark harness using synthetic fixtures; do not add a sandbox runtime dependency yet.
4. Prototype the host-side read-only capability facade behind tests, with no public route and no model access.
5. Evaluate candidate sandbox runtimes against §3.2 and §5.
6. Only after review, add a disabled-by-default feature flag and staging-only pilot.

## 11. References

- DentVision Master Spec v5.0: `docs/DENTVISION_MASTER_SPEC.md` §15 and §17.
- Cloudflare Code Mode overview: https://developers.cloudflare.com/agents/tools/codemode/
- Cloudflare Code Mode MCP server guide: https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/
- Cloudflare sandbox model: https://developers.cloudflare.com/sandbox/concepts/

Cloudflare documentation (checked 2026-11-07) describes Code Mode as an experimental pattern and explicitly states that sandboxed code does not replace authorization or per-operation approval. This proposal preserves those boundaries.
