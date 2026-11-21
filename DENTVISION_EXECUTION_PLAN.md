## Marketplace / Supplier OS — seller shipment and proof-of-delivery slice — 2026-11-21

- Added supplier-owned shipment records for carrier, tracking number/link, shipment status and proof of delivery, plus durable event history linked to the canonical order and supplier.
- Supplier owners/managers can register a shipment only for an order in their active supplier queue. Repeating identical tracking data is idempotent; a conflicting second shipment is rejected.
- A supplier can no longer move an order to "shipped" through the generic status endpoint. Carrier and tracking number are required.
- Delivery close-out requires a HTTPS proof-of-delivery URL and recipient name. The actor/time/event are saved; only an order explicitly assigned to this single supplier advances the canonical order to delivered and triggers existing order-close effects.
- For split-supplier orders, shipment status remains seller-local and does not falsely close the buyer's full order. Full per-seller allocations and global aggregation remain open.
- The UI exposes tracking and proof-backed delivery actions. This is manual evidence entry, not a live carrier integration; label purchase, carrier APIs/webhooks, scanner hardware and automatic POD remain open.
- Returns/RMA/refund/chargeback and seller-platform reconciliation remain open; the current dispute list is not a complete return workflow. Supplier and Marketplace remain **PARTIAL**.

## Marketplace — buyer-side item-level return request — 2026-11-21

- Added a buyer-owned `POST /api/shop/orders/:id/returns` workflow backed by the existing canonical Dispute lifecycle. The order owner is checked server-side; product names, IDs, quantities, prices and seller attribution are snapshotted from persisted order lines, never trusted from the browser.
- Added `MarketplaceReturnItem` records for exact order-line index, product/seller snapshot, quantity, unit price, reason code and buyer note. One request can contain several lines and sellers; duplicate lines and quantities above the remaining purchased balance are rejected.
- The endpoint locks the order row, validates delivery/payment status and remaining quantity, requires an idempotency key plus payload fingerprint, and writes an audit event. Paid shipped orders accept non-delivery claims; delivered paid and delivered cash-on-delivery orders accept item-condition claims.
- Buyer order history now returns line indexes and the return-request history. The Finance dispute projection includes the line-level request snapshot.
- Supplier responses are allowed only for the exact return-request lines assigned to that seller. The supplier dashboard queries return claims by the line-level seller snapshot rather than the latest-200 global orders.
- Item-level return resolution is blocked in the legacy order-wide cashback reversal path. Until Finance can approve exact quantities and issue provider refunds, cashback/commission compensation and seller settlement reversals per line, an item-level dispute cannot be marked `resolved` through the old full-order path.
- **Boundary:** no evidence-file upload, physical pickup/RMA label, warehouse inspection/disposition, supplier warranty/remake, provider refund or line-level settlement/reconciliation yet. No date-window policy is enforced because a structured returns policy has not yet been agreed. Marketplace/Supplier remains **PARTIAL**.

## Marketplace / Supplier OS — seller-side claim response — 2026-11-21

- Added `SupplierDisputeResponse`, an immutable supplier response linked to the canonical dispute, order and supplier. A unique dispute/supplier constraint prevents contradictory duplicate submissions; identical retries are idempotent.
- Only an owner/manager in the active supplier workspace can respond, after the server verifies that at least one canonical order line belongs to that supplier. Ownership is resolved from the immutable per-line `supplier_id` checkout snapshot, not the order-level primary supplier pointer; historical lines without a seller snapshot use current product ownership as a compatibility fallback. This preserves independent seller access in multi-supplier orders while denying unrelated sellers. Product-only claims remain visible but do not expose this order-response action.
- The supplier can acknowledge receipt of a return request or contest the claim and must provide a 10–2,000 character explanation. The actor and timestamp are preserved and the action is audit-logged.
- The response is evidence for platform adjudication only: it does not alter global dispute/order status, create a refund, reverse cashback, issue a chargeback or move wallet/ledger balances. Financial decisions remain in the governed platform/Finance workflow.
- The supplier dashboard queries only disputes associated with the supplier's visible order lines/products and returns the current supplier's own response. The previous global latest-50 disputes query and client-side filtering are removed.
- The existing superadmin-only `GET /api/disputes` projection now includes supplier responses and the related supplier identity, so platform adjudicators can inspect the seller's recorded position without opening seller-private cross-tenant data. The superadmin Finance → Disputes detail view renders the supplier position, supplier identity, status and timestamp as evidence for review.
- Response creation and its audit event are committed in one database transaction while the canonical dispute row is locked; this prevents a response from being recorded concurrently after platform resolution. Non-owned/unsupported claims return the same not-found result to avoid claim-ID enumeration.
- The additive migration is included in the isolated E2E database bootstrap. No production/staging database migration or financial operation was performed.
- **Boundary:** one immutable response per supplier per order claim; no evidence-file upload, buyer/seller conversation thread, RMA authorization/label, courier pickup/inspection, refund/payment-provider action, chargeback workflow or complete multi-seller line-allocation lifecycle. Supplier/Marketplace remains **PARTIAL** pending exact-head CI/E2E, mobile/operator and end-to-end financial reconciliation evidence.

## Dental Laboratory OS — partner-owned service catalogue and case price snapshots — 2026-11-21

- Added a first-class catalogue scoped to the canonical Laboratory organization. Owners/managers control service code, type, material, description, published list price and turnaround days; production members receive read-only active entries.
- Verified clinics can inspect active services and prices from a verified/published partner before transferring a case.
- On assignment, the selected service is revalidated against the receiving laboratory and active catalogue. The canonical LabOrder stores service ID, service-name snapshot, service-price snapshot and case price; later catalogue price edits do not rewrite an accepted case.
- Legacy clinic-created orders remain assignable without catalogue selection for backward compatibility; the new transfer UI offers explicit service/tariff selection and displays the proposed price before handoff.
- No invoice, payment, settlement, payout, refund or commission is recognized by catalogue publication or order assignment. DentVision commission remains disabled until successful, idempotent settlement evidence is implemented under D10 and the Settlement Payment Contract.
- Exact-head CI/E2E and role/mobile evidence are pending. Dental Laboratory remains **PARTIAL**; D10 remains **OPEN**.

## Medical Laboratory OS — accession barcode and specimen custody — 2026-11-21 (candidate PR #352)

- New orders assigned to a medical laboratory now require accession; pre-existing orders remain legacy-compatible and are not assigned invented historical barcodes.
- Added one canonical specimen record per physical tube, unique accession barcode, specimen/container type, optional measured volume, current location, collection/receipt actor and timestamps.
- Added barcode scanning for laboratory intake. Receipt/rejection is order- and active-lab-scoped, changes one specimen under transaction lock and writes a durable custody event. The canonical order advances to `received` only after all registered tubes have a disposition and at least one is accepted.
- Added child aliquots with a separate accession barcode and immutable parent reference; measured aliquot volume is checked against the parent volume when known.
- Entering processing now transitions accepted tubes into processing and writes per-specimen events in the same order transaction. Status-only collection/receipt is blocked for accession-required orders.
- The Medical Lab cabinet now exposes barcode registration, scanner input, specimen/aliquot lineage and custody history. Added helper, contract and Partner Lifecycle E2E coverage for access denial, bypass attempts, barcode validation, receipt, duplicate scan, aliquot lineage and custody events.
- **Boundary:** source candidate only. No physical scanner/label-printer device protocol, specimen courier chain between clinic and lab, analyzer/LIS protocol integration, calibration/external QC program, critical-value acknowledgement, corrected-result delivery, settlement/payout or complete mobile/production acceptance is certified. Medical Laboratory remains **PARTIAL**; exact-head CI/E2E and operator evidence are required before merge or production use.

---
## Diagnostic Center OS vertical slice — 2026-11-21 (candidate PR #352)

- Added a scoped equipment register for CBCT, OPG, TRG, intraoral, CT, MRI and other modalities, including manufacturer/model/serial number, room, DICOM AE Title metadata and maintenance date/status.
- Added a diagnostic-center worklist with server-side center scope, status filtering, emergency/urgent priority ordering, a minimized patient-data projection, and assignment of active equipment to a referral. Mutations require the active diagnostic-center context and an authorized organization manager role; changes are audit-recorded.
- The cabinet now has dedicated **Worklist** and **Equipment** tabs. The active IAM workspace is preferred over membership ordering; ambiguous or unrelated contexts require explicit workspace selection rather than silently opening the first diagnostic organization.
- Added the migration to the CI E2E database bootstrap and route/data-contract coverage.
- **Boundary:** this is an equipment register and queue-routing slice, not RIS/PACS. It does not transfer DICOM objects, implement DICOMweb/QIDO-RS/WADO-RS/STOW-RS, connect a PACS archive, provide a diagnostic image viewer, complete radiology report validation/sign-off, or implement calibration/QC schedules. Those remain open release work. The migration has not been deployed to staging/production.
- Exact-head CI, Quality Gate and E2E are required before merge. Diagnostic Center remains **PARTIAL**.

## Implementation checkpoint — Student OS, Career OS and Medical Laboratory controls — 2026-11-20

- **Scope:** candidate-branch source work only; `docs/DENTVISION_MASTER_SPEC.md` v5.0 and `docs/PRODUCT/CABINET_UX_AND_WORKFLOW_STANDARD.md` remain normative.
- **Student OS:** paid-course discovery now returns a safe public preview before purchase; course materials/file URLs remain entitlement-gated. The player reloads the full detail after confirmed payment; lesson progress comes from the server; client-submitted completion cannot issue a certificate; the certificate remains tied to a successful server-side final assessment. Added an isolated E2E path for public preview, purchase-entitlement serialization, exam, certificate verification and cross-student isolation.
- **Career OS:** employer applications now return event history, interview records and offer responses to the employer pipeline; the employer workspace displays candidate confirmation, reschedule/decline and offer decisions. Added an employer/candidate lifecycle E2E through invitation, application, interview, offer and the explicit contract-required boundary. Candidate acceptance does not mark a person as hired.
- **Medical Laboratory OS:** active lab scope now fails closed when the organization/source entity does not resolve or legacy membership is ambiguous. Operational capabilities derive only from canonical organization-scoped PersonRole keys. Generic status updates cannot release results. A technician must submit a complete, order-bound result set; QC is a separate role and person; failed QC requires a reason and cannot be overwritten without rework; rework archives prior values/author/time, clears active results and old QC; a separate validator releases; the lab doctor interprets only after verification. The detail API exposes capabilities and the active-lab context; the UI shows role-appropriate controls and the specimen/result timeline.
- **Medical-lab regression coverage added/updated:** capability matrix and ambiguous-scope tests; complete/foreign/duplicate/missing result tests; prior-attempt history tests; Partner Lifecycle E2E updated to run technician → failed QC → rework → new results → passed QC → validator release → doctor interpretation, plus generic-release bypass and cross-partner isolation checks.
- **Important boundary:** these changes strengthen result-entry, QC and authorization controls; they do **not** yet implement full LIS accession/barcode/scan evidence, specimen parent/child/aliquot and chain-of-custody capture, workstation/analyzer integration, calibration/external QC programs, critical-value acknowledgement, corrected-result notification, lab settlement, or full mobile/production acceptance. Medical Laboratory remains **PARTIAL**.
- **Verification state at this checkpoint:** first exact-head Quality Gate on predecessor `7c9a91de068d30371aa95e4f0a1f12077b4f6958` passed TypeScript but failed frontend ESLint because the Medical Lab workspace added two hook-dependency warnings above the existing repository warning budget (14 vs max 13). The warnings were corrected on the subsequent candidate. Fresh exact-head CI, Quality Gate, E2E, browser UX, role/context, mobile and visual evidence are pending. Do not treat prior/cancelled runs as evidence for the new SHA; do not merge or mark any cabinet complete until all required gates pass.

---

## Standing cabinet quality directive — 2026-11-20

- **Persistent user requirement:** every existing DentVision cabinet must be easy for its intended role, complete across its real domain workflow, safe across organization/branch boundaries and usable on mobile. This is a continuing product priority, not a one-time feature request.
- **Normative parent:** `docs/DENTVISION_MASTER_SPEC.md` v5.0. The practical acceptance contract is `docs/PRODUCT/CABINET_UX_AND_WORKFLOW_STANDARD.md`. This contract covers diagnostic center/RIS-PACS, medical LIS, dental-lab production/CAD-CAM/QC/delivery, marketplace/supplier commerce, Academy/cohorts/assessment/certificates, employer/hiring/contract, and every other existing cabinet (clinic, doctor, reception, patient, finance, BI, community, platform admin and AI).
- **Audit rule:** evaluate a complete role journey — entry → context → permission → Command Center → queue → entity detail → happy path → exception path → persistence → notification/handoff → finance/document/result → audit → mobile. A route, page, dashboard tile or Prisma model is inventory evidence only, never completion proof.
- **Current-source classification recorded:** Diagnostic Center PARTIAL; Medical Laboratory PARTIAL; Dental Laboratory PARTIAL; Marketplace/Supplier PARTIAL; Academy/Lecturer PARTIAL; Student OS and expanded Career OS are candidate-branch implementation; remaining existing cabinets require the same role-by-role journey audit. See the table in the cabinet standard. Do not claim a production-ready RIS/PACS, LIS, delivery/payout, accredited credential or EDS employment process without external and exact-head evidence.
- **Implementation sequence:** P0 identity/context, RBAC, tenant isolation and audit; P1 role-first Command Center, queues, detail, notifications and mobile; P2 domain integrations and operational/economic closure; P3 AI optimization and personalization. Do not polish around missing P0/P1 controls.
- **Design constraint:** progressive disclosure, task-first screens, contextual next actions, one canonical record per business object, explicit statuses and complete event histories. Avoid dashboard clutter, duplicate menus, redundant forms and cross-cabinet navigation for ordinary work.
- **Before starting any new cabinet task:** re-read the Master Spec, current Execution Plan, this standard and relevant domain execution contract; inspect existing page/API/schema/tests before changing implementation.

---

## Partner workspace UX parity — 2026-11-20 (active remediation)

