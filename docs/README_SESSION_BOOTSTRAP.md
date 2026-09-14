# Start Here — DentVision

This is the navigation page for a new AI/engineering session. Do not ask the user which document to read first.

## Read in this order
1. `DENTVISION_CONTEXT.md` — current verified project state, authority hierarchy and immediate queue.
2. `DENTVISION_OPERATING_DIRECTIVE.md` — persistent engineering + product-growth directive.
3. `DENTVISION_EXECUTION_PLAN.md` — implementation sequence and Definition of Done.
4. `DENTVISION_EXECUTION_LOG.md` — durable implementation evidence/history.
5. `DENTVISION_SUPERAPP_BLUEPRINT.md` + `DENTVISION_SUPERAPP_MASTER_PLAN.md` — product requirements/north star.
6. `docs/business/DENTVISION_PARTNER_ECONOMICS.md` — sole canonical pricing/commission/accounting policy.

## Rules
- Current code and fresh CI/runtime evidence beat old documentation.
- Requirements documents are not proof of implementation.
- Preserve previous unfinished work when starting a new task.
- Fix blockers before adding breadth.
- Do not invent routes, models, permissions, business rules or fake fixtures to satisfy tests.
- Do not create competing roadmaps/current-state/release-gate documents.
- For every material slice: implement → test → fix → verify → document.

If a document conflicts with `DENTVISION_CONTEXT.md`, treat the conflict as stale state and update the current context from verified evidence rather than creating another source of truth.
