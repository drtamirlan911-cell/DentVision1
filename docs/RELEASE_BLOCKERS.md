# DentVision — Release Blockers & Deferred Work Register

> Canonical working register reconciled on 2026-10-25. Items remain open until their own closure evidence passes.

## Prioritized triage

The table is the actionable queue. Full source evidence/root cause and regression requirements are recorded in each blocker section. “Fixed/implemented” remains open until exact-head verification passes.

| ID | Priority | Status at checkpoint | Owner | Next action / dependency | Closure evidence |
|---|---|---|---|---|---|
| RB-001 — Medical/Dental Laboratory 403 Forbidden | P0 | OPEN | Backend/IAM + Diagnostics QA | trace exact method/URL, role, organization/laboratory context, authorization middleware, scope resolver and DB membership/tenant scope. | CI verification is required; the same run also showed 500 responses for medical-lab roles, so those must be traced separately if they persis |
| RB-002 — Visual release gate: unnamed interactive controls | P0 | IN PROGRESS | Frontend + accessibility QA | prior E2E runs reported unnamed interactive controls, including diagnostics/lab roles. | rerun after fixes; inspect DOM + screenshot + computed state; check hidden/mobile controls. |
| RB-003 — Visual release gate: undersized touch targets | P0 | IN PROGRESS — exact-HEAD visual recheck pending | Frontend + accessibility QA | Schedule date picker now has an explicit 40px height; School catalog action buttons enforce 40px minimum height; document icon actions enfor | exact-head Visual Agent and role matrix must prove no undersized controls across critical mobile/tablet widths and role contexts, including  |
| RB-004 — Full visual/design release evidence | P0 | OPEN | Release QA | screenshots, DOM/accessibility, computed styles, console/network, trace/video, real interactions across critical routes, roles, states and v | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-005 — Browser/role/context regression after current fixes | P0 | OPEN | Frontend + IAM QA | complete CI rerun after each root-cause fix; verify neighboring scenarios and negative authorization paths. | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-007 — Mobile laboratory drawer visual regression | P0 | FIXED — pending CI visual recheck | Frontend + mobile QA | failure artifact contained 24 screenshots across laboratory owner/technician variants. On 390px screenshots the open drawer shared the botto | inspect all 390/412px lab-role screenshots after CI and exercise open/close/Escape/outside-click/touch behavior. |
| RB-010 — Payment amount, subscription entitlement and metadata trust | P0 | IN PROGRESS — exact-HEAD CI verification pending | Payments backend/security | run exact-head targeted tests and inspect bounded CI evidence. | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-011 — Clinic gateway SSRF and payment-status trust | P0 | IN PROGRESS — regression verification pending | Payments/security | run exact-HEAD tests and verify payment amount/status semantics against each real gateway's documented callback contract. | run exact-HEAD tests and verify payment amount/status semantics against each real gateway's documented callback contract. |
| RB-012 — Patient field encryption fail-open and startup configuration | P0 | IN PROGRESS | PHI/backend security | run exact-head targeted tests and inspect bounded CI evidence. | round-trip, legacy ciphertext, cache and production fail-closed tests exist; exact-HEAD CI remains pending. Legacy rows already stored as pl |
| RB-013 — Credentialed CORS allows untrusted origins | P0 | IN PROGRESS | API security | run exact-head targeted tests and inspect bounded CI evidence. | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-016 — Clinic gateway callbacks must respect configured payment mode | P0 | IN PROGRESS — regression verification pending | Payments backend | clinic callback now rejects requests unless the persisted clinic payment mode is `api`; static mode remains authorized staff confirmation on | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-025 — Role gate exposed auth/route and responsive UI regressions | P0 | IN PROGRESS — exact-HEAD CI verification pending | Frontend + IAM QA | explicitly classify Community as public and add an anonymous-feed smoke check; student/regular/learner accounts with a student effective rol | rerun role/context, Visual Agent and visual evidence validation on the same final SHA; verify visible role labels, public/protected route ma |
| RB-027 — Role/context gate test file does not parse | P0 | IN PROGRESS — exact-HEAD verification pending | CI/QA | commit `f479ebce86694e134a631a4fe076b1ca367debea` closes the function before the next test declaration. | exact-HEAD CI must show the role/context tests actually execute and produce the required role/viewport screenshots; the downstream visual re |
| RB-029 — Patient clinical history JSON is not encrypted at rest | P0 | OPEN — implementation gap confirmed on current main by source inspec | Backend/data security | map all Patient write/read paths, filters, reports, AI context, portal, export and integrations. Design a versioned encrypted-at-rest repres | persisted sensitive values are not plaintext; authorized API responses preserve structured history; tenant/branch isolation holds; legacy ro |
| RB-033 — Main branch protection and required release checks are disabled | P0 | OPEN — branch metadata confirms protection is disabled | Repository administrator | enable protection/rules for `main`, require PR-based changes and the exact stable checks reported by GitHub (`quality`, `lint-test`, `fronte | GitHub reports protection enabled and required checks enforced; a test PR proves a failed required check blocks merge. The current connected |
| RB-034 — AI DoctorAgent cross-tenant patient/appointment IDOR | P0 | IN PROGRESS — fix is merged to main; exact-head full verification pe | AI/backend security | complete exact-main CI/E2E and inspect DoctorAgent negative-path tests and the role/context gate. Main run `40165707260` had lint-test/front | foreign patient/appointment IDs are denied and same-tenant operations remain valid; targeted tests, TypeScript/lint/unit checks and full rol |
| RB-035 — Clinic payment refund over-authorization | P0 | FIXED — pending exact-head CI verification | Finance/payments | `POST /api/payments/:id/refund` treated any authorized clinic member as a sufficient owner for clinic-scoped payments. | static exact-file inspection passed; fresh CI/E2E is still required for closure. |
| RB-036 — Clinic domain ID used as canonical organization ID in Diagnostics | P0 | FIXED — pending exact-head CI verification | IAM/diagnostics | referral authorization passed domain `Clinic.id` directly to `assertOrgAccess`, while canonical IAM uses `Organization.id` and stores the so | static inspection passed; fresh exact-head CI/E2E remains required. |
| RB-037 — SaaS subscription payment can target an arbitrary clinic | P0 | FIXED — pending exact-head CI verification | Billing/payments | generic payment creation accepted `refType=subscription`, arbitrary clinic `refId`, client `saasPlan` and `months` without scoped clinic bil | fresh exact-head CI/E2E required before closure. |
| RB-038 — Clinic-cash payment creation lacks financial permission and ref scope | P0 | FIXED — pending exact-head CI verification | Finance/CRM | clinic-cash payment creation used clinic membership as sufficient authorization and accepted client-supplied appointment/invoice refs withou | fresh exact-head CI/E2E remains required. |
| RB-008 — Academy lecturer without organization scope | P1 | OPEN | IAM/data operations | identify the affected lecturer/academy relationship in production, restore the canonical Academy organization link if the source relationshi | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-009 — Public catalog response vs authenticated catalog policy | P1 | OPEN | Marketplace/Academy + QA | verify authenticated professional/owner contexts expose the expected catalog and that cross-tenant/catalog audience isolation is preserved.  | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-014 — Access-token expiry and Kaspi production configuration | P1 | IN PROGRESS | Auth + Android | run exact-head targeted tests and inspect bounded CI evidence. | not run. Frontend refresh, Android AuthInterceptor/TokenAuthenticator, callback regression tests, and full CI remain required. |
| RB-015 — Upload permission must precede multipart parsing | P1 | IN PROGRESS — verification pending | File-service security | moved `requirePermission('patient.write')` ahead of the concurrency limiter and Multer parsing. | verify route middleware behavior and upload negative paths in CI; preserve the 60 MiB clinical imaging limit and file-signature validation. |
| RB-017 — Production security-header policy is not consistent across hosts | P1 | OPEN — deployment behavior not proven | Platform/DevOps | identify the active production delivery path, collect CSP violation evidence, then converge on one tested policy. Do not switch to enforceme | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-018 — WebSocket bearer token is placed in the URL query string | P1 | OPEN — protocol/hosting ownership needs verification | Realtime owner + auth | verify whether realtime is an external service and how it authenticates. Replace long-lived bearer query credentials with a short-lived, aud | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-019 — Platform Kaspi API contract and network bounds | P1 | OPEN — official provider contract not independently verified | Payments integration + provider | obtain the provider-issued technical contract. Verify signature canonicalization, amount/currency, timestamp/replay protection, idempotency, | provider contract evidence is retained; adapter semantics match it; approved-host policy is tested; positive/negative callback, replay, amou |
| RB-020 — Clinic gateway fallback idempotency | P1 | IN PROGRESS — exact-HEAD test pending | Payments backend | all endpoint attempts for one logical payment creation reuse a single idempotency key. | affected regression tests and exact-head CI/E2E pass without weakening tenant, RBAC, PHI or financial controls. |
| RB-021 — Cancelled CI runs continue launching E2E suites | P1 | IN PROGRESS — workflow verification pending | CI/QA | test/install/release-gate steps now use `if: ${{ !cancelled() }}`, which still allows later gates to run after test failures but skips them  | validate on the next exact-HEAD workflow run that cancellation stops test execution and that a non-cancelled run reaches the actual E2E gate |
| RB-022 — Offline schedule queue persists raw error text | P1 | IN PROGRESS — exact-HEAD regression verification pending | Frontend/offline sync | queue sanitization drops `lastError` from both new and legacy queue entries when saved/read. Identifier-like phone/IIN text in scalar array  | verify on the exact HEAD through unit/CI checks and the release gates. This heuristic guard is not a claim of complete PHI-at-rest protectio |
| RB-023 — Visual Agent matrix duplicated in core E2E | P1 | IN PROGRESS — exact-HEAD workflow verification pending | CI/QA | the core E2E glob now excludes `visual-agent`; the dedicated Visual Agent gate is retained with its separate output and evidence directory.  | confirm the new CI logs show no `visual-agent.spec.ts` in the core suite and that the dedicated Visual Agent gate executes once to completio |
| RB-024 — Role/context gate repeats the exhaustive route matrix at every viewport | P1 | IN PROGRESS — exact-HEAD CI verification pending | CI/QA | keep the exhaustive role, route, anonymous-access and cross-tenant checks once at `role-1280`; run role-specific critical-screen layout/DOM/ | mobile design gate and Visual Agent remain separate; the visual release manifest still receives its required role screenshot for every viewp |
| RB-026 — Playwright CLI smoke never reaches browser checks | P1 | IN PROGRESS — exact-HEAD workflow verification pending | CI/browser automation | install the official CLI globally in the ephemeral GitHub runner, call its `playwright-cli` binary directly, and use `playwright-cli install | ensure the exact-head workflow completes CLI install, skills, real browser login/navigation smoke and visual evidence validation. |
| RB-028 — Visual Agent expects the wrong student entry route | P1 | IN PROGRESS — exact-HEAD verification pending | Visual Agent/QA | commit `d0d4d10798b0b4873f14e6028988d84425ed8923` updates the fixture's expected entry route to `/school` without changing application behav | exact-HEAD Visual Agent must complete all role/viewport journeys; preserve the student workspace assertion. |
| RB-030 — Offline appointment queue privacy redaction may drop required sync fields | P1 | OPEN — behavior requires end-to-end verification | Frontend/offline sync | verify the exact upsert contract and define an explicit offline-safe payload containing only durable IDs and editable non-PHI fields, or mov | E2E must create/edit an appointment offline, reconnect, flush, and verify server-side state and patient association without storing patient  |
| RB-031 — WebKit role-gate API calls fail with access-control/network errors | P1 | IN PROGRESS — exact-HEAD verification pending | CI/browser QA | CI's browser-facing API base was switched to `http://127.0.0.1:3001` so WebKit is not dependent on how `localhost` resolves inside the runne | exact-head CI must show no WebKit page/request/server errors and explicit CORS policy tests must pass. If it fails, inspect the exact reques |
| RB-032 — Successful-path E2E DOM dumps inflate role/visual artifacts | P1 | IN PROGRESS — artifact policy corrected in the follow-up; exact-HEAD | CI/QA | keep all browser/role/tenant/branch/viewport assertions and release-required screenshots; limit successful artifacts to screenshots, compact | on the same exact HEAD, confirm all selected tests execute; role/context, Visual Agent, business-owner, organization-owner, mobile/responsiv |
| RB-039 — Lecturer context token uses non-canonical organization type | P1 | FIXED — pending exact-head CI/E2E verification | IAM/Academy | `POST /api/iam/switch-context` for `scopeType=LECTURER` emitted `organizationType=LECTURER`, while canonical Academy organization context is | local backend TypeScript passes; exact-head E2E required before closure. |
| RB-040 — Support center does not enforce clinical-data minimization server-side | P1 | OPEN — candidate-only privacy gap found during integration review | Support backend + privacy/security | define a support-data classification/retention policy; add server-side validation or redaction for obvious sensitive identifiers without sil | API tests prove sensitive payload handling is enforced; only authorized support staff can access other users' tickets; requester isolation r |

**ID reconciliation:** PR #307's RB-010–RB-014 are canonical payment/security blockers. PR #302 reused those IDs for different issues; its five items are preserved as RB-035–RB-039 with legacy IDs noted. RB-019/RB-029 evidence is reconciled with PR #309, RB-033 comes from the branch-protection audit, RB-034 reflects current main, and RB-040 records a candidate-only support privacy gap.

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
- **Status:** IN PROGRESS — exact-HEAD visual recheck pending
- **Priority:** P0
- **Area:** Responsive / Accessibility
- **Observed:** Patient Portal / Shop and consent-related controls were below the required touch target. E2E run `39341057868` additionally reported 32×32px document action controls, the Schedule date picker at 35.99998px, and School catalog actions measured just below 36px. The 36px assertion is intentional and remains unchanged.
- **Fix on branch:** Schedule date picker now has an explicit 40px height; School catalog action buttons enforce 40px minimum height; document icon actions enforce 40×40px targets and may wrap without horizontal overflow. Reminders tabs use a responsive two/four-column grid with wrapping labels.
- **Latest exact-head evidence (run `39970030360`):** Visual Agent reported a patient-portal booking anchor at 149×24 with no design-system classes, and the diagnostics `Все` action at approximately 36px. Source inspection found the shared `Button asChild` passed a React Fragment to Radix `Slot`, so variant/size/className were not forwarded to the anchor; `DiagnosticsDashboard.tsx` used the extra-small variant for `Все`.
- **Follow-up in current candidate:** forward loading/icon/text into the actual slotted child element, add a regression test for link class/variant propagation, and set the diagnostics action to `min-h-11`.
- **Verification:** exact-head Visual Agent and role matrix must prove no undersized controls across critical mobile/tablet widths and role contexts, including keyboard/touch interactions and screenshots. Keep the 36px assertion unchanged.

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

### RB-010 — Payment amount, subscription entitlement and metadata trust
- **Status:** IN PROGRESS — exact-HEAD CI verification pending
- **Priority:** P0
- **Area:** Payments / Billing / IAM
- **Implemented on branch:** subscription creation checks clinic billing authorization and derives plan/month amount from the canonical subscription service; Academy enrollment/event creation derives price and seller from the persisted course; client metadata cannot override server-owned payer/scope/merchant fields; payment-reference ownership checks remain in place.
- **Regression coverage:** `payments.routes.creation-security.test.ts` covers underpayment, invalid plans/months, unauthorized clinic billing, client metadata spoofing, and Academy underpayment.
- **Additional branch protections:** optional callback amounts are checked against the immutable payment amount; out-of-order non-paid callbacks update only a still-pending payment; gateway fallback attempts reuse one idempotency key. **Remaining:** exact-HEAD CI plus verification against each actual provider contract.

### RB-011 — Clinic gateway SSRF and payment-status trust
- **Status:** IN PROGRESS — regression verification pending
- **Priority:** P0
- **Area:** Payments / SSRF
- **Implemented on branch:** validate HTTPS gateway URL at save/use time; reject IP literals, localhost and unsafe hostnames; resolve all DNS records and reject any private, link-local, metadata, documentation or reserved address; pin one validated public address for the outbound TLS request; reject redirects; enforce an 8-second timeout and 64 KiB response cap; reject clinic callbacks outside API mode and prevent platform payment references from using the clinic callback.
- **Regression coverage:** `clinicPayments.test.ts` covers unsafe IP ranges including expanded IPv6 special-use forms, IPv6 literals, DNS answers, redirect rejection, DNS pinning, host allowlist and stable fallback idempotency; `payments.routes.creation-security.test.ts` covers clinic confirmation, static callback rejection, amount mismatch and callback race protection.
- **Remaining:** run exact-HEAD tests and verify payment amount/status semantics against each real gateway's documented callback contract.

### RB-012 — Patient field encryption fail-open and startup configuration
- **Status:** IN PROGRESS
- **Priority:** P0
- **Area:** PHI / Encryption
- **Implemented on branch:** production config now exits if ENCRYPTION_KEY is missing/short; encryptPatientFields and decryptPatientFields fail closed in production; derived AES key is cached per configured key without changing salt or ciphertext format; Render and Docker configuration require the key.
- **Verification:** round-trip, legacy ciphertext, cache and production fail-closed tests exist; exact-HEAD CI remains pending. Legacy rows already stored as plaintext are not automatically encrypted by this change and require a separately approved, audited backfill. No key rotation or format change was made.

### RB-013 — Credentialed CORS allows untrusted origins
- **Status:** IN PROGRESS
- **Priority:** P0
- **Area:** API security / CORS
- **Implemented on branch:** production CORS is restricted to explicit configured HTTPS origins plus Vercel preview hostnames ending in the configured team slug; wildcard/empty production configuration and localhost are rejected; Render production origin no longer includes localhost.
- **Regression coverage:** `cors.test.ts` covers exact HTTPS origins, hostile suffixes, Vercel team slug, localhost, wildcard and missing-origin behavior. Exact-HEAD CI and intended preview-host configuration remain unverified.

### RB-014 — Access-token expiry and Kaspi production configuration
- **Status:** IN PROGRESS
- **Priority:** P1
- **Area:** Authentication / Payments
- **Implemented on branch:** access JWT default is 15m in backend config, backend .env.example, Docker Compose and Render; platform sandbox confirmation now requires explicit PAYMENTS_SANDBOX=true; Kaspi mock payment creation is disabled in production without merchant credentials; callback secret minimum is 32 characters in the verifier.
- **Verification:** not run. Frontend refresh, Android AuthInterceptor/TokenAuthenticator, callback regression tests, and full CI remain required.

### RB-015 — Upload permission must precede multipart parsing
- **Status:** IN PROGRESS — verification pending
- **Priority:** P1
- **Area:** File upload / Resource exhaustion
- **Finding:** the upload route previously buffered up to 60 MiB before checking `patient.write`, allowing authenticated but unauthorized users to consume upload memory.
- **Fix on branch:** moved `requirePermission('patient.write')` ahead of the concurrency limiter and Multer parsing.
- **Remaining:** verify route middleware behavior and upload negative paths in CI; preserve the 60 MiB clinical imaging limit and file-signature validation.

### RB-016 — Clinic gateway callbacks must respect configured payment mode
- **Status:** IN PROGRESS — regression verification pending
- **Priority:** P0
- **Area:** Payments / Clinic cashier
- **Finding:** a valid/stale clinic webhook secret could otherwise reach callback processing while the clinic was configured for static/manual confirmation.
- **Fix on branch:** clinic callback now rejects requests unless the persisted clinic payment mode is `api`; static mode remains authorized staff confirmation only.
- **Regression coverage:** a negative integration test asserts static-mode callbacks return 403 and never query/settle a payment.
- **Additional branch protections:** non-paid callbacks can update only pending records; optional callback amounts are compared with the stored amount; late failed/pending callbacks cannot downgrade a paid/terminal payment. **Remaining:** exact-HEAD CI and actual provider lifecycle/contract verification.

### RB-017 — Production security-header policy is not consistent across hosts
- **Status:** OPEN — deployment behavior not proven
- **Priority:** P1
- **Area:** Frontend delivery / Browser security
- **Finding:** `vercel.json` sets CSP as `Content-Security-Policy-Report-Only`, while `nginx.conf` enforces a different CSP; the Nginx policy permits generic `wss:` and broad HTTPS image/font sources. The deployed path and CSP violation evidence have not been reconciled.
- **Required:** identify the active production delivery path, collect CSP violation evidence, then converge on one tested policy. Do not switch to enforcement blindly without validating Google sign-in, Sentry, WebSocket, imaging and document workflows.

### RB-018 — WebSocket bearer token is placed in the URL query string
- **Status:** OPEN — protocol/hosting ownership needs verification
- **Priority:** P1
- **Area:** Authentication / Realtime
- **Finding:** `src/services/websocket/socket.ts` constructs `/ws?token=<access-token>`. URL credentials can leak into proxy/application logs. No matching WebSocket upgrade handler was found in the backend entry points inspected in this branch; the actual `VITE_WS_URL` service owner and authentication contract remain unverified.
- **Required:** verify whether realtime is an external service and how it authenticates. Replace long-lived bearer query credentials with a short-lived, audience-bound, single-use connection ticket or an authenticated first-frame protocol only after the server contract is confirmed. Do not invent a parallel endpoint or break realtime blindly.

### RB-019 — Platform Kaspi API contract and network bounds
- **Status:** OPEN — official provider contract not independently verified
- **Priority:** P1
- **Area:** Payments / External API / SSRF
- **Evidence:** `docs/KASPI_CLINIC_SETUP.md` now labels the webhook sample as DentVision's adapter contract for a compatible third-party gateway, not an official Kaspi API specification. Public provider pages reviewed do not establish the exact payment endpoint, authentication header, signature canonicalization, response schema or callback status semantics used by this adapter. The Shop API is a separate catalog/order integration and must not be treated as the online-payment contract.
- **Risk:** provider mismatch can cause false payment confirmation, replay/race defects, duplicate settlement or failed production integration; arbitrary gateway targets can create SSRF risk.
- **Owner:** Payments integration owner, with the actual merchant/provider and platform security.
- **Next action:** obtain the provider-issued technical contract. Verify signature canonicalization, amount/currency, timestamp/replay protection, idempotency, status transitions, timeouts and bounded response parsing. Constrain production API base URLs to approved hosts and preserve SSRF protections.
- **Dependencies:** primary provider contract and approved merchant/gateway identity.
- **Closure criteria:** provider contract evidence is retained; adapter semantics match it; approved-host policy is tested; positive/negative callback, replay, amount mismatch and timeout tests pass on the exact target SHA. Do not claim official Kaspi compatibility from a generic HMAC sample.

### RB-020 — Clinic gateway fallback idempotency
- **Status:** IN PROGRESS — exact-HEAD test pending
- **Priority:** P1
- **Area:** Payments / Duplicate invoice prevention
- **Finding:** fallback attempts across compatible gateway endpoints could previously generate a new idempotency key per attempt.
- **Fix on branch:** all endpoint attempts for one logical payment creation reuse a single idempotency key.
- **Regression coverage:** `clinicPayments.test.ts` asserts the key is identical across fallback attempts; exact-HEAD CI remains pending.

### RB-021 — Cancelled CI runs continue launching E2E suites
- **Status:** IN PROGRESS — workflow verification pending
- **Priority:** P1
- **Area:** CI reliability / Release evidence
- **Finding:** E2E gates used `if: always()`, so a cancelled run could continue launching later Playwright suites after dependency installation was interrupted. The resulting missing-package failures were not valid application regression evidence and consumed runner time.
- **Fix on branch:** test/install/release-gate steps now use `if: ${{ !cancelled() }}`, which still allows later gates to run after test failures but skips them after cancellation. Artifact uploads and compact diagnostics remain `always()`.
- **Remaining:** validate on the next exact-HEAD workflow run that cancellation stops test execution and that a non-cancelled run reaches the actual E2E gates.

### RB-022 — Offline schedule queue persists raw error text
- **Status:** IN PROGRESS — exact-HEAD regression verification pending
- **Priority:** P1
- **Area:** PHI / browser storage / offline sync
- **Finding:** failed appointment sync stored the raw API/network exception in the persistent browser queue as `lastError`. Error strings can reflect request or validation data; the Schedule UI only uses the queue count and has no need to persist them.
- **Fix on branch:** queue sanitization drops `lastError` from both new and legacy queue entries when saved/read. Identifier-like phone/IIN text in scalar array values is also removed; opaque appointment, clinic, patient and doctor IDs in named fields remain available for sync.
- **Regression coverage:** `src/lib/syncQueue.test.ts` exercises legacy queue scrubbing and raw-error removal; `src/lib/localStoragePrivacy.test.ts` covers scalar array redaction and opaque ID preservation.
- **Remaining:** verify on the exact HEAD through unit/CI checks and the release gates. This heuristic guard is not a claim of complete PHI-at-rest protection.

### RB-023 — Visual Agent matrix duplicated in core E2E
- **Status:** IN PROGRESS — exact-HEAD workflow verification pending
- **Priority:** P1
- **Area:** CI duration / visual regression reliability
- **Finding:** the core E2E file glob included `visual-agent.spec.ts`, although CI already runs that full ecosystem role/viewport matrix in its dedicated Visual Agent release-gate step. This duplicated expensive browser work and its flaky retry evidence.
- **Fix on branch:** the core E2E glob now excludes `visual-agent`; the dedicated Visual Agent gate is retained with its separate output and evidence directory. No tests or assertions were removed.
- **Verification:** confirm the new CI logs show no `visual-agent.spec.ts` in the core suite and that the dedicated Visual Agent gate executes once to completion.

### RB-024 — Role/context gate repeats the exhaustive route matrix at every viewport
- **Status:** IN PROGRESS — exact-HEAD CI verification pending
- **Priority:** P1
- **Area:** CI reliability / RBAC / responsive release evidence
- **Finding:** `role-design-gate.spec.ts` ran the same full declared/discovered-route authorization and DOM audit for all 16 roles in each of eight viewport projects. Its route discovery also waited 100+250+500+1000 ms before reads even when the first DOM read succeeded. This multiplied thousands of unnecessary navigations; run `39339294547` showed the role/context step still in progress after core E2E, browser UX and mobile gate had completed.
- **Fix on branch:** keep the exhaustive role, route, anonymous-access and cross-tenant checks once at `role-1280`; run role-specific critical-screen layout/DOM/accessibility audits and retain per-role/per-viewport screenshots on all remaining viewport projects; skip duplicate viewport-independent IAM/tenant/anonymous assertions; retry route discovery only after an SPA context-destroyed error.
- **Coverage preserved:** mobile design gate and Visual Agent remain separate; the visual release manifest still receives its required role screenshot for every viewport. The 36px interactive-control threshold and authorization assertions are unchanged. The CI already specifies a 60-minute E2E job timeout and that bound remains in place.
- **Remaining:** verify the new exact HEAD completes core E2E, browser UX, mobile, role/context, Visual Agent, business-owner and organization-owner gates; inspect the compact failure summary before resolving this blocker.

### RB-025 — Role gate exposed auth/route and responsive UI regressions
- **Status:** IN PROGRESS — exact-HEAD CI verification pending
- **Priority:** P0
- **Area:** IAM / RBAC / responsive release gate
- **Observed:** role/context gate on `7946381` failed because `/community` is an intentionally unguarded public feed but was classified as forbidden by the test policy; E2E STUDENT fixture `regular@test.com` was redirected to `/ai` instead of its `/school` workspace; and responsive controls had the undersized/clipped issues recorded under RB-003.
- **Fix on branch:** explicitly classify Community as public and add an anonymous-feed smoke check; student/regular/learner accounts with a student effective role land on School, while partner contexts whose base DB role is STUDENT continue to honor their scoped `effectiveRole`; allow role tests to report independently and preserve failure screenshots; keep the 36px release assertion unchanged.
- **Latest exact-HEAD evidence:** run `39355354936` at `470498beb379d32775497cda00bfe8a39eefe157` completed the role/context job but failed 87 test attempts. The failures cluster into four areas: brittle requirement for the literal `DentVision` string on valid authenticated workspace/consent screens; generic/missing visible role labels for `superadmin` and the clinic lab fixture; support routed to `/ai`; and WebKit runtime errors associated with requests to `localhost:3001`. Other gates in that run passed, but the overall CI job failed.
- **Follow-up fixes on branch:** entry-screen checks validate authenticated rendered content and reject a login redirect instead of requiring brand text on every workspace; generic role labels fall back to the resolved active/effective/global role; `superadmin`, `support`, and `developer` land in the platform admin workspace; the CI browser API target uses IPv4 loopback to remove localhost IPv4/IPv6 ambiguity.
- **Latest exact-head evidence:** run `39970030360` on `f681f4b8f0784a1f8553da5612c58634593b2ab9` completed and failed 58 role-gate attempts. Many repeated WebKit failures share the RB-031 access-control cluster. The owner identity surface displayed `Руководитель` while canonical `docs/DENTVISION_IAM_ROLE_MATRIX.md` specifies OWNER — `Владелец`. Visual Agent separately failed three attempts because of undersized controls tracked under RB-003.
- **Follow-up in current candidate:** align CI loopback hostnames, use the canonical `Владелец` label for the owner role without changing permissions, and fix shared Button `asChild` class forwarding plus the diagnostics action target size. Exact-head verification is pending.
- **Remaining:** rerun role/context, Visual Agent and visual evidence validation on the same final SHA; verify visible role labels, public/protected route matrix, cross-tenant/branch isolation and per-role/per-viewport evidence. Do not close until exact-head gates pass.

### RB-026 — Playwright CLI smoke never reaches browser checks
- **Status:** IN PROGRESS — exact-HEAD workflow verification pending
- **Priority:** P1
- **Area:** CI / browser verification
- **Observed:** workflow `39341057868` installed `@playwright/cli` locally but then invoked it through `npx playwright-cli`, which returned `npm error could not determine executable to run`; the skills command also used the unsupported `--skills=agents` argument.
- **Fix on branch:** install the official CLI globally in the ephemeral GitHub runner, call its `playwright-cli` binary directly, and use `playwright-cli install --skills`. The browser smoke routes and application-error assertions are unchanged.
- **Source:** [official Playwright CLI documentation](https://playwright.dev/docs/getting-started-cli) and [official repository](https://github.com/microsoft/playwright-cli).
- **Remaining:** ensure the exact-head workflow completes CLI install, skills, real browser login/navigation smoke and visual evidence validation.

### RB-027 — Role/context gate test file does not parse
- **Status:** IN PROGRESS — exact-HEAD verification pending
- **Priority:** P0 for release verification
- **Area:** CI / IAM / release evidence
- **Observed:** CI run `39345487645` failed before the role/context matrix could execute. `e2e/tests/role-design-gate.spec.ts` had an unclosed `auditRoute` function before the partner-context test, producing a parser error at EOF. The visual evidence gate then failed because the expected role screenshots were absent.
- **Fix on branch:** commit `f479ebce86694e134a631a4fe076b1ca367debea` closes the function before the next test declaration.
- **Verification:** exact-HEAD CI must show the role/context tests actually execute and produce the required role/viewport screenshots; the downstream visual release gate must then pass. Do not close based on the syntax fix alone.

### RB-028 — Visual Agent expects the wrong student entry route
- **Status:** IN PROGRESS — exact-HEAD verification pending
- **Priority:** P1
- **Area:** Role-aware onboarding / Visual Agent
- **Observed:** Visual Agent failed for `regular@test.com` because the test expected `/ai` while the authenticated response reported effective role `STUDENT` and the application correctly routed to `/school`.
- **Fix on branch:** commit `d0d4d10798b0b4873f14e6028988d84425ed8923` updates the fixture's expected entry route to `/school` without changing application behavior.
- **Verification:** exact-HEAD Visual Agent must complete all role/viewport journeys; preserve the student workspace assertion.

### RB-029 — Patient clinical history JSON is not encrypted at rest
- **Status:** OPEN — implementation gap confirmed on current main by source inspection
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Evidence:** Current main HEAD `b27f9b920ee08388dfb560c4ad0ff6243f461844`. `dentvision-backend/src/lib/phi.ts` blob `da64d8174962a4ee52ac7c45d44f77a8789e8d89` encrypts `medicalHistory` only when the value is a string. `dentvision-backend/src/modules/patients/patients.routes.ts` blob `c6f544c8e0a66e45daa0db3d26bdbb32b7a2ba75` merges history as an object and persists it as `Prisma.InputJsonValue`; serialization reads that object directly.
- **5 Why / root cause:** clinical history is stored as JSON → the encryption helper handles strings only → canonical writes persist structured objects directly → readers/AI/report consumers expect an object → no versioned encrypted representation, full consumer inventory or audited backfill exists.
- **Risk:** allergies, clinical notes, categories, source metadata and tooth/clinical details may remain readable in database backups or dumps. Phone, email, address and notes also need an explicit threat-model decision.
- **Owner:** Backend/data security, with clinical-domain review.
- **Next action:** map all Patient write/read paths, filters, reports, AI context, portal, export and integrations. Design a versioned encrypted-at-rest representation with an audited, resumable backfill, dry-run, progress counts, integrity checks, legacy compatibility and rollback. Do not encrypt the JSON column blindly.
- **Dependencies:** consumer inventory and key lifecycle decision must precede schema/backfill changes.
- **Closure criteria:** persisted sensitive values are not plaintext; authorized API responses preserve structured history; tenant/branch isolation holds; legacy rows remain readable during migration; missing/wrong keys fail closed; dry-run and rollback are tested. No production backfill or key rotation is claimed.

### RB-030 — Offline appointment queue privacy redaction may drop required sync fields
- **Status:** OPEN — behavior requires end-to-end verification
- **Priority:** P1
- **Area:** Offline schedule / data integrity / privacy
- **Evidence:** `src/lib/syncQueue.ts` sanitizes queue payloads before persistence and removes patient names, phone, notes, diagnosis and other fields; `flushSyncQueue` later submits the sanitized payload to `api.upsertAppointment`. This protects localStorage from PHI but may silently turn an offline edit into a partial appointment update if the API requires any redacted field.
- **Required fix:** verify the exact upsert contract and define an explicit offline-safe payload containing only durable IDs and editable non-PHI fields, or move the sensitive queue to an appropriately encrypted storage mechanism with a key lifecycle. Never reintroduce plaintext PHI to localStorage to make sync pass.
- **Verification:** E2E must create/edit an appointment offline, reconnect, flush, and verify server-side state and patient association without storing patient names, contact data, clinical notes or raw errors in browser storage.

### RB-031 — WebKit role-gate API calls fail with access-control/network errors
- **Status:** IN PROGRESS — exact-HEAD verification pending
- **Priority:** P1
- **Area:** CI browser compatibility / API connectivity
- **Observed:** run `39355354936` passed Chromium-based core E2E, Browser UX and mobile design, but the WebKit responsive role gate collected repeated page errors for `/api/guest/session` and `/api/ai/proactive` when calling `http://localhost:3001`. They are counted as runtime errors and must not be suppressed as harmless noise.
- **Follow-up:** CI's browser-facing API base was switched to `http://127.0.0.1:3001` so WebKit is not dependent on how `localhost` resolves inside the runner. The page origin remains `http://localhost:3000`, which is explicitly allowed by the development CORS policy.
- **Latest exact-head evidence (2026-10-23):** run `39970030360` on `f681f4b8f0784a1f8553da5612c58634593b2ab9` still failed the role/context gate. WebKit reported page errors for `/api/guest/session` and `/api/ai/proactive` at `http://127.0.0.1:3001` due to access-control checks. The browser page origin remained `http://localhost:3000`; changing only the API host did not establish a consistent loopback-origin setup. CORS failures remain real failures; do not suppress the collector.
- **Follow-up in current candidate:** align the CI page origin to `http://127.0.0.1:3000`, keep the API at `http://127.0.0.1:3001`, update direct probes to use the same API base, and leave production CORS rules unchanged.
- **Remaining:** exact-head CI must show no WebKit page/request/server errors and explicit CORS policy tests must pass. If it fails, inspect the exact request/OPTIONS response headers and browser console before changing policy.

### RB-032 — Successful-path E2E DOM dumps inflate role/visual artifacts
- **Status:** IN PROGRESS — artifact policy corrected in the follow-up; exact-HEAD verification pending
- **Priority:** P1
- **Area:** CI reliability / E2E evidence / developer-agent efficiency
- **Evidence:** the role matrix persisted full `body.outerHTML` and page text for every permitted route under `e2e/visual-evidence/.../roles`, while CI uploaded that directory on successful runs. Mobile/Visual Agent tests also wrote complete HTML snapshots into successful evidence. This duplicated route state, increased artifact size/count, and violated the failure-only diagnostic policy.
- **Required fix:** keep all browser/role/tenant/branch/viewport assertions and release-required screenshots; limit successful artifacts to screenshots, compact runtime/geometry/accessibility data, and bounded text at meaningful checkpoints. Full DOM snapshots and traces must be failure-only. Replace unconditional sleeps with state-based waits without suppressing errors or widening allowed routes.
- **Verification:** on the same exact HEAD, confirm all selected tests execute; role/context, Visual Agent, business-owner, organization-owner, mobile/responsive and visual-release gates pass; the manifest confirms no successful-path HTML dumps and a bounded artifact footprint. Leave open until this evidence exists.

- **Latest artifact evidence (run `39970030360`):** aggregate `playwright-artifacts` was 186,463,087 bytes and `playwright-traces` was 175,929,159 bytes, while compact diagnostics were 2,548 bytes. This run had 58 role-gate failures plus three Visual Agent failures, so failure-only traces are large but are the current evidence. Preserve them; do not delete traces or reduce coverage. After root-cause fixes, re-check the successful-path artifact manifest and whether retries generate redundant failure traces.

### RB-033 — Main branch protection and required release checks are disabled
- **Status:** OPEN — branch metadata confirms protection is disabled
- **Priority:** P0
- **Area:** Release governance / CI enforcement
- **Evidence:** GitHub `GET /repos/drtamirlan911-cell/DentVision1/branches/main` returned `protected: false` on 2026-10-25. The detailed protection endpoint was not accessible through the current connector in this run; prior audit evidence recorded enforcement off and no required contexts. Existing issue #259 describes the same control gap.
- **5 Why / root cause:** direct pushes can bypass release checks → branch protection is not enabled → required-check policy is not enforced → repository settings do not encode the release contract → release governance depends on operator discipline.
- **Risk:** unverified or insecure commits can reach main without mandatory checks, including tenant isolation, PHI, payment and visual gates.
- **Owner:** Repository administrator (manual settings action).
- **Next action:** enable protection/rules for `main`, require PR-based changes and the exact stable checks reported by GitHub (`quality`, `lint-test`, `frontend-lint`, `backend-lint`, `e2e`, and Android where applicable). Do not guess check names.
- **Dependencies:** administrator access to repository settings and a stable check-name inventory.
- **Closure criteria:** GitHub reports protection enabled and required checks enforced; a test PR proves a failed required check blocks merge. The current connected interface cannot apply this settings change, so it remains a manual admin action.

### RB-034 — AI DoctorAgent cross-tenant patient/appointment IDOR
- **Status:** IN PROGRESS — fix is merged to main; exact-head full verification pending
- **Priority:** P0
- **Area:** AI / Clinical Privacy / Tenant Isolation / IDOR
- **Evidence:** PR #310 merged at `f1276fdb9ab2d7761f7e6c3f77e82eff752ac835`; current main HEAD is `b27f9b920ee08388dfb560c4ad0ff6243f461844`. Current main `doctor.agent.ts` blob is `197ee6a44dfb4ffa4c3b38c4789982c182dd04a9`; `doctor.agent.security.test.ts` blob is `48260a3935274783216c134d5c7c3ea2b4586702`.
- **Root cause (5 Why):** AI parameters accept patient/appointment IDs → legacy handlers queried/updated by primary key alone → clinic scoping was inconsistent across intents → ownership depended on upstream routing rather than a data-boundary check → negative cross-tenant regression coverage was absent.
- **Candidate remediation now on main:** clinic-scoped patient/appointment reads; fail-closed when a clinic-bound intent lacks active clinic context; patient ownership before appointment creation; appointment completion constrained by ID + clinicId + patientId.
- **Risk:** a guessed/foreign ID could expose patient name, clinical context and decrypted IIN, or mutate another clinic's appointment.
- **Owner:** AI/backend security + clinical workflow QA.
- **Next action:** complete exact-main CI/E2E and inspect DoctorAgent negative-path tests and the role/context gate. Main run `40165707260` had lint-test/frontend/backend lint passing but E2E still in progress at the 2026-10-25 10:53 checkpoint; Quality Gate `40165707211` passed. Do not close based on merge or Quality Gate alone.
- **Closure criteria:** foreign patient/appointment IDs are denied and same-tenant operations remain valid; targeted tests, TypeScript/lint/unit checks and full role/context E2E pass on exact main SHA; no patient or appointment data crosses tenant boundaries.

### RB-035 — Clinic payment refund over-authorization
- **Legacy ID:** RB-010 on branch `fix/release-blockers-20261006`; remapped to RB-035 because the security-hardening register already uses RB-010 for a different blocker.
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / RBAC / Payment safety
- **Observed:** `POST /api/payments/:id/refund` treated any authorized clinic member as a sufficient owner for clinic-scoped payments.
- **Risk:** clinical staff with payment visibility, including roles without `billing.manage`, could reach a financial reversal mutation.
- **Fix:** clinic refund access now resolves the user's role in the exact clinic and requires canonical `billing.manage` permission; organization access alone is insufficient.
- **Regression:** payment refund test now checks the route uses the scoped `billing.manage` boundary.
- **Verification:** static exact-file inspection passed; fresh CI/E2E is still required for closure.

### RB-036 — Clinic domain ID used as canonical organization ID in Diagnostics
- **Legacy ID:** RB-011 on branch `fix/release-blockers-20261006`; remapped to RB-036 because the security-hardening register already uses RB-011 for a different blocker.
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Diagnostics / IAM / Tenant scope
- **Observed:** referral authorization passed domain `Clinic.id` directly to `assertOrgAccess`, while canonical IAM uses `Organization.id` and stores the source Clinic.id in `originalId`.
- **Risk:** valid clinic-scoped referral workflows could fail after canonicalization.
- **Fix:** added shared `assertClinicOrgAccess` translation with legacy fallback and switched diagnostics referral authorization paths to it.
- **Regression:** `orgContext.test.ts` covers canonical/legacy mapping; diagnostics contract test locks the referral boundary.
- **Verification:** static inspection passed; fresh exact-head CI/E2E remains required.

### RB-037 — SaaS subscription payment can target an arbitrary clinic
- **Legacy ID:** RB-012 on branch `fix/release-blockers-20261006`; remapped to RB-037 because the security-hardening register already uses RB-012 for a different blocker.
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Subscription / IDOR
- **Observed:** generic payment creation accepted `refType=subscription`, arbitrary clinic `refId`, client `saasPlan` and `months` without scoped clinic billing authorization or exact tariff reconciliation.
- **Risk:** a crafted payment could be settled against another clinic and activate its SaaS subscription.
- **Fix:** subscription payment creation now requires `assertClinicBillingAccess` for the target clinic, accepts only paid catalog plans, validates integer months 1–24, and requires exact server-derived tariff total. Settlement repeats the tariff/amount invariant.
- **Regression:** payment settlement tests cover tampered subscription amount; source contract covers creation-time billing and tariff guards.
- **Verification:** fresh exact-head CI/E2E required before closure.

### RB-038 — Clinic-cash payment creation lacks financial permission and ref scope
- **Legacy ID:** RB-013 on branch `fix/release-blockers-20261006`; remapped to RB-038 because the security-hardening register already uses RB-013 for a different blocker.
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Payments / RBAC / Tenant integrity
- **Observed:** clinic-cash payment creation used clinic membership as sufficient authorization and accepted client-supplied appointment/invoice refs without proving they belonged to the selected clinic.
- **Risk:** ordinary clinical members could initiate money-state changes; a finance user could bind a payment to a cross-clinic appointment/invoice.
- **Fix:** clinic cash requires scoped `billing.manage`; appointment refs must belong to the active clinic; invoice refs must belong to the active clinic and the payment cannot exceed the outstanding invoice balance.
- **Regression:** payment route contract locks the billing guard and clinic/ref/amount checks.
- **Verification:** fresh exact-head CI/E2E remains required.

### RB-039 — Lecturer context token uses non-canonical organization type
- **Legacy ID:** RB-014 on branch `fix/release-blockers-20261006`; remapped to RB-039 because the security-hardening register already uses RB-014 for a different blocker.
- **Status:** FIXED — pending exact-head CI/E2E verification
- **Priority:** P1
- **Area:** Identity / Workspace Context / Academy
- **Observed:** `POST /api/iam/switch-context` for `scopeType=LECTURER` emitted `organizationType=LECTURER`, while canonical Academy organization context is `ACADEMY`.
- **Risk:** content-policy resolution and frontend workspace logic could classify an explicitly selected lecturer workspace as a different role/context.
- **Fix:** lecturer switch-context now emits the canonical Academy organization type while preserving lecturer scope/identity.
- **Regression:** `ACADEMY-012` switches a real lecturer context and asserts `organizationType=ACADEMY`, canonical `organizationId`, `organizationOriginalId`, and `lecturerId`.
- **Verification:** local backend TypeScript passes; exact-head E2E required before closure.

### RB-040 — Support center does not enforce clinical-data minimization server-side
- **Status:** OPEN — candidate-only privacy gap found during integration review
- **Priority:** P1
- **Area:** Support / PHI minimization / Access control
- **Evidence:** Candidate support routes and Prisma models store unrestricted `SupportTicket.description` and `SupportTicketMessage.body` text. The UI warns users not to submit medical data or passwords, but no server-side content policy or retention rule was found in the support request path. This first version has no attachment endpoint.
- **Risk:** a user can paste patient identifiers, clinical notes or other sensitive information into a platform-wide support conversation that support staff can read.
- **Owner:** Support backend + privacy/security.
- **Next action:** define a support-data classification/retention policy; add server-side validation or redaction for obvious sensitive identifiers without silently altering legitimate requests; audit privileged reads/updates; retain the no-attachment constraint and explicit UI warning.
- **Dependencies:** privacy policy decision and support-staff access matrix.
- **Closure criteria:** API tests prove sensitive payload handling is enforced; only authorized support staff can access other users' tickets; requester isolation remains intact; privileged access is audited; retention/deletion behavior is documented.

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