- **Audited source baseline:** `main` at `758ffe7f39112848df701a8b988f44af03845597`; normative product contract: `docs/DENTVISION_MASTER_SPEC.md` v5.0.
- **Confirmed source-level UX gaps:** the backend emits first-class `EMPLOYER` workspace contexts, but the shared workspace switcher did not list or navigate them; Supplier and Lecturer pages selected the first membership on entry instead of the active scope; partner context switches did not refresh those pages while the route remained mounted; canonical `/dental-lab` had no route even though its subroutes redirected there, with some incorrectly escaping to clinic CRM/diagnostics; a single `LABORATORY` token type is shared by medical and dental labs.
- **Bounded remediation on `fix/partner-workspace-context-ux-20261120`:** add EMPLOYER to the context picker; preserve and respond to the selected supplier/lecturer context; fail closed if an active organization cannot be matched and show an explicit organization chooser instead of silently opening another business; auto-select only a sole unambiguous membership; publish selected scope IDs in the workspace-switch event; route lecturer contexts directly to the lecturer workbench; mount the existing `LabDashboard` dispatcher at `/dental-lab` behind the existing LABORATORY scope guard so the scoped role chooses medical vs. dental lab UI; keep dental-lab child paths within the partner workspace and make the existing team tab deep-linkable; add unit coverage for context selection and ambiguity.
- **Verification status:** candidate source only until exact-head frontend/backend lint, TypeScript, unit suite, Quality Gate, Role/Context E2E, partner lifecycle E2E, browser UX/mobile and visual evidence pass. No live data, PHI, staging/production configuration, payments, legal signatures or deployment operations are in scope.
- **Still partial after this slice:** independent medical-laboratory accession/chain-of-custody/QC/release/settlement; diagnostic modality/equipment/worklist/DICOM/report chain; dental-lab remake authorization, shipping/proof-of-delivery, independent invoices and commercial settlement; supplier KYB, multi-seller fulfillment, returns/refunds and ledger reconciliation; separate academy-owner/cohort operations; full employer interview/offer/contract lifecycle; public discovery and Android parity. This remediation does not certify any partner cabinet as complete or change the Master Spec release gate.

---

## Government partnership strategy alignment — 2026-11-20

- Approved strategic direction: state-private partnership-oriented national dental digital infrastructure, with all eligible support routes evaluated (innovation grants, Astana Hub eligibility, regional pilot support, public procurement and formal PPP where legally justified).
- Canonical strategy: [`docs/strategy/DENTVISION_GOVERNMENT_PARTNERSHIP_STRATEGY.md`](docs/strategy/DENTVISION_GOVERNMENT_PARTNERSHIP_STRATEGY.md).
- This is a subordinate strategy document. Master Spec 5.0, Product DNA, this Execution Plan and Release Blockers remain controlling; this strategy does not waive release gates or authorize PHI access, government integration, public claims or production operations.
- The strategy does not change the existing technical execution order: P0 privacy/security and IAM evidence remain first. Build only a synthetic-data pilot pack until legal, security, clinical and operator readiness gates are signed.
- Government pilot readiness is a separate gate from source CI and general product release readiness. No state partnership, endorsement, grant award or PPP contract is implied.

## Current execution checkpoint — 2026-11-18 (post-merge reconciliation, Master Spec v5.0)

The previous 2026-11-17 checkpoint is historical. Current source is `main=7289f369b1effa28db94e3e1e4541e4500bc5ee0`. PR #346, #347 and #348 are merged; PR #322 is merged as developer-environment setup only. No open PRs were returned by the current repository query.

### Exact verification now recorded
- PR #348 head `3647184c2f082486614d676981eab55b99546f99`: CI [44128085041](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/44128085041) SUCCESS (all four jobs); Quality Gate [44128084855](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/44128084855) SUCCESS; RB-034 [44128084888](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/44128084888) SUCCESS; Android [44128085039](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/44128085039) SUCCESS; Vercel Preview SUCCESS.
- Unit tests: 2,702 passed / 303 files. E2E: Core 253 passed / 5 skipped; Browser UX 4; Mobile Design 16; Role/Context 139 passed / 28 skipped; Visual Agent 48; Business Owner 11; Organization Owner 8; Playwright CLI smoke and Visual Release Gate passed.
- Main merge commit is `7289f369b1effa28db94e3e1e4541e4500bc5ee0`; post-merge Vercel status is SUCCESS. PR-head CI evidence is used for code gates; it does not certify staging or production.

### Cabinet parity correction
Employer is no longer “missing registration/workspace” at source level: PR #348 added first-class EMPLOYER Organization and IAM roles, vacancies tied to the Organization, scoped candidate/application APIs, constrained hiring transitions, audit events, legal activation gate and /employer workspace. Classification is now **Partial**. Outstanding: approved employer templates/EDS, interview scheduling, formal offers/contracts, vacancy edit/close, candidate communication and consent, real vacancy matching, and employer Android workflow.

PR #333 was closed without merging, but its AI response-polish source and five focused tests are already present on current main (the main `llm.service.ts` uses shared `providerFetch`, model-dependent reasoning and provider token usage). Do not merge its stale branch wholesale: it is 24 commits behind current main. PR #328/#329 work was integrated into PR #330 through PRs #331/#332; PR #330 is merged. These histories are preserved.

### Next execution order
1. **RB-029 / P0:** finish source-level PHI reader/writer/derived-copy inventory, including error/log paths; keep compatibility dual-write until all old AI Admin webhook/queue workers are verified drained. Prepare strict cutover, key rotation/reindex, retention/export/deletion, backup/restore and exception reconciliation runbooks. No live backfill or strict cutover without approved staging target, backup/restore proof and explicit operator approval.
2. **Current RB-029 log-redaction candidate:** branch `security/rb029-ai-admin-booking-log-redaction-20261118` removes raw exception logging from AI Admin booking and adds a PHI-redaction regression test. Run exact-head CI, Quality Gate and E2E; fix any failure without weakening the test; merge only after verification.
3. **IAM/security:** complete RB-035 patient-route × role × organization × clinic × branch × active/revoked/expired-session negative matrix. Obtain repository-admin proof for RB-033 required branch checks; current GitHub integration cannot read classic branch protection (403), and rulesets response is empty. Capture real WebKit OPTIONS/request headers and production CORS/WebSocket evidence for RB-031.
4. **Diagnostics / Medical Lab:** complete modality/equipment/room worklists, DICOM/RIS/PACS/report validation and medical-lab accession → chain-of-custody → QC → result release, with traceability, audit, notifications and settlement evidence.
5. **Dental Lab / D10:** close remake authorization, dispatch/shipping/proof of delivery, services/pricing, invoices, provider-backed payment/settlement/payout/refund/chargeback and owner/manager/technician/designer/QC/finance/mobile coverage. Preserve settlement-only economics recognition.
6. **Employer / Jobs:** retain legal publication gate until approved documents and signer evidence exist; finish real interviews/offers, vacancy edit/close, candidate consent/communications, matching and Android.
7. **Marketplace / Supplier and Academy / Community:** complete KYB/publication, multi-seller fulfillment/refunds/returns/payout/procurement reconciliation; academy owner/cohort/content/assessment/certificate/finance; community follows/nested threads/media consent/moderation.
8. **Public discovery / clinical UX / mobile:** make organization/professional/service detail routes real rather than redirects; implement true 32-tooth WebGL/3D odontogram with accessible 2D fallback; verify physical Android install/runtime and the same role/workflow matrix.
9. Run the Master Spec DoD chain on one exact final HEAD: entry → context → permission → home → queue → entity → workflow → persistence → notification → finance/outcome → audit → mobile → E2E.

Release remains **NOT READY**. Keep data/provider/legal/device operations separated from source CI and do not mark a cabinet complete from route/screen existence.

---

## Current execution checkpoint — 2026-11-17 (Master Spec v5.0)

The current cabinet evidence is in `docs/SYSTEM_AUDIT.md`; operational release/security blockers are in `docs/RELEASE_BLOCKERS.md`. Do not create duplicate roadmaps or infer completion from routes, models or screenshots alone.

### Repository and integration state
- `main` is `462c6fcc1994c345b51feabff5f2357debdfffba`; PR #347 is merged. RB-029 implementation is present in main, but its operational data/key/retention/backup/staging closure remains P0 and open.
- PR #348 remains the existing ecosystem-parity remediation line. It now incorporates current main history and preserves the employer/Jobs and organization-legal changes. The combined branch needs fresh CI/E2E, Android and RB-034 checks.
- Pre-sync candidate Quality Gate [44126395133](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/44126395133) and Vercel Preview passed. Full CI/E2E and RB-034 were not verified on that pre-sync SHA.
- Confirmed Jobs fix: advisory locking uses Prisma `$executeRaw`, not `$queryRaw`, to avoid deserializing PostgreSQL `void`. The onboarding E2E checks persisted Organization/Branch context after redirect.
- Release remains **NOT READY** until P0/P1 gates and applicable cabinet Definition-of-Done sequences are evidenced.

### Next execution order from verified gaps
1. **RB-029 / P0:** finish reader/writer/derived-copy inventory, compatibility-worker drain and strict-write cutover plan, key lifecycle/rotation/old-key handling, retention/export/deletion, backup/restore/rollback and approved staging dry-run/reconciliation. Do not run historical PHI writes without explicit target/backup approval.
2. **IAM/security:** finish RB-035 role × organization × clinic × branch × active/revoked/expired-session negative matrix; verify RB-031 WebKit/CORS/WebSocket evidence and RB-033 main branch protection with repository-admin evidence.
3. **Diagnostic center and medical laboratory:** complete modality/worklist/reporting and sample accession → chain-of-custody → QC → validation → release, with role gates, result delivery, audit and finance.
4. **Dental laboratory / D10:** close remake authorization/feedback, dispatch/shipping/proof of delivery, services/pricing, invoices, payment/settlement/payout/refunds, durable notifications and full owner/manager/technician/designer/QC/finance/mobile matrix.
5. **Employer / Jobs:** keep legal publication closed until approved employer template and signer evidence exist; finish vacancy edit/close, actual interview scheduling, formal offers/contracts, candidate communication/consent, vacancy-specific matching and Android employer workspace.
6. **Marketplace / Supplier:** complete seller KYB and publication, multi-seller fulfillment, paid-order provider void/refund, returns, payout and CRM procurement reconciliation.
7. **Academy / Community:** finish academy owner/cohort/content/assessment/certificate/finance loop and community follow/nested-thread/media-consent/moderation workflows.
8. **Public discovery and clinical UX:** resolve organization/professional/service public detail routes; implement and verify the actual 32-tooth WebGL/3D odontogram with accessible 2D fallback.
9. **Mobile parity:** verify install/runtime on physical Android devices and role/workflow parity; keep offline PHI boundary explicit.
10. Run the complete Master Spec matrix on one exact final HEAD: onboarding → context → permission → home → queue → entity → workflow → persistence → notification → finance/outcome → audit → mobile → E2E.

Continue the required loop: `Inspect → implement → test → fix → verify → document → continue`.


## 2026-11-15 — RB-029 staged AI Admin writes and retained queue backfill candidate

- Continued on existing PR #347 / security/rb029-ai-admin-external-id-20261114; no new branch or PR.
- Codex P1 findings: v2 writes could be read by old workers during rolling deployment; retained ai_admin_queue_messages rows (including completed payloads and error strings) were omitted from historical backfill.
- New writer defaults to legacy ENC format until all v2 readers are explicitly acknowledged. Queue payloads remain the historical object-shaped JSONB contract until the queue-specific legacy-worker drain is acknowledged. Enabling v2 or queue encryption without its acknowledgement fails closed.
- Backfill candidate now scans all retained queue rows, validates payload shape, encrypts payload and error and uses exact compare-and-set guards. Added regression tests for legacy reader compatibility and queue payload/error conversion.
- Candidate only: fresh exact-head CI, Quality Gate, Codex and Preview evidence is required. No live DB, migration, staging/production backfill, worker drain, key rotation, backup/restore, secret update or production deployment was performed.
- RB-029 remains OPEN/P0. Historical Patient/AI derivative PHI inventory, approved staging reconciliation/backfill, backup/restore and retention/export evidence remain outstanding. Release NOT READY.
## Current continuation — 2026-11-14 (RB-029 rolling-deploy compatibility)

- PR #347 review found that legacy webhook workers could not locate hash-only sessions during a rolling deploy. The existing branch now dual-writes the legacy identifier with ciphertext and blind index by default; legacy workers continue to find the same row.
- Strict ciphertext-only writes require AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true and AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS. Backfill apply requires the same acknowledgement and exact target DATABASE_URL binding.
- Compatibility mode intentionally retains plaintext until every old worker is verified drained and the strict cutover/backfill is run. No worker drain, staging/production database operation, migration, backfill, key rotation or restore was performed. RB-029 remains OPEN / P0.
- The previous exact-head CI found one clock-dependent DEMO trial test. It is now fixed with a frozen pre-deadline check and a second assertion at the exact expiry boundary; entitlement business logic is unchanged. New exact-head CI, E2E, Quality Gate, Vercel and Codex review are required.
- Release remains NOT READY. Keep PR #347 open until all exact-head gates and review pass.

## Current implementation checkpoint — 2026-11-14 (RB-029 AI Admin datasource-target guard; PR #347)

- Active work continues on the existing PR #347 / `security/rb029-ai-admin-external-id-20261114`; no replacement branch or PR was created. Base is `main`; exact published code head before this documentation reconciliation: `a632394653994786049013eb05e9845133d8667e`; documentation-only checkpoint commit: `ddcad40fcf7bbc0f2db403ea2ab12a38836745f4`.
- Addressed the Codex P2 in the AI Admin external-identity backfill: the prior staging/production label could disagree with Prisma's actual `DATABASE_URL`. Write mode now requires the actual `DATABASE_URL` to exactly match a separate target-specific expected connection string: `AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL` or `AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL`. Missing/mismatched values fail closed; connection strings are never logged.
- Added regression cases for valid staging binding, staging label with a production datasource, and missing expected datasource configuration. Updated `docs/security/RB-029_AI_ADMIN_EXTERNAL_ID.md` with the operator runbook.
- Exact local verification on this patch: focused backfill tests 11/11; backend `tsc --noEmit`; changed-file ESLint; `git diff --check` passed. The earlier local attempt lacked backend dependencies/Prisma generation; after installing backend dependencies and generating the client, the focused suite passed.
- Exact-head GitHub CI and Quality Gate were triggered for the code commit `a6323946`; a documentation-only follow-up commit now requires fresh exact-head gates. Codex re-review was explicitly requested. Do not merge until exact-head CI/E2E, Quality Gate, preview and Codex review are green with no unresolved P0/P1/P2 findings.
- RB-029 remains OPEN/P0: historical PHI inventory/backfill, key versioning/rotation and old-key handling, retention/deletion/export, backup/restore/rollback, exception ledger and approved staging evidence remain outstanding. No staging/production database connection, query, migration, backfill, key change or production deployment was performed.
- Master Spec 5.0 remains the normative product contract; the repository's current compliance audit remains 18 PARTIAL / 4 OPEN / 2 GUIDANCE. D1/D2, RB-031, RB-033, RB-035, official Kaspi evidence, Android runtime and D10 independent dental-lab lifecycle remain open/partial. Release NOT READY.

