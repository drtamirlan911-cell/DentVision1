# DentVision Kazakhstan — Government Partnership Strategy

**Status:** ACTIVE STRATEGY / IMPLEMENTATION CONTROL  
**Version:** 1.0  
**Date:** 2026-11-20  
**Owner:** DentVision by Dr.Tamirlan  
**Product source of truth:** `docs/DENTVISION_MASTER_SPEC.md` v5.0  
**Execution authority:** `DENTVISION_EXECUTION_PLAN.md`  
**Release/security authority:** `docs/RELEASE_BLOCKERS.md`

> This document defines a government-partnership strategy for DentVision. It does not amend the product constitution, promise government funding, establish a government endorsement, or authorize access to state or patient data. All legal routes, integrations, data processing and public-sector commitments require the applicable approvals.

## 1. Strategic decision

**Chosen direction:** a state-private partnership-oriented digital infrastructure project for the dental sector of the Republic of Kazakhstan.

**North-star proposition:** DentVision is a specialized Dental Operating System and ecosystem that can support public-health objectives and connect authorized participants across dentistry—while remaining interoperable with, not a replacement for, state health and e-government systems.

The strategic destination is a formal public-sector partnership where justified. The initial route is evidence-led: product readiness → regional pilot → independent evaluation → approved integrations/procurement or a formally planned PPP project where the legal and economic criteria are met.

Do not describe DentVision as an official state platform, national registry, eGov service, government contractor or government-approved clinical AI until written authority and applicable contracts exist.

## 2. Strategic outcomes

### Public value
- Reduce avoidable administrative burden and fragmented workflows in participating dental organizations.
- Improve continuity, traceability and patient access to authorized dental records.
- Support service availability and workforce/capacity planning through appropriately aggregated statistics.
- Improve referral coordination among clinics, diagnostic centers and laboratories.
- Support quality and safety through auditable clinical workflows and human-controlled AI assistance.

### Private-partner value
- Build a sustainable, multi-organization dental technology platform.
- Earn revenue through transparent SaaS, marketplace, education and approved service contracts.
- Establish repeatable implementation, support, security and integration capabilities.
- Retain product IP and commercial independence subject to public contract terms.

### Government-partner value
- Obtain measurable outcomes from a bounded pilot before making a scale decision.
- Avoid a new isolated state information silo by using approved interoperability patterns.
- Receive only the minimum authorized information required for a defined public purpose.
- Use documented service levels, auditability, portability and exit provisions.

## 3. Product boundary and Master Spec alignment

DentVision remains the whole-industry ecosystem described by Master Spec 5.0. The government strategy is an additional integration and public-value layer; it must not turn the product into a clinic-only CRM or create parallel identity, organization, patient, finance, authorization or AI systems.

The platform must preserve these invariants:
1. One identity, multiple authorized organization memberships and explicit active context.
2. Organization and branch are security boundaries; client-supplied IDs are never authorization proof.
3. Participant parity: patients, professionals, clinics, diagnostic centers, medical and dental laboratories, suppliers, academies, employers and other governed organizations remain first-class.
4. AI operating sequence: intent → context → permission → plan → preview → confirmation when required → execute → verify → audit.
5. Clinical AI is assistive. A qualified authorized clinician retains clinical responsibility and required sign-off.
6. A route, dashboard, model or screenshot is not evidence that a workflow is complete; persistence, permissions, audit, error states, tests and operational proof are required.

## 4. Public-sector engagement model

Use a staged engagement model. Do not jump directly to a national PPP proposal.

### Track A — discovery and institutional dialogue
Potential counterparts, subject to mandate and current organizational structure:
- Ministry of Healthcare of the Republic of Kazakhstan: clinical policy, sector needs and health-system compatibility.
- Ministry responsible for artificial intelligence and digital development: digital architecture, interoperability and innovation-policy alignment.
- Akimat of Zhambyl Region and Taraz city: regional pilot sponsorship, participating organizations and local outcome measurement.
- QazInnovations / relevant innovation operators: eligibility and grant route.
- Astana Hub: participant eligibility, tax regime and ecosystem programmes.
- Atameken and professional dental associations: sector validation, clinic recruitment and feedback.

The first ask is a technical/sector working meeting and permission to develop a bounded pilot concept—not a request for unrestricted data or a guaranteed state purchase.

