# DentVision — Release Blockers & Deferred Work Register

> Canonical working register for issues discovered during autonomous audit/release work. Items remain open until verified by tests/evidence.

## Audit follow-up — 2026-10-29 (DentVision1 main audit D1–D10)

This entry supersedes stale source-level claims below where explicitly noted, but does not close items that require live database, deployment, provider, branch-rule or end-to-end evidence.

### Implemented on candidate branch `fix/d1-d10-trial-archive-signing-api-20261029`

- **D1 — Trial and expiry:** both supported clinic-creation paths now create an Enterprise `trialing` subscription with `periodEnd = now + TRIAL_DAYS`; a backfill migration assigns legacy `DEMO` clinics without subscriptions a 30-day period from `clinics.createdAt`. Expiry marks the subscription `expired` without setting `Clinic.active = false`; designated read routes remain available and clinic write-gate middleware rejects writes. Public booking and public document signing also check expiry. Do not mark the release condition closed until migrations are applied on staging and post-expiry positive-read/negative-write tests pass.
- **D2 — Organization archive:** archive is a soft update to `Organization.archivedAt` plus archived lifecycle metadata. It does not delete or deactivate the linked `Clinic`, branches, members, documents, patients or audit history. Active-context resolution and the workspace switcher reject archived contexts; an already issued token cannot continue using the archived context but may switch to another active context.
- **D3 — Document signing:** staff API helpers now target `/api/files/documents/:id/...`; public sign links now use `/sign/:token`, matching the frontend route and token lookup.
- **D4 — Frontend routes:** the legacy `/register` URL redirects to the existing registration flow at `/login?register=1`; the listed canonical `/medical/*` and `/admin/*` paths now redirect to existing permission-guarded CRM, settings, billing, audit, security or backup screens. These aliases restore URL reachability without duplicating implementations, but the final screen-by-screen workflow matrix is still needed to prove functional equivalence.
- **D6 — Supplier delivery zones:** the four standalone helpers now use `apiRequest` and pass HTTP verbs in request options rather than as the supplier bearer token.
- **D7 — Auth route ownership:** the current router mounting shows `/api/auth/invitations` and `/api/iam/invitations` serve different invitation models and scope contracts; this is not evidence of duplicate handlers that can safely be deleted.
- **D8 — Schema/migration:** the candidate adds nullable `Organization.archivedAt`, an index, and timestamped SQL migrations. Neither migration has been applied to a live PostgreSQL database in this audit.
- **D9 — Verification:** prior main-branch CI evidence is not evidence for this candidate. New branch CI and a non-cancelled E2E run are required before merge.

### Still open pending evidence/ownership

- **D5 / RB-029, RB-013, RB-018, RB-033 / payments:** production PHI backfill must be run and audited; production CORS/WS configuration and external WebSocket server authentication must be checked; GitHub branch protection requires repository-admin verification; official Kaspi integration requires the merchant-issued API contract and live callback verification. Static source review alone cannot close these.
- **D10 — Master Spec and deployment:** a complete route/workflow matrix for all cabinets and all sections of the Master Spec, plus production environment and end-to-end verification, remains outstanding. This branch fixes specific confirmed defects rather than claiming every workflow is release-verified.

## Candidate verification follow-up — 2026-10-30