## Current implementation checkpoint — 2026-11-13 (RB-029 independent AI history hydrator race)

- Continued on the existing PR #346 branch security/rb029-fewshot-workspace-isolation-20261113, based on published head cd5966fbbb8823cefdf5645c6ad01d681c58848b. Main remains unchanged; no new PR or replacement branch.
- Addressed the latest Codex P2: AIConversationSync independently hydrates /api/ai/history, so it could previously write an old transcript after a new chat was created even though loadConversation() had a generation guard. Both hydration paths now share the same conversation generation. AIConversationSync checks the generation before committing the history response and cancels its work on workspace switch/unmount.
- Added an integration-style component regression test that holds /api/ai/history pending, starts a new persisted conversation, then resolves the old history response and asserts the new session remains empty.
- Local verification on this exact candidate worktree: full unit suite 2,613/2,613 across 295 files; AIConversationSync component regression 1/1; AI thread lifecycle tests 6/6; frontend TypeScript; frontend production build; backend TypeScript build; frontend lint (13 warnings / 0 errors); Release Gate 6/6; git diff --check all passed. Frontend Vite reports existing large-chunk and mixed Welcome import warnings only.
- Pending after publication: exact-new-head GitHub CI/E2E (including browser, mobile, role, visual and owner gates), Quality Gate and Codex re-review. Do not merge until all exact-head gates pass and no P0/P1/P2 findings remain.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, external contact identifier protection, key versioning/rotation, retention/export/backup, restore/rollback, exception ledger and approved staging reconciliation. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open/partial. Release NOT READY.
- No staging/production DB was queried or changed; no migration, PHI backfill, key/secret change, provider operation or production deployment performed.

## Current implementation checkpoint — 2026-11-13 (RB-029 Codex review findings addressed in candidate)

- Continue on the existing PR #346 / security/rb029-fewshot-workspace-isolation-20261113; no replacement branch or PR. Base main is 93472635f1788f27f4bb6666909ea0a82b339471; candidate changes are based on PR head e814fbba6a17539d2d0c2cbbf09b50ffa4670367. Main remains unchanged.
- Addressed the new Codex P1: a verified active partner organization now blocks the legacy JWT clinicId fallback in authentication. A retained clinic claim cannot overwrite a verified diagnostic/laboratory/supplier organization context.
- Addressed the new Codex P2: buildDigitalTwin() no longer resolves an arbitrary clinic membership when no active clinic ID is supplied. Clinic-derived name/KPIs are produced only after explicit active clinic scope and successful resolveClinicAccess; digital-twin routes pass the active scope only.
- Added regression coverage for verified organization vs. stale clinic claim, missing/explicit clinic twin behavior, and updated the AI context contract test. Existing few-shot, memory, thread lifecycle and branch-scope tests remain included.
- Local exact-worktree verification: full unit suite 2,612/2,612 passed across 294 files; focused AI/auth suite 35/35 passed; root TypeScript typecheck passed; backend TypeScript build passed; root lint passed (13 warnings, 0 errors); targeted backend ESLint passed; git diff --check passed.
- Pending after push: exact-new-HEAD GitHub CI (including full E2E/Browser UX/Mobile/Role/Visual/Owner gates), Quality Gate, and Codex review. Do not merge until all exact-head gates pass and no unresolved security findings remain.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, external contact identifier protection, key versioning/rotation, retention/export/backup, restore/rollback, exception ledger and approved staging reconciliation. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open/partial. Release NOT READY.
- No staging/production DB was queried or changed; no migration, PHI backfill, key/secret change, provider operation or production deployment performed.

## Current implementation checkpoint — 2026-11-13 (RB-029 active workspace scope; candidate pending)

- Continue only on existing PR #346 / `security/rb029-fewshot-workspace-isolation-20261113`; active-clinic scope fix is a child of `b8d5a56013d2310352142d4c42e0ec4545781151`. Main remains unchanged.
- Source review confirmed that a partner token may retain a legacy clinicId. Raw claim reads in AI learning, few-shot, deterministic fallback, digital twin, proactive routes, insights, audit metadata and branch resolution could therefore reattach clinic state.
- Candidate uses `activeAiClinicId()` consistently, returns null for guest/partner contexts, removes authenticated fallback to the demo clinic, and only exposes branch context matched to the active organization/clinic. Regression tests cover stale clinic and branch claims.
- **Next:** push with expected-HEAD lease; rerun exact-head CI, Quality Gate and all E2E role/visual/owner gates. Review Codex findings. Do not merge until every gate passes.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, key versioning/rotation, retention/export/backup and approved staging evidence. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open. Release NOT READY.
- No staging/production data operation, migration, PHI backfill, key change, provider operation, secret change or production deployment performed.

## Current implementation checkpoint — 2026-11-10 (RB-030 merged)

- RB-030 offline appointment edit/reconnect/sync is implemented and merged through existing PR #345. Merge commit on `main`: `4c779b371c1c6a049630913a214ee27f3f8bd41b`; verified PR head: `3577a57d46d58c0fbfbbd26a6bf8696c85cb0a8b`.
- Exact-head evidence on PR #345: CI [42511766232](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42511766232), Quality Gate [42511766117](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42511766117), Vercel Preview SUCCESS. 2,561 unit tests / 288 files passed. E2E gates passed: Core 251, Browser UX 4, Mobile Design 16, Role Design 140, Visual Agent 48, Business Owner 11, Organization Owner 8, Playwright CLI smoke and Visual Release Gate.
- The sanitizer's timestamp-ID false positive is fixed with explicit opaque-reference-field handling and regression coverage; generic phone/IIN text and clinical/PHI fields remain redacted. Queue replay remains scoped to the complete active IAM context and fails closed on mismatch.
- Offline boundary: edits to clinical notes, diagnosis, tooth number, free-text reason and service changes on an existing appointment require a network connection. Do not expand the offline claim beyond the verified safe fields.
- PR #344 was closed as superseded, with its branch retained. Do not create a replacement branch or PR for RB-030.
- **Next sequence:** (1) continue RB-029 historical PHI reader/writer inventory, key lifecycle, backup/restore and approved staging plan; (2) complete RB-035 patient-route/role/tenant/branch/revoked-session negative matrix; (3) prepare D1/D2 staging migration/retention validation only after staging target, backup/rollback and operator approval are verified; (4) gather RB-031 WebKit OPTIONS/CORS/WebSocket evidence; (5) obtain repository-admin proof for RB-033 branch protection; (6) verify official Kaspi merchant contract/callback, Android runtime and remaining D10 independent lab lifecycle.
- Release remains NOT READY. No staging/production DB operation, migration, PHI backfill, provider operation, environment/secret change or production deployment was performed.

## Current implementation checkpoint — 2026-11-06 (recipient test fixture correction)

- Existing PR #330 only; baseline HEAD `1da8313edb413a44a4cfae79799108e0a76cec2c`; branch `fix/d1-d10-trial-archive-signing-api-20261029`; base main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 349 ahead / 0 behind.
- Candidate `1da8313e` source change implements the doctor recipient boundary. CI confirmed frontend/backend lint and TypeScript/build/Prisma/Command Center/System Map success; Quality Gate and RB-034 passed. Unit suite had 2,494 passes and one new test failure.
- The one failure was caused by a mock returning doctor-a and doctor-b even though the code's Prisma where-clause requested only doctor-b. Corrected the mock in the targeted test to return only doctor-b. No application behavior or security assertion was relaxed.
- Exact-head CI/E2E for the child commit is required. RB-035 remains OPEN until exact-head checks and the complete negative access matrix pass. Keep PR Draft; no merge/deployment.

## Current implementation checkpoint — 2026-11-06 (RB-035 clinical AI recipient authorization)

- Existing PR #330 only; branch `fix/d1-d10-trial-archive-signing-api-20261029`; starting HEAD `90635b7beef04102bed3a13d28868ae206d16cfb`; main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 348 ahead / 0 behind.
- Exact-head CI `42162267260`, Quality Gate `42162267180`, RB-034 `42162267129` and Vercel passed. All four CI jobs passed, including full E2E/role/visual/owner/Playwright gates. EventStore mock correction is verified at that HEAD.
- RB-035 remains OPEN. Candidate correction: doctor-agent notifications require a non-deleted clinic patient, active `treating_doctor` assignment, current organization-scoped DOCTOR role and existing branch-scope helper approval. ASSISTANT removed; explicit empty lists deny all; explicit IDs are intersected with verified assignments; conflicting/missing patient context denies delivery.
- Added recipient-security regression cases for assigned, unassigned, wrong-branch, explicit-empty, mismatched explicit recipient, missing/cross-clinic, conflicting patient ID and missing patient context. Verify on candidate exact HEAD before marking fixed.
- Continue RB-029 historical PHI/key/backup evidence, D1/D2 approved staging plan, RB-030/031/033, Kaspi and D10. Keep PR Draft; no main merge or deployment. Local tests/status unavailable because no checkout is mounted.

## Latest implementation checkpoint — 2026-11-06 (EventStore test correction; RB-035 recipient-scope finding)

- Existing PR #330 only; branch `fix/d1-d10-trial-archive-signing-api-20261029`; starting HEAD `e8877e81b105daedccba00a305f6b13d715c9b35`; base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 347 commits ahead / 0 behind, 193 changed files. No branch/PR creation and no merge.
- Exact-head CI `41975258101`: lint, TypeScript/build, generated System Map and complete E2E gates passed; unit-test job failed only because `EventStore.encryption.test.ts` could not initialize its mock (`update is not defined`). 2,482 tests passed; 278 files passed and one suite failed before running.
- Quality Gate `41975258095` and RB-034 `41975258087` passed; Vercel Preview status was SUCCESS. Overall CI remains FAILED until the exact-head rerun passes.
- Correction: add the already-created `update` mock to the test file's `vi.hoisted` destructuring. No tests/assertions are removed. The EventStore encryption tests have not yet been verified.
- RB-029 remains OPEN/P0. New EventStore result/error writes are encrypted and list/detail readers decode them, but exact-head unit evidence, historical plaintext inventory/backfill, AI memory/learning, notification/export, key rotation and backup/restore remain outstanding.
- RB-035 recipient-scope finding: clinical doctor-agent results are currently routed to organization DOCTOR and ASSISTANT roles, with no PatientAssignment filter; explicit empty notifyUserIds falls through to role resolution. SSE delivery is target-filtered, but the resolved target set is overbroad. Fix and negative tests are next.
- RB-033: GitHub branch metadata reports `protected=false` / `protection.enabled=false` for main; repository-admin must establish required protection. Release remains NOT READY.

## Next execution order

1. Push the test mock correction plus checkpoint docs to PR #330 with expected-HEAD lease; run exact-head CI/Quality/RB-034.
2. Implement and test the RB-035 AI notification recipient restriction; wait for exact-head CI completion before another push.
3. Continue RB-029 PHI inventory and key/backup/backfill plan; keep historical data read-only.
4. Prepare D1/D2 staging proof only after verified target, backup/rollback and operator window. Then RB-030, RB-031, RB-033, Kaspi and remaining D10.
5. Keep PR #330 Draft; do not merge main or deploy.

---

## Latest implementation checkpoint — 2026-11-05 (RB-029 EventStore derivative encryption; RB-035 parent-head verification)

- Existing PR #330 only; parent HEAD `3a7e299d3eb126010f01ae75980a7b529b51bae6`, base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`, 345 commits ahead / 0 behind. The personal AI Activity/Approval tenant-scope fix `8ada4be8efb6ed09dba630ca344ef5f7049b5d09` is included and verified by exact-parent CI.
- Parent exact-head CI `41969627116` passed all four jobs; 2,484/2,484 tests across 279 files. Core, Browser UX, Mobile Design, Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and Visual Release gates passed. Quality Gate `41969627078`, RB-034 `41969627059` and Vercel Preview passed.
- Source review found that EventStore persisted `AIEvent.result` JSON and raw `AIEvent.error` without the durable-event at-rest boundary. Code commit `3aa6d0f7af24fbbbb5ed49bc7fac0c75fa2f8bfe` encrypts new result/error writes, decodes them in list/detail readers, preserves legacy plaintext compatibility and adds regression coverage. Exact-head CI for this code commit is PENDING; parent CI is not evidence for it.
- Next order: (1) verify the new exact-head CI/Quality/RB-034 and focused EventStore tests; (2) continue RB-029 memory/learning, realtime/notification/export, legacy plaintext, key rotation and backup/restore inventory; (3) complete RB-035 negative authorization matrix; (4) prepare but do not execute D1/D2 staging validation without approved target/backup/rollback/operator window; (5) RB-030, RB-031, RB-033, Kaspi and D10 parity.
- Release remains NOT READY. No merge, staging/production DB operation, PHI backfill, provider call, environment change or deployment.

# DentVision — Master Execution Plan

## Previous implementation checkpoint — 2026-11-05 (RB-035 tenant-scoped AI visibility; superseded by the latest checkpoint below)

- Existing PR #330 only; starting HEAD `0299ab57243092479716d87af6b2e8878612e23a`, base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`. The branch is 342 commits ahead / 0 behind at the start of this checkpoint. No new branch/PR and no merge.
- Candidate commit `8ada4be8efb6ed09dba630ca344ef5f7049b5d09` narrows the personal-row branch in `buildActivityFilter` and `buildApprovalFilter` to the verified active clinic/organization. Without a verified tenant, only unscoped personal rows can match and `canReadPhi` is false; SUPERADMIN platform access is unchanged. This prevents an own-actor/requester row from another clinic bypassing the active-context PHI permission.
- Added regression coverage for own-row scoping and unverified clinic context. Hardened AI approval decision-note encryption/decryption to fail closed. Files: `activityQuery.ts`, `activityQuery.test.ts`, `approvalPrivacy.ts`.
- Parent HEAD `0299ab...` passed CI 41840005056 (all four jobs), Quality Gate 41840005038, RB-034 41840005059 and Vercel preview. Unit suite 2,483/2,483 across 279 files; E2E gates passed with one recovered flaky patient-portal conversation request. These are parent-head results only; the new code commit still needs exact-head verification.
- Next order: (1) verify exact-head CI and the targeted filter tests; (2) continue RB-029 EventStore result/error, AI memory, realtime/notification/export, key rotation, backup/restore and legacy backfill inventory; (3) complete RB-035 negative matrix; (4) prepare, but do not run, D1/D2 staging validation until target/backup/rollback/operator approval exists; (5) RB-030, RB-031, RB-033, Kaspi and D10 workflow parity.
- Release remains NOT READY. Do not merge main or touch staging/production.


## Latest exact-head verification checkpoint — 2026-11-03