### Track B — regional pilot
Propose a voluntary, bounded pilot in Taraz / Zhambyl Region with a small cohort of independently participating organizations. Select sites only after written participation, legal review, technical readiness and baseline measurement.

Pilot candidates should represent different workflows where feasible: dental clinic, diagnostic center, dental laboratory and patient-facing journey. No public-sector organization is presumed committed.

### Track C — scale decision
After independent evaluation, select the legally appropriate path:
- ordinary public procurement for a defined product/service where procurement rules apply;
- innovation grant or commercialization support;
- service or cooperation agreement where lawful and appropriate;
- formal PPP only if a public partner confirms the project qualifies and the feasibility, value-for-money, risk allocation, procurement and approval requirements are satisfied.

A memorandum of understanding is not a PPP contract and does not guarantee procurement, budget allocation, exclusivity or endorsement.

## 5. Government-facing product scope

Create a bounded **Government & Public Health integration capability**, not a second platform or a privileged superuser backdoor.

### Initial capability set
- **Public Health Analytics:** aggregated, de-identified indicators for approved purposes; suppression of small cohorts and re-identification risk controls.
- **Regional Service Capacity:** aggregate supply, service availability and workforce indicators, subject to data quality and lawful data sources.
- **Referral Interoperability:** authorized clinic ↔ diagnostic center ↔ laboratory workflow exchange.
- **Organization Verification:** consume authoritative verification signals only through approved sources; DentVision verification must not be represented as state accreditation.
- **Audit & Compliance Evidence:** immutable/append-only audit evidence for access and actions, retention schedules and exportable compliance reports.
- **Integration Gateway:** versioned APIs, consent/authority checks, schema validation, rate limits, monitoring and revocation.
- **Patient Access:** patient-controlled access to their own information and records, subject to identity assurance and applicable law.

### Explicit non-goals
- No duplicate national patient registry or state eGov identity system.
- No unrestricted state access to identifiable patient records.
- No automated clinical diagnosis, treatment decision or state enforcement decision.
- No exchange with state systems until the receiving system, legal basis, data contract, security requirements and test environment are confirmed.
- No claim of HL7/FHIR compliance merely because an API uses JSON; conformance profiles and tests are required.

## 6. Legal, privacy and security gates

Before any pilot involving real patient information, obtain Kazakhstan-qualified legal and information-security review covering at least:
- personal data and their protection, medical secrecy and health-code requirements;
- lawful purpose, legal basis, consent where required, notices and patient rights;
- data controller/operator roles, processor terms and cross-organization responsibilities;
- localization/storage and cross-border transfer restrictions applicable to each data category;
- retention, correction, access, export, deletion and legal holds;
- information-security classification, access controls, incident response, backup and disaster recovery;
- electronic documents, electronic signatures and identity assurance where required;
- medical-device/software qualification questions for any diagnostic or treatment-claiming AI feature;
- procurement, PPP, competition, state-aid and intellectual-property implications.

Security design requirements:
- tenant/organization/branch isolation; least privilege; scoped service identities;
- MFA and strong administrative access controls;
- encryption in transit and at rest, documented key custody and rotation;
- PHI minimization in logs, telemetry, AI prompts, embeddings, caches and backups;
- auditable consent/authority checks and access events;
- tested backup restoration, incident response and revocation;
- separate development, test, staging and production environments with synthetic data in non-production;
- independent penetration/security assessment before production pilot.

No historical PHI backfill, production migration, key rotation, data export or live integration may be performed without a documented target, backup/rollback evidence, approved operator window and explicit authorization.

## 7. Technical interoperability principles

- Treat the government gateway as an adapter layer around existing canonical DentVision domains; do not duplicate patient, organization or authorization models.
- Use versioned, documented APIs and event contracts with idempotency, correlation IDs, replay protection and explicit error semantics.
- Evaluate HL7 FHIR resources/profiles and terminology mappings against the actual receiving system's implementation guide. Use DICOM/DICOMweb only for applicable imaging workflows and confirmed counterpart support.
- Support electronic signature and trusted identity only through approved Kazakhstan mechanisms and counterpart specifications.
- Use synthetic fixtures and conformance tests before any live connection.
- Require a signed data-sharing/integration agreement, purpose limitation, data dictionary, security review and operational owner for each interface.

## 8. Pilot design: Taraz / Zhambyl Region

