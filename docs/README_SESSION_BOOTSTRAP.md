# Start Here — DentVision

If you are a new AI/session working on this repository, do not ask the user which document to read first.

## First read
1. `DENTVISION_CONTEXT.md` — project bootstrap, authoritative sources, current state, rules and immediate queue.
2. `docs/DENTVISION_RECONCILIATION_2026-09-14.md` — detailed implementation-vs-requirement reconciliation.

## Then use the appropriate authority
- Product north star / UX / architecture: `DENTVISION_SUPERAPP_BLUEPRINT.md`
- Master implementation requirements: `DENTVISION_SUPERAPP_MASTER_PLAN.md`
- Execution order: `DENTVISION_EXECUTION_PLAN.md`
- Execution evidence/history: `DENTVISION_EXECUTION_LOG.md`
- Business/economics: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`

## Important
Documents are not automatically proof that a feature is implemented. Verify code, API, DB, UI and tests. If sources disagree, record `CONFLICT` and use current verified evidence for release status.

Never merge a PR merely because documentation says `[x]`. Never invent routes, permissions, models, or business rules just to satisfy tests.