- Verified code/test HEAD `de0dffcadf0dca77beaf61cb647729ad849d35b8` on the existing PR #330 branch; base/main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`. PR #330 remains OPEN / DRAFT, 333 commits ahead / 0 behind.
- Exact-head CI `41387485129`, Quality Gate `41387485180`, RB-034 `41387485168` and Vercel preview status all passed. CI jobs frontend-lint, backend-lint, lint-test and E2E passed. Unit suite: 2,437/2,437 across 270 files; E2E: Core 249/5 skipped, Browser UX 4, Mobile 16, Role/Context 140/28 skipped, Visual Agent 48, Business Owner 11, Organization Owner 8, Playwright CLI smoke and Visual Release Gate passed. E2E compact digest found zero failure signatures.
- PARTNER-003's database-level negative assertion passed: after delivery, the order has no DENTAL_LAB `partner_economics` transaction or ledger entries. RB-036 is resolved as the premature delivery-recognition defect. Do not enable recognition until a separately approved dental-lab invoice/payment/settlement/payout/refund/chargeback contract and verified callback exist. D10 remains OPEN/PARTIAL.
- D1/D2 remain OPEN pending approved staging migrations and positive-read/negative-write/archive-retention proof. RB-029, RB-030, RB-031, RB-033 and RB-035 remain open for their respective PHI/backfill, offline sync, WebKit/production CORS, repository protection and full authorization evidence.
- Master Spec 5.0 classification remains 18 PARTIAL / 4 OPEN / 2 GUIDANCE. No production readiness claim.
- This checkpoint's documentation-only commit must itself receive a fresh exact-head CI run; the successful run above belongs to code/test HEAD `de0dffcadf0dca77beaf61cb647729ad849d35b8`. No live DB/provider/environment action or main merge.

## Next execution order after documentation checkpoint

1. Continue RB-029 reader/writer/concurrent-writer inventory and exception-ledger design; keep all PHI operations read-only until approved backup/restore and staging dry run.
2. Complete RB-035 route-level negative authorization matrix by role, tenant, branch, revoked/expired session and patient financial-field visibility.
3. Prepare D1/D2 staging verification plan for all four pending migrations; do not apply without verified staging target, backup and explicit operator window.
4. Resolve RB-030 offline sync contract and add a real offline→reconnect persistence assertion.
5. Capture exact WebKit OPTIONS/request lifecycle and production CORS/WebSocket evidence for RB-031.
6. Obtain repository-admin confirmation for RB-033 and official merchant-issued Kaspi contract/callback evidence.
7. Continue D10 dental-lab QC/remake, dispatch, service/pricing, commercial settlement and complete partner RBAC; retain the 18/4/2 Master Spec audit classification until each section has evidence.


## Latest implementation checkpoint — 2026-11-01 (RB-029 / RB-035 / role-gate corrections)

- This checkpoint is based on live PR #330 branch \`fix/d1-d10-trial-archive-signing-api-20261029\`, HEAD \`45900d0d33b507bb0bb492d2d23b0243a615ec25\`. Base/main remains \`ac913cc3389a294d0b135a852b035ddddb1018ca\`; no merge.
- Corrected two stale RB-035 source-contract matchers exposed by CI \`41312419249\`; runtime permissions and balance serialization remain unchanged and fail-closed.
- Added shared object-root validation to PHI helpers and reject scalar/array medical-history writes in Patient Portal PUT, Patient POST and Patient PATCH. Existing scalar \`ENC:\` is legacy read compatibility only. Added unit and route-contract tests.
- Corrected one Safari Role/Context collector race based on the Playwright trace: only explicit request-cancellation signatures are deferred briefly; expected navigation cancellation requires an actual main-document epoch advance. Otherwise the request remains a hard failure.
- Exact parent CI \`41312419249\` results are not carried forward as proof: 2,432/2,434 unit tests passed; Core E2E/Browser UX/Mobile/Visual Agent/Business Owner/Organization Owner/CLI/visual-evidence and Quality/RB-034 passed; Role/Context had one PATIENT Safari cancellation race. The two unit matcher failures and Safari race have source/test fixes, but need exact final-head verification.
- CI \`41333100207\` started on code/test HEAD \`5bfd700\`; frontend/backend lint, Quality Gate \`41333100271\` and RB-034 \`41333100268\` passed. E2E was cancelled by subsequent documentation pushes and is not counted as a pass.
- Next: run and inspect a complete non-cancelled CI/Quality/RB-034 on the exact final documentation HEAD. Then continue D1/D2/D8 staging proof, RB-029 full consumer/backfill/key/backup audit, RB-030 real offline→reconnect E2E, RB-031 WebKit/CORS evidence, RB-033 branch protection, RB-035 full route/role matrix, Kaspi/production verification and remaining D10 Master Spec workflow parity.
- Release remains NOT READY; PR #330 stays OPEN/DRAFT. No staging/production DB query/write, migration, PHI backfill, payment-provider action, environment/secret change, deployment or main merge was performed.

## Latest implementation checkpoint — 2026-11-01 (D10 settlement-boundary correction)

- Continue only on existing PR #330 / `fix/d1-d10-trial-archive-signing-api-20261029`; this update is based on exact live HEAD `b43b3c01b229b21c1fa2cda7d149c55486bb4e42`. Base/main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`.
- Parent-head verification: CI `41280138666`, Quality Gate `41280138667` and RB-034 `41280138692` passed. This evidence is for the parent HEAD only; the settlement-boundary correction below requires a fresh exact-head run.
- Confirmed P1 mismatch: `subscribers.ts` recognized DENTAL_LAB economics on `labOrder.status_changed → delivered`; the clinic route also contained a dead duplicate writer. Both delivery-triggered paths are removed, together with the obsolete delivery-only recognition helper and its unit test.
- PARTNER-003 now asserts that delivery produces no `partner_economics` transaction or attached ledger entries for the order. Delivery remains operational completion; the commercial flow remains invoice → verified payment/settlement → economics recognition.
- Updated the Operating Directive, Master Spec wording, Execution Plan, Settlement Payment Contract and Release Blockers to agree with canonical `docs/business/DENTVISION_PARTNER_ECONOMICS.md`: commission is earned only on successful commercial settlement. D10 remains OPEN until an approved invoice/payment/settlement/payout/refund/chargeback workflow is implemented and tested.
- Historical DENTAL_LAB transactions and wallets are not deleted, reversed, backfilled or altered. They require read-only reconciliation against external payment evidence before any separately approved financial correction.
- Next: inspect exact-head CI/E2E, then continue D1/D2/D8 staging proof, RB-029 PHI reader/backfill evidence, RB-030 offline E2E, RB-031 WebKit/CORS, RB-033 branch protection, RB-035 authorization matrix, Kaspi/production checks and remaining D10 workflow parity. No live DB operation, migration, PHI backfill, environment change, deployment or main merge.

## Latest compliance checkpoint — 2026-10-31## Latest compliance checkpoint — 2026-10-31

- Full 24-section Master Spec 5.0 audit recorded in docs/MASTER_SPEC_COMPLIANCE_AUDIT.md, audited HEAD 1284de604b638937ee2939f3f198f8674a5fa6d4.
- Result: 18 sections PARTIAL, 4 OPEN, 2 GUIDANCE; no section certified fully compliant end-to-end. PR #330 remains OPEN / DRAFT and release NOT READY.
- Confirmed gaps include Shop cancellation (SHOP-013 returns 404), incomplete independent dental-lab owner workflow proof, public organization/professional profile route aliases, open accepted-paid-settled/medical-analysis finance, real 32-tooth WebGL/3D odontogram, PHI transcript/backfill and Android runtime.
- Exact-head CI 41183045451 remains IN PROGRESS at Role/Context; core E2E, Browser UX and Mobile Design passed. Quality Gate 41183045517 and RB-034 diagnostic 41183045421 passed, but do not close remaining release gates.
- Next priority: finish role/visual/owner/Playwright gates, then implement or explicitly defer every confirmed D10 workflow gap and close staging/security/provider evidence. No main merge or live environment operation.



## Purpose
This document is the persistent execution contract for DentVision. It is the source of truth for what is being implemented, in what order, and what is considered complete. Progress must not live only in a chat session.

## Latest implementation checkpoint — 2026-10-31 (concurrent E2E added)
- Existing PR #330 only. Patient concurrency implementation `b77552f8078382beabc376ad2af37ba2cb60abff`, matcher correction `8e7989b5d01eb973220df70b331e5912342f281e`, and E2E coverage commit `dda18b4239bb9a23d18cec872bcb0074079b65ab`.
- New isolated-database E2E cases exercise simultaneous Patient PATCH writes and simultaneous balance deposits. Every accepted PATCH marker must remain in the final chart; deposit total must equal the sum of all increments; fractional amount is rejected.
- Previous exact-head CI `41181068689` reached 2,382 passed / 3 failed due three stale assertions in one source-contract file; matchers corrected. The concurrent E2E cases were then added, so a fresh full CI is mandatory.
- Next: verify all current-head CI jobs; then continue transcript PHI policy, D1/D2/D8 staging, RB-029 complete readers/backfill, RB-030 offline schedule E2E, RB-031 WebKit evidence and D10 workflow matrix. No tests disabled or permissions weakened; no live DB operation or main merge.

## Latest implementation checkpoint — 2026-10-31 (test matcher correction)
- Existing PR #330 only; source commit `b77552f8078382beabc376ad2af37ba2cb60abff`, source-contract test correction `8e7989b5d01eb973220df70b331e5912342f281e`. Main/base remains unchanged.
- Current Patient PATCH now rejects stale snapshots with 409 via `updatedAt` CAS; patient update, teeth mirror and branch reassignment are transactionally coupled. Deposit writes use DB-side integer increment.
- The first run after the source commit found three stale expectations in one static source-contract test (2,382 passed / 3 failed); route assertions have been made whitespace-tolerant and the negative matcher now distinguishes the update operation from the API response.
- Exact-head CI/Quality/RB-034 must pass on the final documentation checkpoint. Preserve all IAM and tenant assertions; do not skip tests. AI transcript PHI, RB-029 broader consumers/staging, RB-030 offline E2E, RB-031 WebKit, RB-033 branch rules and D10 workflow parity remain open.

## Latest implementation checkpoint — 2026-10-31
- Continue only on existing PR #330 / `fix/d1-d10-trial-archive-signing-api-20261029`; source implementation commit `b77552f8078382beabc376ad2af37ba2cb60abff` is based on prior exact branch HEAD `45fe9ba5f573d8311d6b96e4e83f8260bffbf3f9`. Main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`.
- Fixed a confirmed stale-snapshot race in `PATCH /api/patients/:id`: use `updatedAt` compare-and-set and return 409 when another writer changed the row. The same transaction now persists the odontogram mirror and any validated organization-level branch reassignment.
- Fixed concurrent deposit arithmetic with Prisma atomic integer increment; reject unsafe/non-integer amounts.
- Regression source contracts added. No local build/test claim; exact-head CI is required after the branch update.
- Next: run exact-head CI/Quality/RB-034; inspect all stages. Then continue RB-029 reader/writer audit, offline queue end-to-end test, WebKit request evidence and D10 workflow matrix. No production/staging DB changes or merge to main.

## Current checkpoint — 2026-10-30

- Active implementation PR remains #330 on `fix/d1-d10-trial-archive-signing-api-20261029`; the 2026-10-30 role-gate follow-up was based on live pre-change HEAD `77fc9c81fbc276621ad1a4d03a753e4733819722`, on main `ac913cc3389a294d0b135a852b035ddddb1018ca`. The follow-up records the 36px School breadcrumb correction, exact generated System Map values and RB-035 deposit-denial regressions. Always resolve the live PR #330 head before the next change.
- The user explicitly authorized integration of #328 and #329 into the existing #330 working branch. Both were integrated with history-preserving merge commits; their original branches/PRs remain open and unchanged. Temporary integration PRs #331 and #332 were closed as merged into #330, never into main.
- #328 integration merge commit: `091604d78d6457a0ae5e97a83ae96059c0dde945`, with parent history from #330 and #328. #329 integration merge commit: `a3138609fb147cbee0a8cfeab3ffd397ceb6212d`, with parent history from the already-integrated #328/#330 line and #329.
- Conflict resolution preserved the D1–D10 trial/archive guards, active clinic context and archived-membership filtering, clinical-chart/route permissions, workspace picker and role policy, PHI envelope encryption, patient writer ciphertext rejection, and optimistic concurrency. PatientCreated events now carry a boolean complaint-presence hint, not patient names or complaint text.
- Corrected two known #328 CI failures in the integrated branch: `planGate.ts` now passes `res` rather than undefined `_res`; the CRM treatment-plan security contract now asserts the actual clinic- and patient-scoped reference validation.
- Exact-head CI [41034452583](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452583) is pending; Quality Gate [41034452312](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452312) and RB-034 diagnostic [41034452343](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452343) are in progress. Do not treat integration as verified until the exact latest HEAD completes all required gates.
- Main remains unchanged. No staging or production migration, PHI backfill, database write, or deployment has been performed.

## Operating rules
1. `main` is the product source of truth unless a dedicated implementation branch is explicitly required.
2. Existing canonical product/economics documents are authoritative; do not create competing rules.
3. Every completed material change must be committed to GitHub and recorded in `DENTVISION_EXECUTION_LOG.md`.
4. Every unfinished item has an explicit status and next action.
5. Prefer implementation over repeated audits. Audit only to unblock, verify, or prevent regressions.
6. Do not duplicate UI, business rules, calculations, permissions, or data models when an existing implementation can be extended.
7. Backend/domain logic is authoritative; frontend must consume the same rules rather than reimplementing economics.
8. Historical financial records must remain reproducible even after rules change.
9. AI may explain, recommend, and detect anomalies, but canonical financial/economic rules require deterministic domain logic and explicit governance.
10. A release is complete only when the relevant implementation, tests, documentation, and verification evidence are present in the repository.
11. Browser automation must use isolated test data and must never perform real production payments, messages, or destructive production actions.
12. UX tests must verify behavior and user comprehension signals, not merely that a route renders.

## Execution phases

### Phase 0 — Technical baseline / control plane
**Status:** COMPLETE

Evidence recorded in `DENTVISION_CONTEXT.md` and `DENTVISION_EXECUTION_LOG.md`; the context file is the current state bootstrap.