### Pilot hypothesis
A shared, secure workflow layer can reduce administrative friction and improve traceability across participating dental providers and their authorized diagnostic/laboratory partners.

### Proposed 90-day pilot structure
**Weeks 1–2 — baseline and readiness**
- recruit and obtain written commitments from pilot participants;
- map existing workflows and establish baseline measures;
- confirm legal roles, lawful data flows, consent and security controls;
- agree success thresholds, exclusions, incident process and exit plan.

**Weeks 3–4 — controlled configuration**
- configure organization memberships, roles, branches and workflows;
- train staff using synthetic data;
- run negative authorization, audit, backup/restore and incident-response tests;
- sign off the pilot go/no-go checklist.

**Weeks 5–10 — limited operation**
- activate only approved workflows and participant groups;
- weekly operational reviews and issue triage;
- measure outcomes without expanding data scope;
- pause affected workflows immediately on a material privacy, security or clinical-safety incident.

**Weeks 11–12 — evaluation**
- compare results against baseline;
- independent review of security, usability and data quality;
- document costs, support burden, limitations and participant feedback;
- produce a scale / revise / stop recommendation.

### Candidate pilot KPIs
Set numeric thresholds only after baseline measurement and participant agreement:
- median administrative time per defined workflow;
- referral completion and turnaround time;
- percentage of records with required fields and traceable authorship;
- appointment no-show and rescheduling rates where measurable;
- laboratory/diagnostic handoff delays;
- user adoption and task completion;
- security/privacy incidents and time to resolve;
- patient access success and complaint rate;
- total cost per participating organization and support hours.

Do not use raw patient counts or identifiable data as vanity metrics. Publish only approved aggregated results.

## 9. Funding and commercial strategy

Pursue multiple independent routes; never build the operating plan around an assumed grant.

### Route 1 — QazInnovations commercialization grant
The public service page describes a two-stage review and a 45-working-day service period. A currently published Astana Hub programme page describes eligibility conditions including MVP/prototype, a team and accelerator/incubator participation, and lists MedTech/BioTech among directions; it advertises stage ceilings of up to KZT 20 million and KZT 80 million. These figures and conditions are programme-page information, not an entitlement or confirmation that a call is open. Re-check the current competition, rules, eligible costs, co-financing and application dates directly with QazInnovations before applying.

### Route 2 — Astana Hub
Assess eligibility of the actual legal entity, activity codes, revenue model, IP ownership, tax obligations and restrictions. Hub participation is conditional; it is not automatic funding and does not replace medical-sector approvals.

### Route 3 — regional pilot support
Seek lawful in-kind support, access to pilot participants, facilities, expert time and regional innovation programmes. Budgetary support must have a documented legal and procurement basis.

### Route 4 — commercial revenue and investment
Maintain SaaS, marketplace, academy and approved integration revenue. Consider strategic investors only with clear IP, data, governance and conflict-of-interest terms.

### Route 5 — formal PPP / public procurement
Prepare a separate feasibility case only after a public partner identifies a public need and confirms the applicable route. Include lifecycle cost, value for money, measurable public outputs, risk allocation, service levels, payment model, interoperability, data ownership/control, IP rights, continuity, audit, termination and exit/portability.

## 10. Twelve-month implementation roadmap

### Phase 0 — strategy and evidence (weeks 1–2)
- adopt this strategy as a subordinate domain document;
- create a claims register distinguishing verified, proposed and unverified capabilities;
- prepare stakeholder map and pilot concept note;
- build a traceability matrix from public requirements to Master Spec, implementation and evidence.

**Exit:** strategy reviewed; no unsupported claims; pilot scope and owners defined.

### Phase 1 — release/security foundation (weeks 2–8; parallel to product work)
- execute the current canonical order in `DENTVISION_EXECUTION_PLAN.md`;
- close P0 privacy/security issues and required negative authorization evidence;
- complete approved staging proof for subscription/archive lifecycle;
- verify branch protection, browser/network security and backup/restore;
- establish clinical sign-off controls and safe AI boundaries.

**Exit:** relevant P0 gates closed with exact-head CI and operational evidence; no unresolved critical security findings.

### Phase 2 — pilot-ready product slice (weeks 6–12)
- finish selected end-to-end clinic ↔ diagnostic/lab workflows;
- implement only the bounded aggregate analytics and integration capabilities required for the pilot;
- complete mobile/browser and role-based acceptance for pilot roles;
- establish support, monitoring, training and incident processes.

