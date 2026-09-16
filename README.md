# DentVision

**DentVision by Dr.Tamirlan** — a Dental Operating System and ecosystem for the whole dental industry.

DentVision connects professional work, patient access, clinics, diagnostic centers, medical and dental laboratories, suppliers, marketplace commerce, Academy, Jobs, Community, Finance and AI through one identity and shared context.

It is **not a clinic CRM with extra tabs**. Clinics are one first-class participant type alongside partners, professionals, patients/buyers and education/business organizations.

## Canonical documentation

| Purpose | Source |
|---|---|
| Product/design quality law | [`docs/00_CONSTITUTION/02_PRODUCT_DNA.md`](docs/00_CONSTITUTION/02_PRODUCT_DNA.md) |
| Product + system source of truth | [`docs/DENTVISION_MASTER_SPEC.md`](docs/DENTVISION_MASTER_SPEC.md) |
| Execution order / Definition of Done | [`DENTVISION_EXECUTION_PLAN.md`](DENTVISION_EXECUTION_PLAN.md) |
| Verified current state | [`DENTVISION_CONTEXT.md`](DENTVISION_CONTEXT.md) |
| Durable implementation evidence | [`DENTVISION_EXECUTION_LOG.md`](DENTVISION_EXECUTION_LOG.md) |
| Partner economics | [`docs/business/DENTVISION_PARTNER_ECONOMICS.md`](docs/business/DENTVISION_PARTNER_ECONOMICS.md) |
| Code-generated system facts | [`docs/SYSTEM_MAP.md`](docs/SYSTEM_MAP.md) |

Historical/superseded product roadmaps must not be used as a competing source of truth.

## Product model

One identity, multiple authorized contexts, one ecosystem and one AI/action layer.

```text
DentVision
├── Home / Discovery
├── AI
├── Practice / Clinical
├── Diagnostics / Radiology
├── Medical Laboratory
├── Dental Laboratory
├── Shop / Marketplace
├── Academy / Learning
├── Network
├── Jobs
├── Community
├── Finance / Analytics
└── Administration
```

The visible interface uses progressive disclosure. A user should see the next useful action, not the entire platform architecture at once.

## Core ecosystem journeys

```text
Patient / Buyer
  → discovery → provider/service → booking/order → follow-up

Doctor / Clinic
  → patient → case → diagnosis/imaging → plan → treatment → lab/materials → payment

Diagnostic Center
  → service → referral → study → result → authorized delivery → economics

Medical Laboratory
  → analysis → referral → processing → result → settlement

Dental Laboratory
  → lab order → production → QC/remake → delivery → economics

Supplier
  → catalog → inventory → order → fulfillment → payout

Academy / Lecturer / Student
  → course → enrollment → learning → assessment → certificate

Professional / Employer
  → profile → network/jobs → match → application/hiring
```

## AI Operating Layer

AI routes intent to the correct capability while respecting authorization:

`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

Examples:

- Find a course → Academy.
- Find equipment/materials → Shop.
- Find a laboratory/diagnostic center → Network.
- Show my schedule → Practice.
- Analyze an authorized diagnostic file → Diagnostics/AI.
- Explain business performance → Finance/Analytics.

AI does not replace clinical judgment and never bypasses tenant, branch, consent, role or audit controls.

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- State/data: Zustand, React Query
- UI: shared DentVision design system, Radix UI, Framer Motion
- Backend: Node.js, Express, Prisma
- Database: PostgreSQL
- AI: intent routing, AI Employee and governed tool/action layer
- Web/mobile: shared product contracts with Android implementation

## Development rule

Work from the real repository and current CI/runtime evidence:

`Inspect → implement → test → fix → verify → document → continue`

Preserve existing functionality and source-of-truth models. Do not create parallel patient, booking, laboratory, inventory, organization, economics or authorization systems merely to make a screen appear complete.

## Local development

Use the commands and environment documented in the active package manifests and `DENTVISION_CONTEXT.md`. The repository contains both web and Android surfaces; verify the actual target before running platform-specific commands.

## Release

A route or visual screen is not proof of completion. A workflow is complete only when its real source of truth, permissions, persistence, UX states, tests and verification evidence agree.