- [x] Create this master execution plan.
- [x] Create persistent execution log.
- [x] Confirm the control plane: `DENTVISION_CONTEXT.md` is the current state/authority bootstrap; `ARCHITECTURE.md` is the architecture overview; `.dentvision/current-state.json` is the curated machine-readable summary sourced from context (`generated: false`).
- [x] Record repository-path audit: `CURRENT_STATE.md` is absent at this branch head and is not an active current-state source; do not recreate a competing status document.
- [x] Stabilize CI and record evidence.
- [x] Restore/verify `dentvision-backend/src/modules/patients/patients.routes.ts` against Git history, recording evidence in `DENTVISION_EXECUTION_LOG.md` (no `CURRENT_STATE.md` exists at this branch head).
- [x] Verify backend runtime/infrastructure baseline.
- [x] Record the exact baseline commit and active implementation branch in the execution log.
- [x] Locate and read the canonical `DENTVISION_PARTNER_ECONOMICS.md`; retain it as the sole economics policy source.

### Phase 1 — Economics Engine and Ledger vertical slice
**Status:** IN PROGRESS

- [x] Convert canonical partner economics into deterministic executable rules for diagnostic 3D, medical analysis and dental laboratory partners.
- [x] Calculate operation price, platform commission, partner payout, attributable costs, contribution margin and margin status.
- [x] Version applied economics rules and retain snapshots on economics transactions.
- [x] Make economics calculations idempotent and auditable.
- [x] Add automated tests for floors, caps, dental-lab volume tiers, loss detection and rule snapshots.
- [x] Connect diagnostic settlement calculation to the canonical engine.
- [x] Remove the legacy referral-time economics fallback so settlement cannot use stale `Referral.platformFee` as its authoritative source.
- [x] Add referral lifecycle/concurrency protection for canonical economics reconciliation.
- [x] Connect Partner Economics data to the existing Finance Hub Platform view.
- [x] Complete accepted → paid → settled integration/concurrency tests with immutable rule/version verification at the durable ledger boundary.
- [x] Wire the real medical-analysis paid/settled operational lifecycle using the existing `Referral + Laboratory + LaboratoryTest + Payment` domain; do not create a duplicate order model.
- [x] Complete the ledger/reconciliation surface and connect Finance Hub to the durable economics transactions end-to-end.
- [x] Keep dental-lab economics disabled on delivery; do not recognize commission until an approved commercial payment/settlement path provides verified paid/settled evidence.

### Phase 2 — Partner onboarding, transparency and Finance Hub
**Status:** IN PROGRESS

- [x] Establish E2E coverage entry points for diagnostic-center, medical-laboratory and dental-laboratory owner onboarding.
- [x] Establish E2E coverage entry points for employee management and invitations.
- [x] Complete full owner lifecycle: registration → organization profile → verification/approval state → first login → operational workspace.
- [x] Complete full branch lifecycle: create → edit → switch → assign employees → enforce branch permissions → archive/delete according to the existing domain model.
- [x] Verify the durable Partner Economics dashboard transparency surface shows applicable commission, gross value, deductions/cost, partner net payout, payout status and economics rule/version reference.
- [x] Diagnostic centers see branch economics and platform deductions through durable branch-filtered Partner Economics transparency/dashboard data.
- [x] Analysis laboratories see per-analysis economics through durable Partner Economics transactions and Finance Hub transparency.
- [ ] Dental laboratories see per-order/service economics only through verified settlement-backed Partner Economics snapshots and Finance Hub transparency; the independent invoice/payment/settlement flow is still OPEN.
- [x] Expose platform revenue, partner payout, cost, contribution and margin by partner/type/branch/period through durable transparency/dashboard aggregation.
- [x] Add discrepancy, low-margin and loss alerts from immutable economics rows.
- [x] Preserve historical calculations when economics rules change.

## Canonical Branch Management Contract

Branch management is part of the existing Organization/Workspace model. Do not create a separate branch product or parallel organization model. A branch is an operational scope inside an organization and must use the existing identity, membership, permissions, audit, events and AI context primitives.

### Owner entry point
The organization owner must have one discoverable management path:

`Owner → Settings / Organization → Branches`

The branch list is the canonical place to:
- see all active and archived branches;
- create a branch;
- open a branch workspace;
- edit branch configuration;
- activate/archive a branch;
- manage branch staff and assignments;
- inspect branch operational and financial status;
- enter branch-specific settings.

If the existing navigation has an organization/settings surface, extend it rather than creating a duplicate route or dashboard.

### Branch creation
Creation must be a real persisted workflow, not a modal-only UI.

Required baseline fields:
- name;
- unique organization-scoped code;
- city;
- address;
- phone;
- active state;
- default-branch semantics where applicable.

Optional settings may contain branding, working hours, holidays, communication and operational configuration, but these must remain compatible with the existing `Branch.settings` domain field rather than creating a duplicate settings model.

Creation requirements:
- authorize against the actor's organization scope;
- allow only roles with branch-management permission;
- validate organization-scoped code uniqueness;
- create audit/event records;
- return the persisted branch and make it immediately discoverable after refresh;
- never create a branch outside the current organization/tenant.

### Branch workspace
Opening a branch must provide an operational workspace with the current branch context visible and switchable only within the actor's authorized organization/branch scope.

The branch workspace should expose, according to role and existing domain support:
- Overview / Today;
- Schedule;
- Patients;
- Cases / Clinical;
- Diagnostics;
- Laboratory;
- Team;
- Services & Prices;
- Rooms / Chairs / Equipment;
- Inventory / Warehouse;
- Finance / Cash / Payments;
- Documents / Templates;
- Notifications / Communication;
- Analytics;
- Settings.

Do not expose a screen merely because the label exists. Each item must resolve to an implemented workflow or be explicitly unavailable with a reason.

### Branch settings contract
Branch settings should be organized into practical domains:

1. **General** — name, code, contacts, address, status, default state.
2. **Working time** — schedule, holidays, exceptions and appointment availability.
3. **Team** — invite/add staff, role assignment, branch assignment, enable/disable access.
4. **Rooms & equipment** — rooms, dental chairs and operational resources where supported.
5. **Services & prices** — branch availability and branch-specific price overrides where the domain model supports them.
6. **Inventory** — stock scope, responsible users, low-stock rules and future inter-branch transfer workflows.
7. **Finance** — branch revenue/expense visibility, cash/payment configuration and finance permissions.
8. **CRM & communication** — reminders, confirmations, waitlist, patient communication settings.
9. **Diagnostics & laboratory** — referral routing, deadlines, result visibility and operational contacts.
10. **Documents** — templates, consent/document configuration and responsible roles.
11. **AI & notifications** — branch-scoped AI context, alerts, approvals and notification rules.
12. **Security & audit** — access history, privileged changes and branch-level audit visibility according to role.

Only settings supported by the current domain should be implemented immediately; unsupported areas remain explicit backlog items rather than fake controls.

### Staff and branch scope
The branch lifecycle must support:

`Invite/Add → Assign → Change assignment → Disable/Revoke → Audit`

Branch assignment must use the existing `ClinicMember.branchId`/membership model where applicable. A user may have access to one or more branches only when the permission model allows it. The backend remains authoritative for scope enforcement.

### Data isolation
Branch-aware resources must respect branch scope wherever the existing domain model provides it, including at minimum:
- patients;
- appointments;
- inventory items;
- invoices;
- expenses;
- referrals/diagnostics.

Organization owners may aggregate across authorized branches. Branch-scoped users must not read or mutate another branch's data merely by changing a URL, ID or request payload.

### Archive / deactivate semantics
Branches must not be hard-deleted when doing so would destroy operational or audit history. Prefer inactive/archive semantics already represented by the domain model.

Before deactivation, the workflow must account for:
- active staff assignments;
- future appointments;
- unresolved cases;
- open lab/diagnostic orders;
- inventory/financial records;
- default-branch constraints.

Historical records remain readable according to permission policy. The only active/default branch must not be silently disabled.

### Branch-aware AI
AI context must include the active organization and branch scope. Example supported intents:
- “Покажи показатели филиала за месяц.”
- “Какие записи и лабораторные заказы требуют внимания в этом филиале?”
- “Кто из сотрудников закреплён за филиалом?”
- “Подготовь список низких остатков по филиалу.”

AI must never use branch context to bypass authorization. Any mutation follows `Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`.

### Required release tests
The branch vertical slice is not complete until an isolated E2E workflow proves:
1. Owner opens the canonical organization/settings branch-management entry point.
2. Owner creates a branch.
3. Branch persists and survives refresh/re-login.
4. Owner edits branch configuration.
5. Owner opens/switches to the branch workspace.
6. Owner assigns an employee to the branch.
7. Assigned employee sees only permitted branch data.
8. Cross-branch read/write attempts are denied.
9. Owner can view organization-wide aggregates across branches.
10. Owner can archive/deactivate a branch under the domain constraints.
11. Historical branch-linked records remain intact and auditable.
12. Visible branch actions are real and produce expected success/error states.

### Implementation order
1. Verify existing branch model and existing branch routes/services before adding code.
2. Wire any missing backend route mounting into the existing application router.
3. Reuse existing organization/settings/team screens for discoverability.
4. Complete branch CRUD + assignment + authorization.
5. Complete branch workspace/switching.
6. Add settings domains only where backed by real data models.
7. Add E2E and negative cross-branch tests.
8. Verify CI/release gates.
9. Record evidence in `DENTVISION_EXECUTION_LOG.md` and update status here.

### Phase 3 — Automated operations
**Status:** QUEUED
- [x] Trigger economics only at supported settlement boundaries: medical-analysis payment settlement and diagnostic paid settlement. Dental-lab delivery is not settlement; DENTAL_LAB recognition stays disabled until an approved invoice/payment/settlement path exists.
- [x] Automate payout readiness and notifications.
- [x] Implement full and partial payment refunds where a durable Finance Core ledger transaction exists; unsupported payment domains fail closed rather than mutating money without a reversal.
- [x] Handle supported cancellation/refund boundaries with full/partial Finance Core reversals; unsupported domains fail closed rather than mutating financial state without a durable reversal.
- [x] Add scheduled reconciliation and anomaly detection.

### Phase 4 — Product-wide UX and navigation
**Status:** IN PROGRESS
- [x] Add browser-level UX coverage for the existing critical route matrix.
- [x] Add Playwright CLI as a complementary browser-exploration/smoke layer without replacing `@playwright/test`.
- [x] Expand UX coverage from route reachability to real user workflows and outcomes; organization/branch, partner onboarding, partner lifecycle and Finance Hub journeys are covered in Playwright suites.
- [x] Verify the first-load AI workspace flow is functional, not decorative; authenticated root lands in the real `/ai` workspace and first-action failures are surfaced.
- [x] Remove duplicate navigation shell and establish one canonical information architecture; SuperAppSidebar now aliases the canonical EcosystemSidebar and the IA/token contract is documented.
- [x] Ensure role-specific navigation and permissions are consistent; RBAC and branch-management negative-path coverage exists.
- [x] Establish the canonical web/mobile DentVision design-system and Figma handoff contract, reusing existing --dv-* tokens and one shared IA; connected-Figma canvas execution remains gated on an available Figma file.
- [x] Verify visible buttons/links/forms have understandable labels and critical onboarding/branch/owner actions are exercised by browser tests.
- [x] Verify loading/error/success behavior on critical owner, partner and AI workflows; remaining broad UI state execution is release-gated.
- [x] Verify responsive behavior and accessible button naming on critical screens through browser UX coverage.

### Phase 5 — Core clinical workflows
**Status:** QUEUED
- [x] Patient → treatment case → appointment → completed visit → patient summary workflow is covered by a dedicated E2E journey.
- [x] Treatment plans and odontogram persistence/history contract: treatment-plan CRUD/status/tenant tests plus tooth 16 status/surface round-trip through the canonical patient write/read model.
- [x] Diagnostics ordering/results workflow is covered by the partner lifecycle and referral/result E2E/API journeys.
- [x] Laboratory and dental-lab lifecycle workflows are covered by canonical transition and delivery/remake/delay tests.
- [x] Notifications/reminders: preference-aware in-app/channel dispatch, reminder cron/manual endpoint and reminder idempotency are implemented; waitlist is persisted in the canonical WaitingList model. Invoice partial payments/installments and patient prepayment consumption are now implemented and covered by E2E contracts. [ ] Final debt/prepayment/installment release execution evidence remains; implementation now includes durable partial refunds and idempotent Finance Core reversals.
- [x] Audit trail and medical-data safety controls: compliance routes, medical-file access logging, consent/version enforcement, AI action confirmation and security dashboard are implemented. [ ] Final browser/security execution evidence remains.

### Phase 6 — Ecosystem modules
**Status:** QUEUED
- [x] Marketplace/shop API workflow suite covers catalog, order creation, server-side pricing, stock boundaries, idempotency and supplier discovery.
- [x] Academy workflow suite covers course discovery, enrollment, progress, completion/certificate and duplicate enrollment behavior.
- [x] Jobs/community routes and screens are present; workflow coverage remains release-gated where no canonical seeded mutation contract exists.
- [x] Finance Hub durable partner economics dashboard, reconciliation and transparency workflows are covered.
- [x] Partner onboarding registration forms and owner/organization lifecycle are covered by browser/API workflows.
- [x] AI domain modules and orchestration: role agents, persona routing, context/data scope, permission-gated tools, confirmation-gated mutations, verification/merge lifecycle and deterministic fallback are implemented. [ ] Final live-provider/browser execution evidence remains.

### Phase 7 — Release hardening
**Status:** IN PROGRESS
- [x] Backend/frontend integration checks exist in CI.
- [x] Critical workflow E2E verification exists and runs in CI.
- [x] Full owner/partner lifecycle E2E entry points and operational lifecycle coverage exist for diagnostic center, medical laboratory and dental laboratory; execution evidence remains release-gated.
- [x] Full employee/role/permission/branch matrix coverage has been extended with organization branch management negative-path tests; release execution remains gated.
- [x] CRUD verification coverage exists for owner/staff/branch lifecycle and persistence; remaining domain-specific CRUD is release-gated.
- [x] Negative-path verification covers unauthorized, cross-tenant, cross-branch and expired/revoked invitation boundaries.
- [x] Button/action audit covers visible button naming and critical owner workflow actions.
- [x] Browser console/request-failure collection is integrated into critical owner lifecycle coverage; broad route audit remains execution-gated.
- [x] Android build/release pipeline is implemented: debug/preview/release variants, Gradle unit-test + preview APK workflow, artifact publication and manual workflow dispatch. Final hosted run/device installation evidence remains release-gated.
- [x] Security/permissions/audit checks: cross-tenant/cross-branch, invitation revocation and disabled-member boundaries plus audited medical-record access are implemented; final execution evidence remains release-gated.
- [ ] Production readiness and rollback evidence: deployment/rollback execution must still be captured from the current release candidate.

## Business-owner lifecycle release matrix

Every partner type must be tested from first contact to daily operation in an isolated E2E environment.

