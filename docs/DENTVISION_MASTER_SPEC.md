# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 1.0  
**Date:** 2026-09-11  
**Owner:** DentVision by Dr.Tamirlan

> This is the single normative source of truth for DentVision product/system intent. Older product documents may be retained temporarily only for migration, but they do not override this document.

## 1. Product identity

DentVision is a **Dental Super App / ecosystem**: one product unifying clinical operations, AI, education, marketplace, diagnostics, laboratory workflows, professional community, jobs, finance and supporting services.

DentVision is not merely a CRM. CRM is a core clinical/business surface inside the wider ecosystem.

## 2. Core model

DentVision follows:

1. **One identity** — one account may participate in multiple product surfaces and organizations according to permissions.
2. **One ecosystem** — Clinic/CRM, AI, Shop, Academy, Community, Jobs, Diagnostics, Laboratory and Finance share identity, navigation principles and platform infrastructure.
3. **One AI command layer** — AI is available throughout the product and uses only authorized context.
4. **One trust boundary** — authentication, RBAC, tenant isolation, auditability and secure defaults apply to every protected function.

## 3. Entry, Welcome and navigation

### 3.1 Welcome / first entry

The current product flow intentionally includes a **Welcome screen and service cards**. They are the ecosystem discovery/entry layer and remain part of the product.

Canonical flow:

`Welcome → service choice → auth/registration when required → selected surface → AI Workspace when applicable`

The Welcome experience must be functional, understandable, fast and skippable. Animation must never block the product.

### 3.2 AI Workspace

For authenticated operational users, **AI Workspace is the central working interface**. It combines conversation/command, authorized context, actions, suggested next steps, navigation and proactive event-driven assistance.

AI Workspace does not replace service cards or public discovery; it becomes the primary operational layer after entry.

### 3.3 Navigation rules

- One primary action per region.
- No duplicate canonical destinations.
- A user always understands current location, active organization and consequence of an action.
- Service cards may point to canonical destinations but must not create a second workflow.
- Mobile navigation uses progressive disclosure and keeps active context visible.

## 4. Users and RBAC

DentVision uses **one unified RBAC model** combining primary personas and specialized roles.

Primary personas:

- Doctor / Врач
- Owner / Владелец
- Administrator / Администратор
- Buyer / Покупатель

Specialized roles may include Assistant, Cashier/Finance, Laboratory Staff, Diagnostic Center Staff, Manager, Student, Superadmin, Seller and Lecturer.

A persona is not permission. Capabilities come from RBAC + organization membership. A user may have different roles in different organizations.

## 5. Organizations and tenant model

DentVision supports **multiple organizations per identity**.

- There is an explicit active organization/tenant context.
- Switching organizations requires authorization.
- Protected requests derive/validate tenant scope server-side.
- Client-supplied `clinicId`/organization ID is never trusted as authorization.
- Organization membership is checked server-side.
- Object IDs are never authorization.
- Cross-tenant access must fail even with a valid foreign object ID.

Supported organization types include dental clinic, diagnostic center, dental laboratory, academy/school, marketplace partner/seller and future approved ecosystem organizations.

## 6. Medical-data boundary

Medical records are tenant-scoped. Approved global/shared-reference data such as standardized codes/catalogs may be shared.

Protected medical graph:

`Patient → Visit → Diagnosis → Treatment Plan → Procedure/Treatment → Lab Order → Diagnostic Referral → Files/Results → AI Context`

Every hop must enforce authorization and tenant ownership. Replacing any ID in a URL, query, body or nested object must not expose or mutate another tenant's data.

## 7. AI policy

AI is an operating layer, not decorative chat.

AI may understand authorized context, summarize, draft documentation, recommend actions, detect events, notify relevant users, assist diagnostics/treatment planning and connect users to ecosystem services.

### Risk-based autonomy

- Low-risk operational actions may be automated when explicitly allowed.
- Medium-risk actions require confirmation when policy/permissions demand it.
- Clinically meaningful or irreversible actions require appropriate human confirmation unless a separately approved policy explicitly authorizes otherwise.

AI never bypasses RBAC, tenant isolation, audit requirements or clinical responsibility.

## 8. Core ecosystem surfaces

### Clinic / CRM

P0 clinical/business surface: patients, appointments, medical records, visits, odontogram, diagnosis, treatment plans, documents, diagnostics, laboratory workflows, inventory, finance, reminders, communication and analytics as implementation maturity permits.

CRM must behave as a practice operating system, not disconnected CRUD pages.

### Diagnostics

Clinics can order authorized studies from diagnostic centers. Results return to authorized clinical workflows. AI may summarize/interpret inputs, but clinically meaningful conclusions require appropriate professional review.

### Laboratory

Laboratory is a **first-class organization type and ecosystem participant**.

Canonical flow:

`Clinic/Doctor → Lab Order → Laboratory → Production/Status → Result/Delivery → Clinical Record`

Laboratory has its own operational workspace while patient/clinic access remains explicitly permissioned and tenant-scoped.

### Shop / Marketplace

Marketplace is an ecosystem surface, not a detached storefront. Products/services may connect to authorized clinical context. AI recommendations must be transparent and never replace professional judgment.

### Academy / School

