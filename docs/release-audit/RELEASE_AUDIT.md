# DentVision Release Audit Ledger

Persistent working log for release-gate findings, fixes, evidence, and open risks.

Rule: every substantive finding discovered during CI/E2E/visual/security/business-role verification is recorded here before it is considered closed.

## Current release cycle — 2026-09-21

### OPEN — LAB-403-001
- Area: Diagnostics / Medical Laboratory / Dental Laboratory
- Finding: E2E evidence showed HTTP 403 Forbidden responses for laboratory-role flows.
- Roles observed: medical-lab owner/technician; dental-lab owner/technician.
- Status: OPEN
- Required investigation: exact request URL/method, authenticated role, active organization/laboratory context, backend authorization middleware, scope resolver, membership/role records, intended access contract.
- Required fix: correct backend authorization/scope resolution without weakening authorization or bypassing tenant isolation.
- Required regression: positive and negative tests for both medical and dental laboratory roles, including cross-organization access denial.

### IN PROGRESS — VIS-CTRL-001
- Area: Visual Design Release Gate
- Finding: unnamed interactive controls were reported for laboratory/diagnostics role flows.
- Action: focused failure screenshots and DOM details were collected; confirmed icon-only controls were audited and fixes applied where confirmed.
- Regression: full E2E + visual/role/mobile gates.

### IN PROGRESS — VIS-TOUCH-001
- Area: Patient Portal / Shop
- Finding: undersized interactive control(s) were reported by the visual gate.
- Action: confirmed small touch-target issue in Patient Portal consent UI; fix applied.
- Regression: mobile/tablet visual gates.

## Evidence policy

For every substantive finding, retain:
1. scenario, role, route, viewport;
2. failing test and exact error;
3. screenshot/trace/network evidence when available;
4. root cause;
5. fixing commit;
6. regression result;
7. final PASS/closed state.

Large Playwright artifacts may remain in GitHub Actions rather than Git history. The ledger records the run/artifact identifier and evidence location so findings are not lost when artifacts expire.

## Release rule

A finding is not CLOSED merely because code was changed. It becomes CLOSED only after the relevant regression scenario and release gate pass.