### Diagnostic center owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state using existing workflow.
- [ ] Login as owner.
- [ ] Create/edit/archive branch where supported by the canonical domain model.
- [ ] Add, invite, edit, disable and remove staff according to existing permissions.
- [ ] Assign staff to branch(es) and verify access boundaries.
- [ ] Configure services/diagnostic capabilities using existing screens.
- [x] Receive/create diagnostic orders.
- [x] Process order through the actual status lifecycle.
- [x] Produce/attach result where supported.
- [x] Verify clinic-side diagnostic result visibility after signing through the canonical referral read contract.
- [x] Verify payment/settlement/economics and Finance Hub records.

### Medical laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and staff.
- [ ] Configure analyses/services using existing domain screens.
- [x] Receive/process analysis workflow.
- [x] Publish/attach results using the existing workflow.
- [x] Verify referral and clinic visibility.
- [x] Verify medical-analysis economics and settlement lifecycle.

### Dental laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and technicians/staff.
- [x] Receive lab order.
- [x] Process order through existing statuses.
- [x] Verify delivery does not create a DENTAL_LAB partner-economics transaction or ledger snapshot before settlement (PARTNER-003 negative E2E).
- [x] Verify remake/cancel/delay behavior does not create premature economics.
- [x] Verify clinic-side visibility and financial records.

## Patient experience release matrix

The patient is a first-class product context, not a clinic staff role. The patient account is linked to exactly one patient card per clinic through the existing patient-portal identity/link contract and must never inherit clinic-staff navigation or permissions.

Required release checks:
- [x] Canonical PATIENT account role exists in the UserRole model.
- [x] Patient permissions are limited to self-service profile, marketplace/academy discovery and public diagnostics discovery; medical data remains behind patient-portal ownership checks and consent.
- [x] Demo patient account is linked to a real seeded patient card.
- [x] Patient login routes directly to /patient-portal rather than /ai.
- [x] Patient portal consent gate is exercised before protected medical data tabs.
- [x] Patient design gate checks appointments, treatments, visits, payments, documents, diagnostics and access contexts.
- [x] Patient negative-path design gate verifies clinic CRM, staff, finance, inventory, lab and platform-admin routes are not exposed.
- [ ] Fresh CI execution of the patient role/device matrix.
- [ ] Final interactive production patient login/portal evidence.

PATIENT must not be a clinic ClinicMember; the Patient.userId link is the ownership boundary for the portal. Staff access remains governed by clinic/branch permissions.

## Role and security matrix

- [x] Owner: organization-wide management, branch management, staff management and finance visibility are enforced/covered by the current IAM/RBAC contracts and owner lifecycle tests; final live execution evidence remains release-gated.
- [x] Admin/manager: operational and administrative scopes are permission-gated; branch-management negative-path coverage exists.
- [x] Doctor/clinical user: clinical and assigned organization/branch scope is enforced by shared branch authorization and negative-path tests.
- [x] Assistant: permission-gated workflow access is covered by the RBAC contract; final browser execution remains release-gated.
- [x] Partner operational roles: organization/branch isolation is enforced through shared authorization gates and partner lifecycle tests.
- [x] Patient role: patient-portal access is isolated from clinic staff permissions and covered by a dedicated role/design gate.
- [x] Cross-tenant reads/writes denied at the shared branch authorization gate.
- [x] Cross-branch reads/writes denied at the shared branch authorization gate.
- [x] Expired/revoked invitations denied; invitation revocation is atomic and audited.
- [x] Disabled organization-branch staff denied active branch scope without deleting audit history.
- [x] Privileged branch/invitation/organization mutations have audit actions and applicable idempotent/race-safe boundaries.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now — P0 candidate D1–D10 plus integrated #328/#329 work, existing PR #330 only:** continue on `fix/d1-d10-trial-archive-signing-api-20261029`, current exact HEAD `415e4a9dc938de0d3c71cd6b795fd4f9c7f0e8cb`, based on `main` at `ac913cc3389a294d0b135a852b035ddddb1018ca`. The user authorized integrating #328 and #329; both histories are preserved in merge commits on this branch. Their original PRs remain open and unchanged. Do not merge to main until exact-head CI/E2E and all release gates pass.

The candidate implements the 30-day Enterprise trial/backfill and read-only expiry behavior (D1), organization soft archive (D2), document-signing route/token alignment (D3), guarded route aliases (D4), supplier helper correction (D6), invitation-route ownership reconciliation (D7), and the nullable archive/backfill migrations (D8). D9 is still open because the full CI/E2E gate has not passed. D10 remains open because aliases and route existence do not prove every Master Spec workflow is functionally complete. D5 remains open for PHI staging backfill, production CORS/WebSocket verification, official Kaspi contract/callback validation and repository-admin branch protection.

**Latest confirmed candidate fix:** `/api/auth/demo-clinic` searched only for `Clinic.plan = DEMO`, while the shared creation service now creates `ENTERPRISE` trials and the legacy migration upgrades eligible DEMO rows to ENTERPRISE. That mismatch could create a second clinic/trial on repeat calls. The existing-clinic lookup now recognizes both DEMO and ENTERPRISE; archive-aware IAM test contracts were aligned and explicit archived-organization denial tests were added. Commits: `c83cbd010f59399d4d1647366f3a6752e8e892a6`, `e6c3147604f21acf0bf8766048f802540c54c015`, `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1`.