Learning, practice, certification and professional development, sharing identity/infrastructure with the ecosystem without becoming a clinical-record surface.

### Community

Professional social surface, distinct from clinical records and clinic operations.

### Jobs

Professional marketplace surface, distinct from internal clinic staffing workflows.

### Finance

Operational clinic and ecosystem/business finance according to role and organization permissions. Sensitive financial data remains tenant-scoped.

## 9. Service cards

Service cards are explicitly valid because DentVision is an ecosystem.

Rules:

- discovery only; the card opens the canonical destination;
- no duplicate workflows;
- unavailable services must be clearly marked;
- role/authorization may control visibility;
- public discovery never exposes private organization/patient data.

## 10. UX and visual system

DentVision must have a premium, distinctive dental-product identity rather than a generic AI/SaaS template.

Required principles:

- custom visual language;
- restrained effects/gradients;
- no generic AI-incubator appearance;
- no emoji as primary UI iconography;
- strong hierarchy and typography;
- realistic/high-end presentation where useful;
- accessibility and responsive behavior;
- purposeful animation only.

**Figma is the visual implementation reference.** This Master Spec is authoritative for product rules and behavior.

## 11. Security and privacy

Security is a product requirement.

Mandatory:

- authentication before protected operations;
- server-side RBAC;
- tenant isolation;
- object-level authorization;
- least privilege;
- auditability of sensitive actions;
- safe file access;
- no trust in client tenant identifiers;
- IDOR resistance across nested resources;
- secure defaults;
- privacy-by-design for medical data.

A release is not acceptable if changing an ID can expose or mutate another organization's data.

## 12. Architecture intent

Implementation may evolve, but the platform direction is:

- React/TypeScript frontend where applicable;
- Node/Express/TypeScript backend where applicable;
- PostgreSQL/Prisma data layer where applicable;
- authenticated APIs with server-side authorization;
- shared identity and organization context;
- event-driven AI capabilities;
- modular product surfaces over common platform primitives.

Technical architecture documents describe implementation. They cannot redefine product intent.

## 13. Release gate

Every release candidate must satisfy:

1. Authentication/session integrity.
2. Server + UI RBAC enforcement.
3. Tenant isolation and IDOR resistance.
4. Critical medical workflows.
5. Critical service-entry/marketplace/academy flows.
6. Clear navigation and no duplicate canonical destinations.
7. Mobile/responsive usability.
8. No critical build/runtime errors.
9. Auditability of sensitive actions.
10. Regression tests for fixed security/UX defects.

CI/checklist files may implement this gate; this document defines it.

## 14. Strategic priorities

Default priority:

1. Identity, trust, tenant isolation and security.
2. Core Clinic/CRM.
3. AI Workspace and orchestration.
4. Diagnostics + Laboratory.
5. Marketplace/Shop.
6. Academy/School.
7. Community + Jobs.
8. Advanced Finance/Analytics/ecosystem expansion.

Security/reliability issues remain P0 regardless of module order.

## 15. Definition of done

A feature is done only when:

- it has one clear canonical destination;
- permissions are enforced;
- tenant scope is correct;
- loading/empty/error/success states work;
- mobile behavior is handled;
- duplicate functionality is removed or intentionally linked;
- critical paths have tests;
- implementation matches this Master Spec;
- product decisions are documented here rather than in another competing product document.

## 16. Documentation governance

### Canonical

`docs/DENTVISION_MASTER_SPEC.md` is the **single normative product/system source of truth**.

### Allowed non-normative technical artifacts

The repository may retain documents that serve engineering/history and do not redefine product intent, including:

- generated system maps;
- CI/QA artifacts;
- technical debt;
- compliance evidence;
- API/schema/generated documentation;
- changelog/history.

These describe implementation or history; they do not override the Master Spec.

### Deprecated product documents

Older missions, product DNA/constitution copies, blueprints, master plans, north stars, execution contracts, module specifications, AI strategies, role specifications, release plans and historical audits are superseded after migration and must be removed from the active documentation surface.

## 17. Conflict resolution

When sources disagree:

1. **This Master Spec wins for product/system intent.**
2. Existing code/tests establish what currently exists; implementation must be aligned to this spec rather than silently changing the spec.
3. Figma governs visual implementation details within these product rules.
4. Changelog/history records what happened but never overrides the current specification.

No new competing master plan, blueprint, constitution, north star or parallel product specification may be created.

## 18. Explicit product-owner decisions — 2026-09-11

- Product identity: **Dental Super App / ecosystem**.
- AI Workspace: **central authenticated working interface**.
- Welcome screen + service cards: **remain in the current flow**.
- Roles: **one unified RBAC model combining primary + specialized roles**.
- Organizations: **multi-organization identity with explicit active tenant**.
- Medical data: **tenant-scoped; approved shared-reference data may be global**.
- AI autonomy: **risk-based**.
- Laboratory: **first-class organization type within the ecosystem**.
- Ecosystem surfaces: **distinct but unified**.
- Visual governance: **Figma + Master Spec**, with this document authoritative on product rules.
- Documentation: **one canonical product/system document; technical/history artifacts may remain**.

## 19. Maintenance rule

When a product decision changes, update this document first. Do not create a second document to resolve the change.

Every implementation task must check this Master Spec plus the relevant code and tests before changing behavior.