**Exit:** pilot Definition of Ready signed by product, security, legal and pilot operator.

### Phase 3 — regional pilot (months 4–6)
- run the 90-day controlled pilot;
- publish a privacy-safe evaluation report;
- document cost and operational support model.

**Exit:** independently reviewable evidence for public value, safety, usability and cost.

### Phase 4 — institutional scale proposal (months 7–9)
- present results to relevant ministries, regional authorities and sector bodies;
- select procurement, grant, cooperation or formal PPP route with legal advice;
- prepare technical architecture, feasibility and financing pack.

**Exit:** written next-step decision from a competent counterpart; no assumed endorsement.

### Phase 5 — scale preparation (months 10–12)
- strengthen service operations, regional onboarding and partner support;
- formalize SLAs, disaster recovery, portability and audit reporting;
- prepare staged expansion only after approval and capacity review.

**Exit:** signed agreements, approved budgets/procurement route where applicable, operational readiness and repeatable deployment process.

## 11. Governance and accountability

Establish a small internal steering group with named accountable owners:
- Product owner: strategy, scope and Master Spec alignment.
- Engineering/security owner: architecture, IAM, security, release gates and incident response.
- Clinical safety lead: clinical workflows, AI boundaries and clinician sign-off.
- Legal/privacy lead: data roles, agreements, regulatory review and claims approval.
- Pilot operations lead: participant recruitment, training, support and KPI collection.
- Finance/grants lead: budget, grant compliance, procurement and reporting.

No person may approve their own production data access exception. Public claims, logos, partner names and references require written permission.

## 12. Risks and controls

| Risk | Required control |
|---|---|
| Government funding not awarded | Maintain commercial runway and stage-gated spending |
| Pilot mistaken for endorsement | Written communications and claims register |
| PHI exposure or cross-tenant leak | Least privilege, negative tests, encryption, audit and incident plan |
| Regulatory classification of AI | Clinical/legal assessment before claims or deployment |
| Integration incompatibility | Counterpart-approved profiles and conformance tests |
| Procurement/PPP route invalid | Early legal and PPP-center review; no premature PPP label in contracts |
| Vendor lock-in concerns | Data export, open API contracts, exit and continuity provisions |
| Product scope dilution | Master Spec 5.0 remains normative; no duplicate domains |

## 13. Immediate execution backlog

1. Add this strategy to the canonical documentation index.
2. Create a public-sector claims register and a pilot one-pager.
3. Create a requirement-to-evidence traceability matrix; map each requirement to an existing domain, owner, test and blocker.
4. Continue the existing P0/P1 execution order; do not divert engineering capacity from critical security and release blockers.
5. Draft a synthetic-data-only pilot demonstration and architecture pack.
6. Conduct legal/privacy and medical-software qualification review before real-data pilot.
7. Request exploratory meetings with regional and national counterparts only after the concept note and evidence pack are ready.
8. Validate current grant calls and Astana Hub eligibility; submit only after MVP, team, legal entity and required programme prerequisites are evidenced.

## 14. Decision rules

- Master Spec 5.0 and Product DNA outrank this strategy on product behavior and quality.
- Execution Plan controls engineering sequence and Definition of Done.
- Release Blockers control operational safety and release readiness.
- This strategy cannot waive a release blocker, security gate, clinical approval, legal requirement or user consent.
- If a government requirement conflicts with patient safety, privacy, product integrity or applicable law, pause and obtain documented legal/clinical review.
- Reassess this strategy quarterly and after any material change in law, government programme or product architecture.

## 15. Official reference points

- Kazakhstan public-private partnership overview: https://www.gov.kz/situations/338/885?lang=en
- QazInnovations: https://qazinn.kz/ru
- Government service — innovation grants for technology commercialization: https://www.gov.kz/services/3563?lang=ru
- Astana Hub QazInnovations grant programme information: https://astanahub.com/ru/l/meanofsupportQazInnovations
- Ministry of Healthcare: https://www.gov.kz/memleket/entities/dsm
- Adilet legal information system: https://adilet.zan.kz/

**Reference date:** 2026-11-20. Verify current legal texts, calls, eligibility and institutional mandates before submitting any application or signing an agreement.