**Verification gate:** the last full candidate run was [40870315832](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40870315832), on PR merge ref `51a4e1f8dcc53b6284932127f482ccbb48d46c80` for head `469b32d3403614a67151b649de9bf73f03ef9d15). Frontend lint, backend lint, Quality Gate and RB-034 context diagnostic passed. Unit tests had 2,301 passed / 4 failed in `orgContext.test.ts` and `auth.diagnostics-endpoints.contract.test.ts`. E2E's overall job was cancelled after core and Browser UX sub-gates failed: branch-picker option outside viewport; 403 resources on `/crm/patients` and `/crm/treatment-plans`. Mobile design gate passed. The fixes above require a new exact-head run; the prior run is not evidence for the new head.

**Parallel work preserved:** original PR #328 remains open at its original head `966512b54a2937472732e2c94d23fd819de2edb0` on `fix/workspace-switcher-menu-overflow-20261026`; original PR #329 remains open at its original head `c2e5951ba631da1762bd3380c3bbc35c51953770` on `security/rb029-patient-portal-history-envelope-20261026`. Both histories are now ancestors of the #330 candidate through the integration merge commits; neither source branch was rewritten or closed. Temporary integration PRs #331/#332 are closed as merged into the #330 branch. PR #322 remains an isolated Codespaces draft and is not part of this integration. PR #326 is already merged.

**Next sequence:** (1) inspect the new exact-head CI and fix only confirmed failures without removing assertions; (2) obtain staging approval, apply both timestamped migrations and verify migration counts/rollback; (3) prove expired-clinic GET/read access and rejected write/public-booking/signing paths with authenticated E2E; (4) finish RB-029 consumer/concurrent-writer audit and read-only staging dry run; (5) verify production CORS/WebSocket and the merchant-issued Kaspi contract; (6) complete the D10 route-to-workflow matrix from the Master Spec. Keep every item open until its evidence exists.

The work proceeds in vertical slices: implement → targeted verify → full relevant gates → commit → update this plan and the persistent log → move to the next slice.

## Ecosystem support operations — inventory-first workstream (2026-10-23)

**Status:** DESIGN RECORDED; implementation inventory and runtime verification NOT STARTED. Do not treat this as a shipped feature.

Canonical design: `docs/operations/DENTVISION_ECOSYSTEM_SUPPORT_OPERATIONS.md`. This is a bounded operations model, not a competing roadmap or source of product/economic policy.

- [ ] SUP-01 inventory existing support, feedback, incident, admin, notification and knowledge capabilities in code and tests.
- [ ] SUP-02 verify tenant-scoped case lifecycle and immutable audit history.
- [ ] SUP-03 prove server-side role/domain authorization and cross-tenant denial.
- [ ] SUP-04 approve severity/service-hours policy before enabling SLA clocks.
- [ ] SUP-05 verify incident ownership, timeline, customer updates and postmortem workflow.
- [ ] SUP-06 verify assignment, backup ownership, overdue detection and escalation delivery.
- [ ] SUP-07 verify safe attachments, PHI redaction and restricted clinical evidence access.
- [ ] SUP-08 define and reconcile dashboard metrics against source records.
- [ ] SUP-09 verify knowledge search, article permissions, ownership and review lifecycle.
- [ ] SUP-10 verify notification delivery, retries, deduplication and PHI-safe payloads.
- [ ] SUP-11 verify defect-to-PR-to-CI-to-release traceability.
- [ ] SUP-12 verify AI triage remains advisory, evidence-grounded and human-approved for high-risk actions.
- [ ] SUP-13 verify mobile, offline/retry, accessibility and all ecosystem participant contexts.
- [ ] SUP-14 verify retention, deletion, export and legal-hold controls.
- [ ] SUP-15 assign primary/backup operational owners and rehearse incident recovery.

Definition of DONE for each SUP item: exact code path + owning service + authorization scope + tests + current CI/runtime evidence + known limitations. A route, screen or document alone is insufficient. Update this existing plan and the execution log; do not create another status register.


## 2026-10-30 — Current exact-head continuation (PR #330)

This checkpoint supersedes the older CI evidence in the priority notes above. Continue only on `fix/d1-d10-trial-archive-signing-api-20261029` / existing PR #330. The pre-correction candidate reviewed for this pass was `6b02e31eba480084ba57d481b130fcafafe037f5`; `main` was `ac913cc3389a294d0b135a852b035ddddb1018ca`. The local checkout is not mounted, so local `git status` remains unverified.

- Exact-head run [41004898403](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898403): frontend/backend lint, TypeScript/build, generated inventory checks, Quality Gate and RB-034 diagnostic passed; unit tests were 2,316/2,326 with 10 failures.
- Corrective candidate: update three brittle trial/archive source-contract assertions; add Express `method: 'GET'` to referral-access test requests (runtime access middleware unchanged); restrict organization archive to scoped owner-level roles rather than generic `admin` / `org_admin`, per IAM matrix, with a regression contract. Re-run exact-head CI before accepting.
- E2E 41004898403 is not green: core 240 passed / 5 skipped / BRANCH-003 failed because the branch option was outside viewport; browser UX 3 passed / one test failed on 403 resources at `/crm/patients` and `/crm/treatment-plans`; mobile design gate passed with 15 passed / one flaky WebKit attempt; role/context was cancelled and later gates skipped. Do not disable assertions. PR #328 owns the separate workspace-picker remediation; preserve it.
- Parallel candidates preserved: #328 open (CI failed, Quality Gate passed); #329 open (CI cancelled, Quality Gate passed; RB-029 staging/backfill still open); #322 open draft. No branch/PR creation, merge, deployment, DB migration or production write.
- Next: exact-head correction CI; endpoint-level tracing and least-privilege diagnosis for CRM 403s; complete full E2E/role/owner gates; then approved staging verification of trial/archive migrations, PHI backfill dry run, production CORS/WebSocket, official Kaspi contract/callback, branch protection and D10 workflow parity. All remain release blockers until evidenced.



## Integration reconciliation — 2026-10-30

Historical priority notes retained from parallel branches; they do not supersede the current D1–D10 priority.

### Preserved 329 branch change

## Current execution priority — reconciled 2026-10-26
**Now — P0 security/release integrity:** complete fresh exact-HEAD CI for PR #328 (workspace picker, active IAM context and canonical organization-branch E2E). The prior core E2E evidence on PR #329 exposed a test helper that created an organization-scoped branch then queried it with the legacy clinic-scoped endpoint; the candidate updates the helper to list by canonical organization ID. This correction is not release evidence until a fresh full run passes. RB-034/RB-031/RB-032 remain open until the full role/context, WebKit/CORS, Visual Agent, business-owner and organization-owner gates pass together. Keep main unchanged until required checks complete and only merge the intended PRs.

**Next — P0 data protection (RB-029):** the versioned encrypted JSON envelope codec, backwards-compatible reads, canonical Patient CRUD/odontogram writers and guarded dry-run-first backfill already exist on main. PR #329 corrects the Patient Portal structured-history writer; rejects caller-supplied ciphertext/envelopes at the Portal and canonical Patient create/update HTTP boundaries; minimizes PHI in durable PatientCreated AI events; and adds fail-closed envelope validation and regression contracts. The latest candidate's backend TypeScript gate exposed an event-payload typing issue; the follow-up also hardens the no-key malformed-envelope path and corrects the inventory. Fresh exact-head CI must pass before further closure work. After exact-head CI passes, complete the broader review of every Patient history reader/writer, AI/event/transcript/report/export copy and concurrent legacy writer; review backup/rollback; run only an explicitly verified read-only staging dry run; reconcile counts, round-trip and integrity. Never backfill production or deploy without explicit approval and verified rollback evidence.

### Preserved 328 branch change

**Immediate verification dependency — existing PR #328:** the current IAM/page-surface candidate is `56ab3ecfe5d1f0d02cc8be00816151a69dd30dce` on `fix/workspace-switcher-menu-overflow-20261026`. It reconciles the ASSISTANT/LAB page surface and the role-gate policy oracle. Exact-head CI, role/context and Visual Agent evidence are pending; RB-031 and the unnamed Clinic Settings controls remain open. Keep `main` unchanged.

**Now — P0 security and release integrity:** continue the dedicated RB-034 verification on the existing branch `security/doctor-agent-tenant-isolation-20261025` after the current role-gate candidate is checked. The exact candidate SHA must pass targeted DoctorAgent negative-path tests, TypeScript, backend lint, unit tests and the full role/context E2E gate before RB-034 can be closed. The PR #328 page-policy change alone does not close RB-034. The generated system map must match the generator on any candidate branch.

### Preserved 328 branch change

**Next — P0 data protection:** continue RB-029 on the existing medical-history candidate. Complete the full Patient.medicalHistory read/write/AI/report/export inventory, verify encryption-envelope compatibility and concurrent writers, review backup/rollback, then run an approved read-only staging dry run with count/round-trip/integrity reconciliation. Do not run a production backfill or deployment without explicit approval. Repository-admin action for RB-033 (required branch checks on main) remains manual and release-blocking; verify actual required-check names and prove a failing check blocks merge.

### Preserved 329 branch change

**Manual release control — RB-033:** required branch-check protection on main remains a repository-admin task. Read and record the exact required-check names and demonstrate a failing check blocks merge; do not assume this can be completed through application code.


## 2026-10-30 — Role/E2E failure repair

- Inspected the exact-head CI artifacts for run [41041393534](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41041393534), not only the summary. The role/context gate had 103 passed, 37 failed, 28 skipped; Visual Agent had 45 passed and 3 failed. Core, Browser UX, mobile design, business-owner and organization-owner gates passed.
- Confirmed causes: permission-incompatible background queries in `useDataQuery` created 403 console errors for the LAB role; clinic lab-order endpoints required unrelated patient/appointment permissions; the diagnostics referral file input lacked an accessible name; the role matrix visited a nonexistent Academy course ID.
- Implemented targeted fixes in the existing #330 branch: gate data queries by effective permissions, use `lab.read` for lab-order reads and `lab.write` for status transitions, hide create/edit/delete controls when permissions do not allow them, use the dedicated PATCH status endpoint, label the file input, and seed the general-audience `e2e` Academy course.
- These changes are **UNVERIFIED** until a fresh full CI/E2E run on the new exact HEAD completes. Isolated `401 GET /api/auth/me` errors in the prior artifact remain open for follow-up. Do not relax assertions or treat this as release-ready.
- Preserve #330 as the only active code target; do not touch `main`, do not create a replacement branch/PR, and do not run staging/production migrations or deployments.


## 2026-10-31 — D1 expiry consistency correction (PR #330)
- [x] Centralize the distinction between subscription entitlement expiry and Clinic tenancy activity: expired subscription no longer writes `Clinic.active=false`; explicit suspension remains separate.
- [x] Cover the service transition and the superadmin subscription API route with regression tests.
- [ ] Re-run exact-head CI, full role/context, Visual Agent, business-owner and organization-owner release gates.
- [ ] After approval, validate D1 migrations and expired-clinic positive GET / negative mutation behavior on staging; do not run production migrations or PHI backfills from this candidate.


## 2026-10-31 — Role/Context test-harness lifecycle fix
- [x] Inspect exact-head artifacts and verify that requests recorded as pending actually returned HTTP 200 with bodies in the nested Playwright network trace.
- [x] Replace object-key pending tracking with method+URL counters that safely reconcile duplicate requests and request-finished/request-failed events; exclude only EventSource/SSE from finite request draining.
- [ ] Re-run exact-head full CI. Re-evaluate route-policy/forbidden-redirect failures without weakening IAM assertions.
- [ ] Keep PR #330 draft and overall release NOT READY until the complete current-head gate set passes and remaining D1/RB evidence is closed.


## 2026-10-31 — Role/Context lifecycle and accessibility follow-up
- [x] Track finite API and same-origin lazy-module requests per main-document epoch; don't attribute prior-document completions to the route loaded after navigation.
- [x] Keep current-document network/API/page/server errors as hard failures; record only old-document navigation aborts separately.
- [x] Stop draining prior-shell requests after the protected-route redirect has been proven.
- [x] Increase all PlanAccessBanner dismiss targets to 36×36 and add a regression test for the three dismissible states.
- [x] Pass the already-computed least-privilege clinical/billing options when a patient is selected by ordinary list click.
- [ ] Re-run exact-head CI and verify Role/Context, Visual Agent, Business Owner and Organization Owner.
- [ ] Capture the exact WebKit OPTIONS/request headers for `/api/diagnostics/laboratories`; no speculative CORS changes.
- [ ] Keep D1/D2 staging, RB-029, D5, D9 and D10 release evidence open until explicitly verified.


## 2026-10-31 — PlanAccessBanner test harness fix
- [x] Preserve real `react-i18next` exports in the dismiss-target regression test; only stub `useTranslation`.
- [ ] Re-run full unit and exact-head release gates after this mock-only correction.

 
## 2026-10-31 — D1 null trial-deadline repair (PR #330)
 
- Re-audited the 30-day expiry contract after confirming canonical CLINIC authentication hydrates the linked legacy clinic ID before `planGate`; the earlier organizationId concern was not a confirmed bypass.
- Confirmed a separate edge case: a non-DEMO clinic subscription with `status='trialing'` and `periodEnd=NULL` had no finite deadline. The privileged subscription upsert route accepts an omitted periodEnd, and the access resolver previously fell back to Clinic.createdAt only for legacy DEMO clinics.
- The resolver now uses `Subscription.createdAt + 30 days` for a trialing subscription with no periodEnd, persists the derived deadline, and still uses Clinic.createdAt for legacy DEMO rows. Existing explicit periodEnd values are never reset.
- The legacy-trial migration now backfills non-DEMO trialing rows with null periodEnd from Subscription.createdAt. Regression tests cover expired and still-active windows plus migration SQL. The existing migration remains unapplied in staging/production.
- Parent candidate `0093f7e974b7cb6f0b79c7734125a99394b78fcb`: Quality Gate and RB-034 passed; lint/unit/build, Core E2E, Browser UX and Mobile Design passed. Role/Context was still running when this follow-up superseded the parent run; its result is not claimed. The diagnostic collector also preserves React console arguments so any future missing-key warning retains its component-owner stack.
- Fresh exact-head CI, Quality Gate and RB-034 are required for the resulting commit. D1 remains OPEN until approved staging verification proves post-expiry positive reads and rejected writes.
- No staging/production migration, database write, PHI backfill, Render environment change, merge to main or production deployment was performed.


## Follow-up execution slice — 2026-10-31

- [x] Add buyer cancellation for pre-fulfilment, unpaid cash-on-delivery orders with owner-scoped API and transactional stock restoration.
- [x] Add retryable DentCash refund marker and visible Shop Orders cancellation/retry controls.
- [x] Guard payment settlement and supplier status writes with compare-and-set order-state transitions.
- [ ] Pass exact-head unit, E2E, browser UX, role/context and visual release gates.
- [ ] Implement provider-backed cancellation/refund for online/Kaspi payments after the official merchant contract and callback semantics are verified.


## RB-029 AI history API follow-up — 2026-10-31

- [x] Filter AI thread enumeration by the active workspace scope.
- [x] Require authentication on the legacy AI history route.
- [x] Decrypt transcript content on the history response and bound pagination.
- [x] Add regression tests for encrypted/legacy reads, malformed ciphertext, pagination and route scope.
- [ ] Audit and restrict PHI in free-form learned preferences and all AIMemory writers.
- [ ] Complete legacy transcript and Patient medicalHistory dry-run/backfill only after approved backup/restore and staging evidence.
- [ ] Keep RB-029 OPEN until all consumers, keys, retention, backup and data reconciliation evidence are reviewed.


## RB-029 AI memory protection follow-up — 2026-10-31

- [x] Encrypt all new MemoryEngine short/session/long JSON values with the shared PHI field cipher and versioned envelope.
- [x] Decode encrypted values on all MemoryEngine read paths and preserve legacy plaintext compatibility.
- [x] Fail closed on malformed envelopes and production writes without ENCRYPTION_KEY.
- [x] Keep explicit free-form learned preferences clinic-scoped; only generic style preferences are global.
- [ ] Inventory/backfill existing plaintext AIMemory records after approved staging dry-run and backup/restore proof.
- [ ] Complete retention/deletion, key-rotation and direct-consumer review; RB-029 stays OPEN until verified.


## CI browser-server stabilization — 2026-10-31

- [x] Synchronize generated docs/SYSTEM_MAP.md with current route inventory (692 unique handlers, 654 mounted HTTP registrations; Shop router 38 handlers).
- [x] Change browser-gate frontend host from Vite on-demand dev server to a built production bundle served by vite preview.
- [ ] Verify the next exact-head full CI completes the same exhaustive role/context route and responsive gates; do not close RB-024 from the configuration change alone.


## 2026-11-01 — Role/Context gate efficiency and diagnostics

- [x] Retain the exhaustive role-1280 route/permission matrix for all declared and discovered routes across all 16 roles.
- [x] Retain all eight role viewport projects and all required per-role/per-viewport screenshots; keep Mobile Design and Visual Agent gates separate and unchanged.
- [x] Restrict repeated route journeys on additional viewports to representative role-specific workflows; keep request-failure, HTTP, console/page-error, tenant-isolation and 36px target assertions intact.
- [x] Add request resource type, elapsed age and response status/content-type/timing diagnostics to failed drain reports, retaining the Playwright request lifecycle as the sole completion authority.
- [ ] Re-run full exact-head CI and verify Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and final visual-release gates before closing RB-024/RB-025.


## D1 — direct payment endpoint parity (2026-11-01)

- [x] Audit specialty `/api/payments` branch separate from router-level `blockClinicWrites`.
- [x] Block new clinic cashier payment intents on expired/suspended subscription.
- [x] Block clinic-scoped refund and staff-entered static confirmation while read-only.
- [x] Preserve SaaS renewal checkout and provider-backed settlement/callbacks for already-paid transactions.
- [x] Add route-level regression tests for expired clinic payments and allowed subscription renewal.
- [ ] Pass exact-head CI and approved staging post-expiry positive-read/negative-write verification; D1 remains OPEN until both exist.

## D1 — complete clinic write-surface follow-up (2026-11-01)

- [x] Guard clinic cashier payment-intent creation, clinic-owned refunds and manual static confirmations.
- [x] Preserve SaaS subscription renewal checkout and callbacks/API settlement of already-paid transactions.
- [x] Fail closed for legacy clinic payments missing clinic scope metadata.
- [x] Guard scoped dashboard creation and doctor confirmation of clinical AI actions.
- [x] Preserve personal session, consent and medical-file access audit operations.
- [x] Add route/source-contract regressions.
- [ ] Pass full exact-head CI/E2E on current PR #330 HEAD.
- [ ] Obtain approved staging migration/backfill dry run and prove expired-clinic positive reads / negative writes. D1 stays OPEN until both are verified.
 
## D1 — clinic-to-dental-laboratory assignment (2026-11-01)

- [x] Require clinic permission before outbound lab assignment.
- [x] Resolve the active clinic membership and 30-day subscription write state.
- [x] Enforce current branch visibility for the source lab order.
- [x] Reject assignment to inactive laboratories.
- [x] Preserve lab-owner status/technician work on already-assigned cases.
- [x] Add contract regressions for both clinic assignment and partner completion boundaries.
- [ ] Pass latest exact-head CI/E2E and approved staging positive-read/negative-write verification; D1 remains OPEN.

 
## D1 — medical-laboratory clinic-side write boundary (2026-11-01)

- [x] Block new clinic-originated medical-lab orders after trial expiry.
- [x] Block clinic-side status, result, verification and interpretation writes after expiry.
- [x] Require the active clinic context; reject a body clinicId override.
- [x] Preserve reads and already-assigned laboratory-context partner processing.
- [x] Add source-contract coverage for all mutation paths and the partner exception.
- [ ] Pass exact-head CI/E2E and approved staging positive-read/negative-write verification; D1 remains OPEN.

 
## D10 — Dental Laboratory PARTNER-003 (2026-11-01)

- [x] Shared event-table reconciler repairs note / nullable fromStatus for both clinic and partner writers.
- [x] Additive migration prepared for previously created event tables; live migration not run.
- [x] PARTNER-003 covers clinic assignment to independent dental-lab owner.
- [x] Cover dashboard/orders, team visibility, technician assignment and production progression to delivered.
- [x] Assert delivered creates no DENTAL_LAB partner-economics transaction/ledger before verified settlement.
- [x] Verify durable event history, final clinic visibility and cross-laboratory isolation.
- [ ] Add QC checklist and authorized sign-off.
- [ ] Add explicit remake authorization / feedback loop.
- [ ] Add dispatch, shipping, pickup tracking and proof of delivery.
- [ ] Add independent services catalogue and pricing management.
- [ ] Complete invoice → payment → settlement → payout for the laboratory.
- [ ] Verify durable idempotent notifications and AI operational exception summaries.
- [ ] Complete owner/manager/technician RBAC and desktop/mobile acceptance. D10 remains OPEN.


## Standing product mandate — world-class dental-industry operating system and measurable recognition

**Persistent direction:** build DentVision as a world-class operating system for the entire dental and connected healthcare ecosystem, not as a clinic CRM with attached modules. This mandate applies across future implementation sessions and must remain visible in repository planning. Work that is only discussed in chat is not considered planned or completed until its scope, status, evidence and next action are recorded here or in the owning domain contract.

### Product outcome

DentVision must make the next correct action obvious for every participant: patient/buyer, doctor, clinic/group, diagnostic center, radiologist, medical laboratory, dental laboratory, technician, supplier/manufacturer, academy, lecturer, student, employer, job seeker, professional community and platform operations.

The experience must combine:
- one identity with multiple organization-scoped memberships and explicit active context;
- first-class partner workspaces with their own teams, workflows, economics and customer relationships;
- shared, auditable platform primitives for IAM, files, tasks, notifications, finance, settlement, search, analytics and AI;
- task-first Command Centers, queues and entity workbenches with progressive disclosure;
- complete web, mobile and Android/PWA workflows, not desktop-only feature parity;
- AI that understands the active role, organization and entity, proposes safe actions, asks for confirmation when required, executes only authorized actions and verifies the result.

### Non-negotiable engineering and product gates

1. **Master Spec first:** `docs/DENTVISION_MASTER_SPEC.md` v5.0 is normative. `docs/PRODUCT/CABINET_UX_AND_WORKFLOW_STANDARD.md`, the domain contracts and `docs/RELEASE_BLOCKERS.md` define acceptance and release constraints. Do not create a parallel product direction or duplicate an existing canonical route/domain model.
2. **Tenant safety:** every request, background job, file, notification, AI retrieval/tool, report and financial mutation must resolve the authenticated active context server-side. A client-supplied organization/clinic/branch/resource ID is not proof of access. Ambiguity fails closed.
3. **Workflow completion:** each cabinet is validated through entry → context → permission → Command Center → queue → entity detail → valid action → exception/rework → persistence → notification/handoff → finance/document/result → audit → mobile. A route, component, database model or screenshot is not proof of completion.
4. **Canonical records and event integrity:** preserve one canonical business record, explicit state machines, idempotent writes, immutable history where required, attributable actors/timestamps and compensating financial events. Do not silently overwrite or skip a workflow step.
5. **Clinical, financial and legal safety:** no AI diagnostic or treatment output becomes a clinical decision without the required professional confirmation. Do not recognize commission on order creation or delivery alone; use the approved settlement contract. Do not represent draft legal/EDS flows as legally operative.
6. **Real integrations only:** label manual entry, mock data, simulated providers and metadata-only DICOM as such. Do not claim PACS/LIS/CAD-CAM, carrier, Kaspi, EDS, government or equipment integration until the actual interface, credentials/contract, conformance and end-to-end evidence exist.
7. **Security and privacy:** close RB-029 and the full RB-035 matrix with protected, reviewable evidence; maintain key lifecycle, auditability, backup/restore, retention/deletion and PHI boundaries. Never perform production/staging PHI backfills or payment operations without the required approval, backup and rollback evidence.
8. **Quality and accessibility:** maintain generated maps/indexes, build, TypeScript, lint, unit/contract/integration/E2E, role/context isolation, browser/network, visual regression, keyboard/accessibility, responsive, Android and operational observability evidence. Do not suppress meaningful failures to make a gate green.
9. **No false readiness:** each vertical is explicitly `OPEN`, `PARTIAL`, `CANDIDATE` or `VERIFIED`; `VERIFIED` requires exact-HEAD evidence and any required external/operator acceptance. Prior SHA results do not certify a newer SHA.

### Implementation programme and current status

| Priority | Workstream | Current status | Required completion evidence |
|---|---|---|---|
| P0 | PR #352 partner-context and ecosystem changes | CANDIDATE; open PR, not merged | Exact-HEAD CI, Quality Gate, Partner Lifecycle/Role-Context E2E, migration bootstrap, mobile and browser evidence; resolve all failures before merge |
| P0 | CI source-map/index integrity | OPEN at `be324289` | Re-run the System Map generator, commit the generated map and prove the validation step is clean |
| P0 | Identity, active context, RBAC and tenant isolation | PARTIAL / release-gated | Full positive/negative matrix across every org type, branch, role, deep link, file, notification, job, finance action and AI tool |
| P0 | RB-029 PHI/AI memory lifecycle | OPEN / P0 in Release Blockers | Full reader/writer and derivative-data inventory, protected legacy backfill, key version/rotation and old-key plan, retention/deletion/export, backup/restore and approved staging reconciliation |
| P0 | RB-035 authorization matrix; RB-031 WebKit/CORS/WebSocket; RB-033 branch protection | OPEN / evidence-gated | Independent route/role/tenant review, production configuration evidence and repository-admin verification where connector permissions are insufficient |
| P0 | D1/D2 trial, archive and subscription lifecycle | OPEN until required staging proof | Positive-read/negative-write tests after expiry, archive/restore preservation and approved staging migration/rollback evidence |
| P1 | Supplier / Manufacturer OS | PARTIAL | Verified onboarding, multi-seller allocations, procurement, returns/RMA/claims, carrier integrations and proof-of-delivery, invoice/refund/chargeback, settlement/payout and reconciliation |
| P1 | Dental Laboratory OS (D10) | PARTIAL / D10 OPEN | Intake/completeness, production planning, technician workbench, digital files, CAD/CAM integrations, material/stock traceability, QC sign-off, remake authorization, shipping, invoices, settlement/payout and role/mobile acceptance |
| P1 | Medical Laboratory OS | PARTIAL | Full LIS lifecycle, physical accession devices, courier chain of custody, analyzer interfaces, calibration/external QC, critical-value acknowledgement, corrected-result delivery and settlement |
| P1 | Diagnostic Center OS | PARTIAL | Real RIS/PACS, DICOM receive/store/query/retrieve and modality worklist, viewer, reporting/sign-off, transfer retry/audit, maintenance/calibration and real modality conformance tests |
| P1 | Academy / Lecturer OS | PARTIAL | Cohorts, attendance, assignments, grading/review, reliable assessment and credential verification, instructor economics, refunds/payouts and learner mobile journey |
| P1 | Employer / Career OS | CANDIDATE / PARTIAL | Vacancy lifecycle, consent-aware messaging, interview/offer history, legal review, EDS-enabled contracts where applicable, onboarding and employer/worker lifecycle evidence |
| P1 | Existing clinic, doctor, reception, patient, finance, BI, community and admin cabinets | AUDIT REQUIRED | Complete role journeys using the cabinet standard; prioritize safety, task success, accessibility, mobile and cross-context isolation |
| P2 | DentVision AI Core / agents | CONTINUOUS; not certified complete | Context-bound retrieval, governed tool registry, permission checks, confirmation/verification/audit, domain evaluations, hallucination and PHI-leakage tests, latency/cost/quality observability |
| P2 | Shared Finance Hub and partner economics | PARTIAL | One canonical invoice/payment/settlement/ledger lifecycle, idempotent callbacks, transparent gross/fees/net, refund/chargeback compensation, reconciliation and partner payout evidence |
| P2 | Platform reliability and mobile | AUDIT REQUIRED | SLOs, monitoring/alerts, incident/recovery runbooks, backup restore tests, performance budgets, accessibility, offline boundaries and real Android runtime acceptance |
| P3 | Kazakhstan interoperability and public-sector readiness | STRATEGIC / NOT YET CERTIFIED | Legal/regulatory gap analysis, data-protection and medical-system review, verified HL7 FHIR/DICOM/EDS/NEPZ integrations as applicable, security assessment, pilot approvals and documented procurement/support model |
| P3 | Market credibility and industry recognition | STRATEGIC / OUTCOME-BASED | Reference customers, independently measured clinical/operational outcomes, interoperability conformance, security/privacy evidence, publications/case studies, partner ecosystem and transparent service reliability |

### Recognition and public-sector readiness

Recognition is an outcome of independently verifiable product quality and adoption, not a substitute for it. Build the evidence base in this order:

1. Demonstrate measurable value with real clinics and partners: reduced administrative time, fewer handoff failures, faster turnaround, higher traceability, better utilization and improved patient communication. Establish baselines and obtain customer-approved measurement before publishing claims.
2. Prove safety and trust: external security/privacy review, role and tenant isolation evidence, incident response, backup/restore drills, clinical governance and transparent AI limitations.
3. Prove interoperability: documented APIs and versioning, conformance tests, real partner/provider/device integrations and controlled data exchange. A protocol name in code or an AE Title field alone is not interoperability evidence.
4. Prove sustainable ecosystem economics: partners can see transparent fees and net payouts; DentVision can support the service with positive unit economics, reconciliation and reliable operations.
5. Build a Kazakhstan adoption path: obtain qualified legal/regulatory review, define the correct medical-data and integration obligations, run documented pilots with approved organizations, and prepare a public-sector proposal only after security, governance, procurement and support requirements are evidenced.
6. Publish credible evidence: customer-approved case studies, independent evaluations, technical documentation, standards/conformance reports and clear uptime/support commitments. Never claim government endorsement, certification, accreditation or clinical efficacy without formal evidence.

### Execution discipline

- Continue from the verified current branch/PR and preserve existing work; do not create duplicate branches or parallel implementations for the same domain.
- Before each slice, inspect the Master Spec, Release Blockers, current Execution Plan, cabinet standard, domain contract, route/API, schema, UI and tests.
- Fix the earliest real release/CI blocker before adding unrelated surface area. Commit source changes and matching docs together; regenerate generated files using their canonical scripts.
- After every slice, record exact changed files, commit SHA, tests, external dependencies, known limitations and next unblocked action in this file and the owning domain document.
- A CI result is valid only for the exact SHA it ran against. Do not merge, deploy or mark a vertical complete because an older run passed.
- Keep this programme active until all applicable acceptance criteria are met; do not silently drop unfinished rows when switching workstreams.

### Exact-head checkpoint — 2026-11-21

- Branch: `fix/partner-workspace-context-ux-20261120`; PR #352 targets `main`; observed head `be324289b8db23ce92b0f33f186b93ab2f6388e3`. PR is OPEN and unmerged.
- On that SHA, frontend lint, backend lint, both Quality Gate jobs and Vercel status passed; E2E was still running at the time of inspection.
- CI `lint-test` failed before `npm test`: the job ran `npm run system-map --prefix dentvision-backend`, which changed the generated `docs/SYSTEM_MAP.md`; `git diff --exit-code -- docs/SYSTEM_MAP.md` then failed. The source had 729 unique route handlers, 683 mounted HTTP routes and 160 Prisma models, while the committed map still said 722 / 680 / 157. This is generated-document drift, not evidence of a failing unit test; unit tests were skipped by that job.
- The same generated map reports 102 routes without a detected web/mobile consumer. This is an audit queue, not proof that every route is broken; reconcile each route to a real consumer, intentional server-only use or safe removal.
- Next action: sync the generated System Map from the canonical generator, commit the corrected output and rerun exact-HEAD CI. Then inspect the E2E result and all remaining gates before merge.


### Partner monetization correction — 2026-11-21

- Product-owner correction: partner cabinets are **not universally free**. DentVision's partner economy is defined by vertical-specific branch subscriptions, transaction commissions and revenue splits in `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.
- The earlier blanket-free amendment in that document contradicted its canonical commission tables and is removed. The commission and branch rates in Sections 5–9 are active policy inputs, subject to settlement-first recognition, transparent fee disclosure, volume tiers, minimums/caps and approved contract exceptions.
- Defined models: diagnostic centers 7% per DentVision-originated order plus branch subscription; medical-analysis laboratories 6% per analysis/order plus branch subscription; dental laboratories case commissions with volume tiers plus branch subscription; Marketplace sellers 8% standard take-rate with high-volume/strategic reductions; Academy/lecturer splits of 10/90, 25/75 or 30/70 according to acquisition source.
- Do not invent a tariff for employers or other verticals that lack an explicit rate. Clinic CRM subscriptions remain separate; do not charge a percentage of the clinic's total treatment revenue.
- Implementation must enforce pricing server-side and record immutable settlement snapshots. Verify billing, checkout, invoices, payouts, refunds, chargebacks and Finance Hub before treating a vertical as complete.
- The policy document has been corrected on the active PR branch. Exact-head CI is still required; no merge or release readiness is implied.

