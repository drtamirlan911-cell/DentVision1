# DentVision — Release Blockers & Deferred Work Register

> Canonical working register for issues discovered during autonomous audit/release work. Items remain open until verified by tests/evidence.

## Open

### RB-029 — Patient clinical history JSON is not encrypted at rest
- **Status:** OPEN — static inventory and migration design documented; codec implementation and audited backfill pending
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Evidence:** the static inventory [`docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md`](security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md), audited on exact `main` SHA `6581695e91eb70c638bc0b94efb10773d8882dd9`, found the same confirmed gap and traced the downstream consumers. A source sweep found 58 explicit `medicalHistory` references across 23 files and 85 textual Prisma Patient ORM call lines across 33 backend paths (including tests). The counts are static-reference counts, not unique endpoints or database row counts.
- **Risk:** allergies, clinical notes, categories, source metadata and tooth/clinical details may remain readable in database backups or dumps, depending on their exact contents. Phone, email, address and notes also remain searchable plaintext fields by current design and require a documented threat-model decision.
- **Required fix:** implement the shared versioned history codec/repository and migrate all read/write/AI/event/portal/odontogram/cross-clinic consumers per the inventory. Run a read-only dry run and an audited, resumable, conflict-safe backfill with counts, integrity checks, PHI-free exception ledger and tested rollback. Do not encrypt the JSON column blindly.
- **Verification:** tests must prove plaintext does not appear in persisted sensitive fields, API responses remain correctly decrypted for authorized roles, tenant/branch boundaries hold, legacy records remain readable during migration, and failed/missing keys fail closed in production.

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
- **Status:** IN PROGRESS — candidate fix implemented; exact-head verification pending
- **Priority:** P0
- **Area:** AI / Clinical Privacy / Tenant Isolation / IDOR
- **Evidence:** current-main file dentvision-backend/src/modules/ai/agents/doctor.agent.ts (blob d1a4947196b40965070e0cade276b1e866b53e0e) used findUnique by caller-supplied patient/appointment ID in PATIENT_BRIEFING, AFTER_APPOINTMENT, CREATE_ESTIMATE, REFER_DIAGNOSTICS and SCHEDULE_NEXT_VISIT; AFTER_APPOINTMENT updated an appointment by ID alone; CREATE_APPOINTMENT did not prove that the patient belonged to the active clinic.
- **Risk:** an AI intent carrying a guessed/foreign ID could expose patient name, clinical context and decrypted IIN, or mutate another clinic's appointment. Frontend role hiding does not protect these server-side paths.
- **5 Why / root cause:** patient and appointment identifiers are accepted from AI parameters → several legacy handlers query/update by primary key alone → clinic-scoped access is applied inconsistently across the same agent → handlers rely on upstream routing rather than proving ownership at the data boundary → no direct negative cross-tenant regression test covers these intents.
- **Candidate remediation:** branch security/doctor-agent-tenant-isolation-20261025 adds fail-closed clinic-context validation, scopes identified patient/appointment reads to context.clinicId, verifies patient ownership before appointment creation, and conditionally completes only an appointment matching both clinic and patient.
- **Closure criteria:** targeted unit tests prove foreign patient/appointment IDs are denied and same-tenant operations remain valid; TypeScript/lint/unit checks and full role/context E2E pass on the exact candidate SHA; no patient or appointment data crosses tenant boundaries. Main remains affected until a verified fix is merged.

### RB-029 — Patient clinical history JSON is not encrypted at rest
- **Status:** OPEN — implementation gap confirmed on current `main` by source inspection
- **Priority:** P0
- **Area:** PHI / clinical data protection
- **Evidence:** `dentvision-backend/src/lib/phi.ts` encrypts `medicalHistory` only when the value is a string. The current Patient upsert and PATCH paths in `dentvision-backend/src/modules/patients/patients.routes.ts` merge history as a JavaScript object and persist it as `Prisma.InputJsonValue`; serialization reads the object directly. Current-main file SHAs checked: `phi.ts` `da64d8174962a4ee52ac7c45d44f77a8789e8d89`, `patients.routes.ts` `c6f544c8e0a66e45daa0db3d26bdbb32b7a2ba75`.
- **5 Why / root cause:** the data is stored as JSON → the encryption helper handles strings only → canonical write paths persist JSON objects directly → the read/consumer contract assumes a structured object → no compatible envelope, full consumer inventory or safe backfill has been implemented.
- **Risk:** allergies, clinical notes, categories, source metadata and tooth/clinical details may remain readable in database backups/dumps. Phone, email, address and notes also require an explicit threat-model decision.
- **Required next action:** map all Patient write/read paths, filters, reports, AI context and integrations before choosing an encrypted-at-rest representation. Design an audited migration/backfill with dry-run, resumability, progress counts, integrity checks, legacy compatibility and rollback. Do not encrypt the JSON column blindly.
- **Closure criteria:** persisted sensitive values are not plaintext; authorized API responses preserve the structured history; tenant/branch isolation holds; legacy rows remain readable during migration; missing/wrong keys fail closed; migration dry-run and rollback are tested. No production backfill or key rotation is claimed.

### RB-019 — Platform Kaspi API contract and network bounds
- **Status:** OPEN — official provider contract not independently verified
- **Priority:** P1
- **Area:** Payments / External API
- **Evidence:** `docs/KASPI_CLINIC_SETUP.md` currently shows a generic webhook shape for a configured clinic gateway. That sample is an internal adapter contract, not proof that the official Kaspi acquiring API uses the same endpoint, header, signature payload or status semantics.
- **Risk:** a provider mismatch can cause false payment confirmation, replay/race defects, duplicate settlement or production integration failure.
- **Required next action:** verify the provider-issued contract for the actual merchant/gateway; constrain production API base URLs to approved hosts; verify signature canonicalization, amount/currency, timestamp/replay protection, idempotency, status transitions, timeouts and bounded response parsing. Do not label generic HMAC behavior as official Kaspi compatibility without primary contract evidence.
- **Closure criteria:** contract evidence is retained, adapter semantics match it, and positive/negative callback tests pass on the exact target SHA.

### RB-033 — Main branch protection and required release checks are disabled
- **Status:** OPEN — confirmed by GitHub branch metadata
- **Priority:** P0
- **Area:** Release governance / CI enforcement
- **Evidence:** GitHub `GET /repos/drtamirlan911-cell/DentVision1/branches/main` returned `protected: false`, `protection.enabled: false`, `required_status_checks.enforcement_level: off`, and no required contexts. Existing GitHub issue #259 already describes this control gap.
- **Root cause (5 Why):** direct pushes can bypass CI → no branch protection is active → no required-check policy is enforced → repository configuration does not encode the documented release contract → release governance depends on operator discipline rather than a technical control.
- **Risk:** an unverified or insecure commit can reach `main` without mandatory checks; tenant isolation, PHI, payment and visual gates are not enforceable at the repository boundary.
- **Required next action / owner:** repository administrator must enable protection/rules for `main`, require PR-based changes and the stable status checks used by the actual workflows (including `quality`, `lint-test`, `frontend-lint`, `backend-lint`, `e2e`, and the Android build check where applicable). Do not require guessed check names; select the exact names reported by GitHub for the required workflows.
- **Closure criteria:** GitHub reports protection enabled and required checks enforced; a test PR demonstrates a failed required check blocks merge. The current connected read-only GitHub interface cannot apply this settings change, so it remains a manual admin action.

## Closed

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