- Candidate: PR [#330](https://github.com/drtamirlan911-cell/DentVision1/pull/330), branch `fix/d1-d10-trial-archive-signing-api-20261029`. No merge or production operation was performed.
- **D1 idempotency defect found during post-implementation review:** `POST /api/auth/demo-clinic` looked only for an active OWNER clinic with `plan = DEMO`, but the shared clinic-creation service now creates `ENTERPRISE` + `trialing`, and the legacy migration upgrades eligible DEMO rows to ENTERPRISE. Repeated calls could therefore create another clinic/trial. The lookup now accepts both DEMO and ENTERPRISE, preserving legacy compatibility and the 30-day trial identity. Code commit: `c83cbd010f59399d4d1647366f3a6752e8e892a6`.
- **IAM regression contracts:** the failing mocks were stale relative to archive-aware `organization.findFirst` lookups and the canonical-Person fail-closed rule. Tests now mock both lookups, reject archived Organization/Clinic access even when a legacy ClinicMember row exists, and assert a roleless canonical Person cannot fall through to an unrelated legacy membership. Commit: `e6c3147604f21acf0bf8766048f802540c54c015`.
- **Trial contract test:** replaced the obsolete expectation that self-service clinic creation remains DEMO with assertions for Enterprise/trialing/30-day semantics and DEMO/ENTERPRISE idempotency. Commit: `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1`.
- **Prior exact candidate CI:** [run 40870315832](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40870315832), PR merge ref `51a4e1f8dcc53b6284932127f482ccbb48d46c80`, head `469b32d3403614a67151b649de9bf73f03ef9d15). Frontend/backend lint passed; Quality Gate and RB-034 context diagnostic passed. Unit tests: 2,301 passed, 4 failed across two files (the test contracts addressed above). E2E overall job was cancelled; core had 240 passed / 5 skipped / 1 failed (BRANCH-003 picker option outside viewport), Browser UX had 3 passed / 1 failed (403 resources on `/crm/patients` and `/crm/treatment-plans`), and mobile design passed 16/16. The compact diagnostics, core checkpoint and Browser UX checkpoint were inspected; full successful-path DOM/trace artifacts were not ingested.
- **Related PR #328 is not yet a validated fix:** its own CI run [40843992280](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40843992280) failed backend lint at `planGate.ts(102,51)` (`_res` is undefined) and one stale `crm.routes.security.test.ts` assertion; E2E was cancelled. Do not treat its picker/403 work as green or copy it blindly.
- **PR #329 / RB-029:** Quality Gate and lint/unit jobs passed on its head, but E2E was cancelled. The RB-029 inventory document still reflects the earlier source-only state; the open #329 candidate adds the structured-envelope portal writer fix. Full downstream consumer/concurrent-writer audit, backup/rollback review, staging dry run and approved backfill remain open.
- **D5 / Kaspi:** `docs/KASPI_CLINIC_SETUP.md` explicitly labels the sample HMAC callback as DentVision's adapter contract for a compatible third-party gateway, not the official Kaspi Pay/acquiring contract. Direct integration remains unverified until the merchant-issued technical specification and live callback are checked. Clinic-cash manual confirmation must never confirm platform SaaS/Academy/Shop payments.
- **D9/D10 remain OPEN.** The new exact-head CI after these commits is pending. Both migrations remain unapplied to staging; no live DB/backfill, production CORS/WebSocket inspection, official Kaspi verification, branch-protection proof, full Master Spec workflow matrix or deployment has been performed.

### Exact-head candidate follow-up — 2026-10-30

- Exact-head CI [41004898403](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898403) on pre-correction PR #330 HEAD `6b02e31eba480084ba57d481b130fcafafe037f5`: lint/build/type/system-map, Quality Gate [41004898300](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898300) and RB-034 diagnostic [41004898478](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898478) passed; unit suite failed 10/2,326 (2,316 passed). Three failures were stale source-contract assertions; seven were referral-access test fixtures omitting Express `req.method`. Candidate corrections preserve the runtime expiry and tenant-access gates; exact-head rerun is required.
- IAM source review found generic `admin` / `org_admin` in the organization archive allow-list despite the canonical IAM matrix describing ADMIN as a daily operational role, not owner governance. The candidate restricts archive to scoped owner-level roles and adds a regression contract. Do not close until exact-head tests pass.
- E2E run 41004898403 is **not passed**: core 240 passed / 5 skipped / one BRANCH-003 viewport timeout; browser UX 3 passed / one failure with 403 resources on `/crm/patients` and `/crm/treatment-plans`; mobile design gate succeeded with 15 passed / one flaky WebKit navigation; role/context was cancelled and downstream gates skipped. The failing API request URLs behind the 403s were not captured in the compact artifact. Preserve the security assertion and investigate the actual endpoints. BRANCH-003 belongs to the separately maintained PR #328; do not copy that branch without its own verification.
- Compact evidence inspected: artifact 12956934527 (2,249 B), 12954883562 (7,605 B), 12956065610 (10,396 B). Bulk traces/HTML/screenshot packages were not ingested.
- Parallel PRs were preserved: #328 open at `966512b54a2937472732e2c94d23fd819de2edb0` (CI failed, Quality Gate passed); #329 open at `c2e5951ba631da1762bd3380c3bbc35c51953770` (CI cancelled, Quality Gate passed); #322 open draft. No sibling branch edits.
- D9 remains OPEN; D10 remains OPEN. No staging/production migrations, PHI backfill, production CORS/WebSocket or official Kaspi verification was performed. Release remains NOT READY.


## Open

### RB-029 — Patient clinical history JSON is not encrypted at rest
- **Status:** OPEN — versioned application-layer encrypted JSON envelope and compatibility paths implemented on the current candidate; staging dry run and release verification remain outstanding
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Evidence:** the static inventory [`docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md`](security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md) found 58 explicit `medicalHistory` references across 23 files and 85 textual Prisma Patient ORM-call lines across 33 backend paths. The candidate adds a versioned `__dentvisionEncryptedV1` JSON envelope, decode-before-read/merge, encrypt-before-write for canonical Patient CRUD and odontogram paths, and decoding in AI tool/event consumers. The Prisma JSON column is unchanged.
- **Compatibility / migration:** legacy plaintext JSON and the previous patient-portal scalar `ENC:` format remain readable during rollout. The guarded `db:backfill:medical-history` command defaults to dry-run, performs a complete preflight, validates existing ciphertext, and uses bounded JSONB compare-and-set updates; production writes require explicit matching target confirmations. It is not called at startup.
- **Risk:** until a backfill runs against an explicitly verified target, existing structured history rows may remain plaintext at rest. Phone, email, address and notes also remain searchable plaintext fields by current design and require a separate documented threat-model decision.
- **Required fix:** complete the audit of all readers, writers, filters, exports/reports, AI/event copies, portal/odontogram/cross-clinic consumers and concurrent legacy writers; review a backup and rollback plan; run a read-only staging dry run; verify count/round-trip/integrity reconciliation before any approved write.
- **Verification:** focused PHI/odontogram/backfill tests passed 63/63 on an earlier candidate, not this merged exact head. Fresh exact-head CI and consumer/security review remain required. No production database query, backfill, schema migration or deployment has been performed.
- **Patient-history API write-boundary follow-up (candidate branch `security/rb029-patient-portal-history-envelope-20261026`, code commit `2368ff723efd5ea02349fd39dfec47c6ff87360e`):** the Portal profile writer previously coerced structured JSON into a string, and the canonical Patient create/upsert + PATCH writers also needed to reject caller-supplied root `ENC:` ciphertext / `__dentvisionEncryptedV1` envelopes. The candidate uses `encryptMedicalHistory` for Portal writes and a shared input guard at all three HTTP write boundaries, with regression coverage. Follow-up also minimizes the complaint narrative in durable PatientCreated AI events and rejects malformed reserved envelopes when decryption keys are unavailable. Exact-head CI and the broader reader/writer/concurrency, backup/rollback, and staging dry-run review remain pending. RB-029 remains OPEN; no database read/write, backfill, or deployment was performed.
### RB-030 — Offline appointment queue privacy redaction may drop required sync fields
- **Status:** OPEN — behavior requires end-to-end verification
- **Priority:** P1
- **Area:** Offline schedule / data integrity / privacy
- **Evidence:** `src/lib/syncQueue.ts` sanitizes queue payloads before persistence and removes patient names, phone, notes, diagnosis and other fields; `flushSyncQueue` later submits the sanitized payload to `api.upsertAppointment`. This protects localStorage from PHI but may silently turn an offline edit into a partial appointment update if the API requires any redacted field.
- **Required fix:** verify the exact upsert contract and define an explicit offline-safe payload containing only durable IDs and editable non-PHI fields, or move the sensitive queue to an appropriately encrypted storage mechanism with a key lifecycle. Never reintroduce plaintext PHI to localStorage to make sync pass.
- **Verification:** E2E must create/edit an appointment offline, reconnect, flush, and verify server-side state and patient association without storing patient names, contact data, clinical notes or raw errors in browser storage.


### RB-031 — WebKit role-gate API calls fail with access-control/network errors
- **Status:** OPEN — the latest completed exact-head run still reports WebKit access-control/page errors; the current IAM candidate does not change CORS policy, so closure is pending a fresh run and request/OPTIONS-header evidence
- **Priority:** P1
- **Area:** CI browser compatibility / API connectivity
- **Observed:** run `39355354936` passed Chromium-based core E2E, Browser UX and mobile design, but the WebKit responsive role gate collected repeated page errors for `/api/guest/session` and `/api/ai/proactive` when calling `http://localhost:3001`. They are counted as runtime errors and must not be suppressed as harmless noise.
- **Follow-up:** CI's browser-facing API base was switched to `http://127.0.0.1:3001` so WebKit is not dependent on how `localhost` resolves inside the runner. The page origin remains `http://localhost:3000`, which is explicitly allowed by the development CORS policy.
- **Latest exact-head evidence (2026-10-23):** run `39970030360` on `f681f4b8f0784a1f8553da5612c58634593b2ab9` still failed the role/context gate. WebKit reported page errors for `/api/guest/session` and `/api/ai/proactive` at `http://127.0.0.1:3001` due to access-control checks. The browser page origin remained `http://localhost:3000`; changing only the API host did not establish a consistent loopback-origin setup. CORS failures remain real failures; do not suppress the collector.
- **Follow-up in current candidate:** align the CI page origin to `http://127.0.0.1:3000`, keep the API at `http://127.0.0.1:3001`, update direct probes to use the same API base, and leave production CORS rules unchanged.
- **Remaining:** exact-head CI must show no WebKit page/request/server errors and explicit CORS policy tests must pass. If it fails, inspect the exact request/OPTIONS response headers and browser console before changing policy.

#### Follow-up — latest completed exact-head evidence (reviewed 2026-10-28)
- Run `40361059735` on `c06c1a02ad508d1ff07b94fd1c78ebab5e59307f` still failed the role/context gate. The runner uses UI origin `http://127.0.0.1:3000` and API base `http://127.0.0.1:3001`; the development CORS allowlist includes both loopback UI origins and the current workspace headers. This does not yet identify whether WebKit is rejecting a preflight/header, receiving an error without CORS headers, or hitting a network/route failure.
- Candidate `56ab3ecfe5d1f0d02cc8be00816151a69dd30dce` changes IAM page policy and anonymous test setup only; it does not claim to resolve RB-031. Inspect the next run's request/OPTIONS response headers and bounded console excerpt before changing CORS rules. Do not suppress the error collector or broaden production CORS.

#### Follow-up — WebKit request evidence (2026-10-30, run 41092300195)
- Inspected the failed role-mobile-safari traces. Many API requests returned HTTP 200 with `Access-Control-Allow-Origin: http://127.0.0.1:3000`, matching the page Origin. A smaller set of requests had no response status/headers (status -1), while the trace recorded `Load request cancelled` for guest-session and other in-flight requests.
- The failed request/page-error summary names `/api/ai/proactive` and related calls, but the trace does not yet establish a rejected preflight or a missing/incorrect CORS response header for those requests. Identical-origin API calls often succeed.
- **Status remains OPEN.** Do not broaden production CORS, suppress request/page errors, or classify these failures as harmless. Capture the exact failing request lifecycle/OPTIONS exchange on a fresh exact-head run and fix the actual cancellation/network cause.

### RB-032 — Successful-path E2E DOM dumps inflate role/visual artifacts
- **Status:** IN PROGRESS — artifact policy corrected in the follow-up; exact-HEAD verification pending
- **Priority:** P1
- **Area:** CI reliability / E2E evidence / developer-agent efficiency
- **Evidence:** the role matrix persisted full `body.outerHTML` and page text for every permitted route under `e2e/visual-evidence/.../roles`, while CI uploaded that directory on successful runs. Mobile/Visual Agent tests also wrote complete HTML snapshots into successful evidence. This duplicated route state, increased artifact size/count, and violated the failure-only diagnostic policy.
- **Required fix:** keep all browser/role/tenant/branch/viewport assertions and release-required screenshots; limit successful artifacts to screenshots, compact runtime/geometry/accessibility data, and bounded text at meaningful checkpoints. Full DOM snapshots and traces must be failure-only. Replace unconditional sleeps with state-based waits without suppressing errors or widening allowed routes.
- **Verification:** on the same exact HEAD, confirm all selected tests execute; role/context, Visual Agent, business-owner, organization-owner, mobile/responsive and visual-release gates pass; the manifest confirms no successful-path HTML dumps and a bounded artifact footprint. Leave open until this evidence exists.

- **Latest artifact evidence (run `39970030360`):** aggregate `playwright-artifacts` was 186,463,087 bytes and `playwright-traces` was 175,929,159 bytes, while compact diagnostics were 2,548 bytes. This run had 58 role-gate failures plus three Visual Agent failures, so failure-only traces are large but are the current evidence. Preserve them; do not delete traces or reduce coverage. After root-cause fixes, re-check the successful-path artifact manifest and whether retries generate redundant failure traces.

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


### RB-013 — Credentialed CORS allowlist must match deployment
- **Status:** OPEN — current source has a restrictive allowlist; actual production environment values have not been independently verified
- **Priority:** P0
- **Area:** API / Browser Security
- **Current evidence:** `dentvision-backend/src/lib/cors.ts` derives allowed origins from configured `CORS_ORIGIN`, `FRONTEND_URL` and explicitly scoped Vercel preview origins. The implementation rejects wildcard/invalid production origins and checks preview-team ownership. The stale claim that current code has a wildcard fallback is not supported by the source inspected for this audit.
- **Risk:** a production environment could still configure an unintended origin; code review cannot prove actual Render/Vercel runtime values.
- **Required next action:** inspect live production environment variables and run credentialed preflight tests against the real production and preview hostnames.
- **Closure criteria:** production values match approved origins, disallowed lookalike origins are rejected, and exact deployed CORS tests pass.

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
- **Status:** OPEN — official payment-provider contract not independently verified
- **Priority:** P1
- **Area:** Payments / External API
- **Finding:** public Kaspi partner documentation describes applying, signing a contract and then accepting payments, but the public pages reviewed do not publish the endpoint, authentication headers, response schema or callback-signature contract used by this platform adapter. The documented Shop API is a separate catalog/order integration and must not be treated as the online-payment API.
- **Implemented on branch:** outbound request timeout (8 seconds), redirect rejection, bounded 64 KiB response reads, cancellation of provider error bodies, generic error messages, and payment-amount safe-integer bounds.
- **Remaining:** verify the actual contract supplied to DentVision by Kaspi/provider, constrain production API base URL to its approved host(s), and validate status/amount/idempotency/callback semantics against that contract. Do not treat the generic HMAC callback scheme or the current `/api/v1/payments` path as officially compatible without primary contract evidence.
- **Primary sources reviewed 2026-10-20:** [Kaspi payment partnership](https://kaspi.kz/webpay/partnership) describes the application/contract onboarding route; [Kaspi Shop API guide](https://guide.kaspi.kz/partner/ru/shop/api/general/q3193) describes product/order operations, not the technical acquiring contract.

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

#### Follow-up — Academy course breadcrumb target (2026-10-30)
- Exact-head role gate run 41092300195 inspected the authenticated `/school/course/e2e` view and measured the visible `Academy OS` breadcrumb button at 92×16px across 11 role-1280 failures.
- The source button is the breadcrumb navigation back to `/school`. The follow-up sets a 36px minimum height and maintains the breadcrumb row alignment with internal horizontal padding and a matching negative left margin.
- The role gate's 36px minimum remains unchanged. Re-run the exact-head role and Visual Agent gates and inspect screenshots/DOM geometry before marking RB-003 fixed.

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

#### Follow-up — role-surface reconciliation (2026-10-28)
- Run `40361059735` on the previous PR #328 head failed the role/context gate for mismatches between the backend page set and the E2E role oracle: ASSISTANT Medical Card, clinic LAB patient CRM, read-only price list, partner referral queues, and the `/diagnostics/patients` alias. The same artifact showed anonymous storage access failing on the opaque initial origin.
- Candidate commit `56ab3ecfe5d1f0d02cc8be00816151a69dd30dce` restricts the ASSISTANT/LAB page surfaces, aligns the allowed price-list/referral-queue policy, maps the route alias, and fixes the anonymous setup without removing assertions. Exact-head CI is pending.
- Remaining in the previous artifact: owner/admin Clinic Settings unnamed controls and role-wide WebKit page/console errors. These remain blockers and must be fixed at their source.

### RB-007 — Mobile laboratory drawer visual regression
- **Status:** FIXED — pending CI visual recheck
- **Priority:** P0
- **Area:** Responsive navigation / Mobile UX
- **Evidence:** failure artifact contained 24 screenshots across laboratory owner/technician variants. On 390px screenshots the open drawer shared the bottom-navigation z-layer, leaving bottom navigation visible above/through the drawer; the drawer width also left a large uncovered content area; the header rendered duplicate DentVision wordmark text.
- **Fix:** mobile drawer now uses a wider bounded width, z-layer above bottom navigation/backdrop, modal interaction semantics, Escape close and body scroll lock; duplicate header wordmark text removed.
- **Verification:** inspect all 390/412px lab-role screenshots after CI and exercise open/close/Escape/outside-click/touch behavior.

### RB-008 — Academy lecturer without organization scope
- **Status:** PARTIALLY FIXED — production identity remediation remains open
- **Priority:** P1
- **Area:** Identity / Academy / Data integrity
- **Observed:** production unified-schema migration on 2026-09-29 reported one lecturer role without an organization scope and skipped its scoped PersonRole.
- **Runtime evidence:** migration completed successfully, but one lecturer was skipped because no Academy organization scope could be resolved.
- **Implementation hardening:** Academy course CRUD now accepts scoped `academy.manage` and requires an active Academy organization; E2E seeds a real scoped lecturer and rejects cross-Academy mutation.
- **Required:** identify the affected lecturer/academy relationship in production, restore the canonical Academy organization link if the source relationship is valid, then rerun/verify IAM context generation. Do not assign a synthetic tenant.

### RB-009 — Public catalog response vs authenticated catalog policy
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P1
- **Area:** Marketplace / Academy / Content access
- **Observed:** unauthenticated production calls return 200 but filtered catalog arrays (Marketplace data empty; Academy KPI counts populated while public course/event arrays are filtered).
- **Finding:** the canonical content-catalog response guard intentionally filters Marketplace/Academy items according to active authenticated content context.
- **Fix:** audience policy now applies to Academy course, webinar, live, office-course, textbook and commerce-registration routes. PUBLIC/PATIENT contexts cannot expose PROFESSIONAL-only Academy items or register them.
- **Regression:** Academy E2E verifies all four format catalog endpoints omit a PROFESSIONAL-only fixture from the public result set.
- **Verification:** exact-head CI/E2E still required; public 200 alone remains insufficient.

### RB-010 — Clinic payment refund over-authorization
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / RBAC / Payment safety
- **Observed:** `POST /api/payments/:id/refund` treated any authorized clinic member as a sufficient owner for clinic-scoped payments.
- **Risk:** clinical staff with payment visibility, including roles without `billing.manage`, could reach a financial reversal mutation.
- **Fix:** clinic refund access now resolves the user's role in the exact clinic and requires canonical `billing.manage` permission; organization access alone is insufficient.
- **Regression:** payment refund test now checks the route uses the scoped `billing.manage` boundary.
- **Verification:** static exact-file inspection passed; fresh CI/E2E is still required for closure.

### RB-011 — Clinic domain ID used as canonical organization ID in Diagnostics
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Diagnostics / IAM / Tenant scope
- **Observed:** referral authorization passed domain `Clinic.id` directly to `assertOrgAccess`, while canonical IAM uses `Organization.id` and stores the source Clinic.id in `originalId`.
- **Risk:** valid clinic-scoped referral workflows could fail after canonicalization.
- **Fix:** added shared `assertClinicOrgAccess` translation with legacy fallback and switched diagnostics referral authorization paths to it.
- **Regression:** `orgContext.test.ts` covers canonical/legacy mapping; diagnostics contract test locks the referral boundary.
- **Verification:** static inspection passed; fresh exact-head CI/E2E remains required.

### RB-012 — SaaS subscription payment can target an arbitrary clinic
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Subscription / IDOR
- **Observed:** generic payment creation accepted `refType=subscription`, arbitrary clinic `refId`, client `saasPlan` and `months` without scoped clinic billing authorization or exact tariff reconciliation.
- **Risk:** a crafted payment could be settled against another clinic and activate its SaaS subscription.
- **Fix:** subscription payment creation now requires `assertClinicBillingAccess` for the target clinic, accepts only paid catalog plans, validates integer months 1–24, and requires exact server-derived tariff total. Settlement repeats the tariff/amount invariant.
- **Regression:** payment settlement tests cover tampered subscription amount; source contract covers creation-time billing and tariff guards.
- **Verification:** fresh exact-head CI/E2E required before closure.

### RB-013 — Clinic-cash payment creation lacks financial permission and ref scope
- **Status:** FIXED — pending exact-head CI verification
- **Priority:** P0
- **Area:** Finance / Payments / RBAC / Tenant integrity
- **Observed:** clinic-cash payment creation used clinic membership as sufficient authorization and accepted client-supplied appointment/invoice refs without proving they belonged to the selected clinic.
- **Risk:** ordinary clinical members could initiate money-state changes; a finance user could bind a payment to a cross-clinic appointment/invoice.
- **Fix:** clinic cash requires scoped `billing.manage`; appointment refs must belong to the active clinic; invoice refs must belong to the active clinic and the payment cannot exceed the outstanding invoice balance.
- **Regression:** payment route contract locks the billing guard and clinic/ref/amount checks.
- **Verification:** fresh exact-head CI/E2E remains required.

### RB-014 — Lecturer context token uses non-canonical organization type
- **Status:** FIXED — pending exact-head CI/E2E verification
- **Priority:** P1
- **Area:** Identity / Workspace Context / Academy
- **Observed:** `POST /api/iam/switch-context` for `scopeType=LECTURER` emitted `organizationType=LECTURER`, while canonical Academy organization context is `ACADEMY`.
- **Risk:** content-policy resolution and frontend workspace logic could classify an explicitly selected lecturer workspace as a different role/context.
- **Fix:** lecturer switch-context now emits the canonical Academy organization type while preserving lecturer scope/identity.
- **Regression:** `ACADEMY-012` switches a real lecturer context and asserts `organizationType=ACADEMY`, canonical `organizationId`, `organizationOriginalId`, and `lecturerId`.
- **Verification:** local backend TypeScript passes; exact-head E2E required before closure.

### RB-034 — AI DoctorAgent cross-tenant patient/appointment IDOR
- **Status:** OPEN — P0 release blocker; current-main unit CI passed, but end-to-end role/context evidence is incomplete
- **Priority:** P0
- **Area:** AI / Clinical Privacy / Tenant Isolation / IDOR
- **Current baseline:** this remediation branch was created from `main` commit `ac913cc3389a294d0b135a852b035ddddb1018ca`. Current source scopes DoctorAgent patient/appointment queries to the active clinic and includes cross-clinic security regression tests. Historical candidate SHAs and CI run IDs below are records of those candidates only, not evidence for the present branch.
- **Risk:** an AI intent carrying a guessed/foreign ID could expose patient data or mutate another clinic's appointment if a handler lacks an ownership check. Frontend hiding is not a server-side boundary.
- **Required verification:** run full unit/type/lint checks and the dedicated IAM-context, cross-tenant negative and same-tenant control E2E suites on the exact proposed merge commit. Review artifacts for every critical role/context. Do not close based on a passing historical candidate.
- **Closure criteria:** fresh exact-head CI, full role/context gate and negative cross-tenant tests pass. Until then RB-034 remains OPEN and release remains NOT READY.
### RB-029 — Patient clinical history JSON encryption and legacy-row backfill
- **Status:** OPEN — current code supports structured encrypted history, but deployment/backfill evidence is outstanding
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Current source evidence:** `dentvision-backend/src/lib/phi.ts` supports a versioned `__dentvisionEncryptedV1` envelope for structured medical-history JSON and compatible decoding of legacy scalar ciphertext. Patient CRUD and odontogram paths use the helpers; focused tests cover structured objects and legacy compatibility. The older statement that the current helper encrypts only strings and writes objects plaintext is stale and must not be used as current-main evidence.
- **Remaining risk:** source changes do not prove historical rows in staging or production have been encrypted. Structured JSON may remain plaintext until the backfill is run against a verified target. Phone, email, address and general notes remain outside this particular field-level scope and need a separate threat-model decision.
- **Required next action:** run the documented dry-run against an explicitly verified staging target, review backup/rollback and integrity counts, then obtain owner approval for the target-specific write run. Inspect reports for zero remaining unencrypted legacy rows and validate authorized read/merge round trips.
- **Closure criteria:** exact-HEAD CI passes; the staging migration and reconciliation evidence is attached; production backfill is separately approved and verified before claiming production-at-rest completion. No production database operation is claimed here.
### RB-019 — Platform Kaspi API contract and network bounds
- **Status:** OPEN — official provider contract not independently verified
- **Priority:** P1
- **Area:** Payments / External API
- **Evidence:** `docs/KASPI_CLINIC_SETUP.md` currently shows a generic webhook shape for a configured clinic gateway. That sample is an internal adapter contract, not proof that the official Kaspi acquiring API uses the same endpoint, header, signature payload or status semantics.
- **Risk:** a provider mismatch can cause false payment confirmation, replay/race defects, duplicate settlement or production integration failure.
- **Required next action:** verify the provider-issued contract for the actual merchant/gateway; constrain production API base URLs to approved hosts; verify signature canonicalization, amount/currency, timestamp/replay protection, idempotency, status transitions, timeouts and bounded response parsing. Do not label generic HMAC behavior as official Kaspi compatibility without primary contract evidence.
- **Closure criteria:** contract evidence is retained, adapter semantics match it, and positive/negative callback tests pass on the exact target SHA.

### RB-033 — Main branch protection and required release checks
- **Status:** OPEN — current protection state could not be independently verified with the connected GitHub integration
- **Priority:** P0
- **Area:** Release governance / CI enforcement
- **Evidence:** the current session's branch-protection request was denied with HTTP 403 due to integration permissions. The older statement that this same request returned `protected: false` is historical evidence and has not been revalidated in this audit. Do not assume that main is protected or unprotected from the current read failure.
- **Risk:** without required checks and PR policy, unverified code may reach main; read permission failure leaves the actual control state unknown.
- **Required next action / owner:** repository administrator must inspect Settings → Rules/Branches and verify protection for `main`. Require PR-based changes and exact stable checks emitted by the current workflow; don't guess check names.
- **Closure criteria:** an authorized inspection confirms required protections and a test PR demonstrates a failed required check blocks merge.
### RB-006 — Vercel build rate limit
- **Status:** CLOSED — production deployment independently verified
- **Priority:** P1
- **Area:** Production deployment
- **Resolution:** current production deployment `dpl_DuniATXLbvea8NA521pCyVyg4p1N` is READY and is built from current `main` commit `5815fa931cc9603b0ec68fb59bf42d48169f24cc`.
- **Verification:** Vercel production deployment state is READY; Render production deployment `dep-daut9p2d2mec73fl53g0` is LIVE from the same commit. The blocker is no longer present on the current release.

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

## Operating rule
When a new blocker is discovered:
1. Add it here with a stable ID.
2. Keep it open until the root cause is fixed.
3. Record verification scenario/evidence.
4. Move it to Closed only with the fixing commit/run.

This file is the source of truth for deferred release blockers; they must not exist only in chat notes.


## Integration reconciliation — 2026-10-30

Parallel-branch evidence retained during integration; reconcile against the current source before closing any blocker.

### Preserved 328 branch change

### RB-035 — Patient API authorization, PHI serialization, IIN lookup and deposit boundary
- **Status:** IN PROGRESS — source guards are present on the current candidate; exact-head negative regression verification is pending
- **Priority:** P0
- **Area:** PHI / RBAC / tenant isolation / financial authorization
- **Current source evidence:** `GET /api/patients` and IIN lookup require `patient.read`; the IIN lookup is restricted to the active clinic via `scopedPatientWhere` and does not return cross-clinic identity/contact data. Full chart, history, images and treatment-plan reads use the clinical-chart permission guard; audit and assignment reads add their respective permissions. Patient serialization includes prepaid balance only when the caller has a billing permission. `POST /:id/deposit` explicitly requires `billing.write`, before clinic/branch-scoped patient loading.
- **Regression coverage:** existing negative E2E cases cover manager/assistant full-chart denial, clinic LAB denial for patient list/IIN lookup/full chart, and non-enumerating cross-clinic IIN behavior. This follow-up adds manager/assistant deposit denial with a before/after balance assertion and a LAB deposit-denial assertion. Exact-head CI must verify these cases before this blocker can be closed.
- **Remaining:** verify all direct read and mutation routes against the canonical IAM matrix, retain clinic/branch/assignment scope and field-level PHI redaction, and pass the exact-head negative tests. Do not close this blocker based on frontend page visibility or source inspection alone.


### Preserved 329 branch change

- **Derivative-PHI event minimization (candidate branch `security/rb029-patient-portal-history-envelope-20261026`):** PatientCreated's durable AI event and AI Employee task payload now contain only a patient ID and a complaint-presence boolean; actions re-read and decrypt the clinic-scoped Patient record in memory, and notification messages omit complaint text and patient names. This closes only that duplication path. Other clinical event payloads, AI transcripts, concurrency and full consumer audits remain open; RB-029 stays OPEN pending exact-head gates and an approved staging/rollback procedure.



## 2026-10-30 — Parallel candidate integration checkpoint

- PR #328 workspace-picker/role-access changes and PR #329 patient-history envelope changes have been integrated into the existing PR #330 candidate branch through history-preserving merge commits `091604d78d6457a0ae5e97a83ae96059c0dde945` and `a3138609fb147cbee0a8cfeab3ffd397ceb6212d`.
- Original PRs #328 and #329 remain open at their original heads; temporary integration PRs #331/#332 are closed as merged into the #330 working branch. `main` remains unchanged.
- RB-029 remains OPEN. The candidate now rejects caller-supplied legacy/envelope ciphertext at Patient create/update and Portal profile write boundaries, uses the shared structured JSON history encoder, guards concurrent writes with row-version predicates, and minimizes the PatientCreated event payload. These source-level changes do not close the remaining full consumer/concurrency audit, backup/rollback review, approved read-only staging dry run, count/round-trip/integrity reconciliation, or any required release gate.
- RB-035 remains OPEN for patient read-route authorization, PHI serialization, cross-clinic IIN lookup disclosure and patient-deposit billing authorization; the #328 UI/page-policy changes do not close these backend risks.
- Latest candidate HEAD after integration follow-up fixes: `415e4a9dc938de0d3c71cd6b795fd4f9c7f0e8cb`. Exact-head CI [41034452583](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452583) was pending at this checkpoint; Quality Gate [41034452312](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452312) and RB-034 diagnostic [41034452343](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452343) were in progress.
- No database migration/backfill, production write, or deployment was performed. D1/D2 staging verification, RB-029 staging work, D5 provider/production checks, D9 full CI/E2E, and D10 workflow parity remain open.



## E2E role/context follow-up — 2026-10-30

- Baseline [CI 41041393534](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41041393534) failed Role/context (103 passed, 37 failed, 28 skipped) and Visual Agent (45 passed, 3 failed). Core E2E, Browser UX, mobile design, business-owner and organization-owner lifecycle gates passed.
- Targeted fixes are implemented on the existing PR #330 branch: permission-aware query enablement, lab-specific read/status authorization, role-appropriate Lab UI actions, an accessible label for the diagnostic file input, and a deterministic Academy course fixture for the route matrix.
- **Not closed:** these fixes require a new exact-head CI/E2E run. The prior artifact also contained isolated `401 GET /api/auth/me` responses that still need diagnosis. Do not mark RB-035 or release readiness complete based on these changes alone.


#### Follow-up — role gate / Academy / Safari network evidence (2026-10-30)
- Run 41041393534 (https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41041393534), PR merge-ref artifact manifest identifies tested merge SHA ffd3bf805a2beebfd5a6ba2cc81818149ae5a681; associated PR head at that time was dec269318de4b7fd090d898315f7b58aaac63988. Historical evidence only, not current branch-head status.
- Role/Visual Agent network failures: role gate ended 103 passed / 37 failed / 28 skipped; Visual Agent 45 passed / 3 failed. Laboratory journeys repeatedly recorded HTTP 403 for GET /api/patients, /api/lab-orders, /api/medical/visits, /api/files, and CRM promotions/bookings/waiting-list. Visual Agent independently recorded repeated 403 console failures for Laboratory at desktop/tablet/mobile. Preserve as authorization/network defects; do not hide 403s or weaken collectors.
- Academy route evidence: the same role-gate artifact contains repeated 404 GET /api/school/courses/e2e for the Academy/School course fixture. A deterministic e2e course fixture was added later in the current branch; check fresh exact-head run before considering this resolved.
- Safari/WebKit: role-mobile-safari failed page-error assertions across multiple roles. The failure artifact contains WebKit requests rejected due to access control checks, including /api/guest/session, /api/iam/me/contexts, /api/ai/proactive, and diagnostics referrals. Treat as real browser/network failures until request, OPTIONS/preflight and response CORS headers prove otherwise. Do not suppress or broaden production CORS as workaround.
- School CTA size: user additionally reported the same Academy/School Course control measuring approximately 92×16 px. Historical textual diagnostics do not independently confirm this exact measurement or uniquely identify the control; treat as user-reported visual finding pending current screenshot/DOM geometry. RB-003 remains open and the 36px minimum interactive-target assertion remains unchanged.
- Current exact-head run: PR #330 HEAD fd0b34730c0f65877b18908353a3afdede94c22f; CI 41099779548 was still preparing E2E (container initialization; test steps not started) when inspected. Quality Gate 41099779415 passed; RB-034 diagnostic 41099779647 remained in progress. No current-head role/Safari result can yet be claimed.
- Required next verification: inspect fresh exact-head role and Visual Agent artifacts; confirm whether Academy e2e 404 is gone; record each request method, URL, status, failed-request reason, preflight status and Access-Control-Allow-* response headers for Safari; identify exact Academy control from screenshot/DOM geometry and correct its real interactive hit area. Keep RB-003, RB-025 and RB-031 open until exact-head tests pass.

## 2026-10-31 — D1 expiry lifecycle consistency follow-up

- Post-implementation audit found two remaining administrative subscription-update paths that contradicted the D1 read-only expiry contract: `upsertClinicSubscription()` and `POST /api/subscriptions` both set `Clinic.active = false` for `status='expired'`. The scheduled expiry cron itself correctly updates only `Subscription.status`; `resolveClinicAccess()` also treats expired subscription as an entitlement/write gate and restores legacy expired clinics to active tenancy state for reads.
- Added shared `clinicTenancyUpdateForSubscription()` so `status='expired'` updates the plan without touching `Clinic.active`; explicit `status='suspended'` still sets `active=false`, and renewal/trial states restore active tenancy. Both service and superadmin API use the same helper.
- Added runtime service tests for expired-versus-suspended state transitions and route contract coverage. No schema, migration, production data, PHI, Render environment or deployment was changed.
- D1 remains OPEN pending new exact-head CI/E2E and approved staging post-expiry positive-read/negative-write verification. Do not infer staging closure from source tests.


## 2026-10-31 — Role/Context request-tracker correction (PR #330)

- Exact-head CI [41143882152](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143882152) completed with 2,378/2,378 unit tests, backend/frontend lint, TypeScript, Core E2E, Browser UX, Mobile Design, Visual Agent, business-owner and organization-owner gates passing. Quality Gate [41143881924](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143881924) and RB-034 [41143882023](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143882023) passed. The only failed CI job was E2E Role/Context.
- The failure artifact and nested Playwright network trace show the API calls reported as pending did receive HTTP 200 responses with response bodies, typically in approximately 80–170 ms. This points to request-lifecycle reconciliation in the gate, not a confirmed backend latency or authorization failure.
- Replaced `Map<Request,string>` tracking with stable `method + full URL` counters. Concurrent duplicate requests increment the same entry; `requestfinished` and `requestfailed` decrement one instance. EventSource/SSE is excluded from the finite-request drain check, while failed requests remain independently asserted. Diagnostic output retains URL and duplicate count.
- This change does not weaken route authorization, console, failed-request, HTTP 5xx, tenant-isolation or visual assertions. The run also reported forbidden-route redirect cases (`/support`, `/bi`, `/security`) that must be re-evaluated after the tracker correction; do not assume they are false positives.
- Role/Context and overall release remain OPEN / NOT READY until a fresh exact-head run passes or remaining genuine route-policy defects are fixed. No production database, PHI, migration, Render environment, merge to `main` or production deployment was changed.