### Finance correctness fix — partial marketplace return dispute — 2026-11-21

- Found a state-integrity defect in `dentvision-backend/src/modules/finance/disputes.routes.ts`: the platform status endpoint changed a dispute to `resolved` before checking whether it contained item-level return records. The endpoint then returned HTTP 409 for the unsupported order-wide refund, leaving the dispute incorrectly marked resolved.
- Reordered the guard so item-level return disputes are rejected before the compare-and-set status mutation. The legacy full-order DentCash reversal remains unavailable for partial returns.
- Added a regression contract test asserting the partial-return guard occurs before the dispute compare-and-set and before `reverseCashback`.
- Commits: implementation `a96962b3bb50f8c28f138b352c9421623d3b4c17`; regression test `8b2d48362a90c8762ee11ef9382c7b2ad75f4ef7`.
- Verification limitation: source was re-read from GitHub after the writes; no local test runner was available in this session. Exact-head CI is required before this fix is considered verified or merged.

## Partner economy — canonical policy engine foundation — 2026-11-21

- Added \`dentvision-backend/src/modules/billing/partnerEconomics.ts\` as a pure, versioned calculation layer sourced from \`docs/business/DENTVISION_PARTNER_ECONOMICS.md\` v1.2.
- Added deterministic rules for diagnostic studies (7%, ₸500 minimum, ₸3,000 cap), medical analyses (6%, ₸150 minimum, ₸2,500 cap), dental-lab cases (10/8/7/6/5% by organization-level monthly GMV, ₸500 minimum, ₸15,000 cap), Marketplace seller tiers (8% standard, 6% high-volume, strategic 4–5% only when explicitly approved), and Academy acquisition-source splits (10/90, 25/75, 30/70).
- The engine returns policy version, gross, rate, minimum/cap, commission, partner net before external deductions and effective take-rate. It rejects invalid amounts and refuses to invent a strategic supplier rate.
- Added unit tests for published examples, every dental-lab volume boundary, Academy splits, invalid amounts and effective take-rate transparency.
- **Important boundary:** this is a calculation foundation, not proof of production monetization. It is not yet wired into all settlement, subscription, invoice, payout, refund, chargeback or Finance Hub paths. Do not recognize commission on order creation, assignment or referral acceptance. The next implementation slice must integrate it into the canonical settlement transaction and persist immutable policy snapshots; existing legacy calculations must be reconciled before activation.
- Audit finding in the active partner branch: \`diagnostics.service.ts\` currently computes a fixed 7% diagnostic fee while a referral is accepted/in progress, whereas the policy requires commission recognition only after successful settlement. This legacy path must be replaced by settlement-time calculation, with regression coverage for unpaid, paid, refunded and duplicate-settlement referrals.
- Diagnostic-center subscription enforcement still reads the legacy \`center_subscriptions\` table and starts a 30-day trial; reconcile it with the canonical organization/branch subscription model and ₸49,900 per active billable branch before claiming partner billing complete.
- Medical Laboratory, Dental Laboratory, Supplier and Academy must each be connected to the same versioned pricing/settlement contract, while retaining their distinct domain rates and organization-level volume aggregation.


### Exact-head continuation checkpoint — 2026-11-21 (partner economics / CI)

- Branch head: `93fc0df503f819e62d64372f506606393073061b` on PR #352; PR remains OPEN and unmerged.
- Previous CI on `b31dc721fa338e8f53d7fbc166e35f0e23c63ecf` exposed two actionable failures: backend TypeScript rejected runtime use of `Prisma.TransactionIsolationLevel` because `Prisma` was imported with `import type`; generated System Map was stale (731 unique handlers, 685 mounted routes, 103 routes without detected web/mobile consumer, 162 Prisma models).
- Fixed the runtime import in `dentvision-backend/src/modules/shop/shop.routes.ts` and synchronized `docs/SYSTEM_MAP.md` from the CI generator output. These changes are committed in the active PR branch.
- Audited diagnostic referral status handling and removed the legacy 7% `platformFee` calculation/write from ACCEPTED / IN_PROGRESS transitions, and stopped publishing that mutable field in referral status events. Referral cost/pricing remains available; commission is resolved by the paid-referral settlement path. Added a contract regression asserting pre-settlement fee calculation/publication is absent.
- CI rerun for the prior corrective head `2b65edc2655c7cfcb0b9a9f95c74d96dc58bcb47` was started; its checks were still in progress when this checkpoint was recorded. The newer diagnostic fix commit above requires its own exact-head CI evidence; do not treat earlier results as certification.
- Important integration audit finding: the repository already has a production-facing `modules/finance/partner-economics.service.ts` using minor-unit ledger accounting and persisted `CommissionRule` records, while the newly added `modules/billing/partnerEconomics.ts` is a separate KZT calculation foundation. The finance service currently declares numeric economics version 1 and only three partner verticals; the pure helper declares policy version 1.2 and includes Marketplace / Academy. These are duplicate policy authorities until explicitly unified. Do not activate a second calculator or claim Marketplace / Academy monetization complete.
- Diagnostic center subscription still uses legacy `center_subscriptions` and a 30-day trial; its acceptance error text still advertises ₸20,000/month, contradicting the canonical ₸49,900 / active billable branch policy. This remains OPEN and must be migrated with organization/branch billing, not patched by changing only the message.
- Next: verify exact-head CI on `93fc0df`; then reconcile the two economics engines into one minor-unit settlement contract with immutable policy-version snapshots, and migrate diagnostic branch billing to the canonical subscription model. Preserve existing ledger/idempotency/refund behavior and add tests before enabling new partner charges.
