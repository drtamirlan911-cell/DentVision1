# Audit safe sync — 2026-09-09

This branch is based directly on the current `main` and contains only narrowly scoped security hardening from the divergent audit branch.

## Included

- Fail-closed brute-force login protection when persistence cannot be read.
- Clinic-bound validation for treatment-plan doctor references.
- Clinic-bound validation for treatment-plan appointment/invoice references before JSON persistence.
- Unit coverage for cross-clinic treatment-plan references.

## Safety rule

No broad merge, force-push, migration rewrite, UI rewrite, or unrelated audit change is included here. The purpose is to make the high-value security fixes independently reviewable and mergeable against the current `main`.
