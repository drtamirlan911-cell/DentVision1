# DentVision Master Constitution v1.0

Status: ACTIVE — SINGLE PRODUCT SOURCE OF TRUTH
Date: 2026-09-09

## 1. Product identity
DentVision is a Dental Super App + Dental Operating System + AI OS + ecosystem. It is not merely a CRM with AI features.

North-star statement:
> DentVision — приложение, которое позволяет стоматологу творить чудо в один клик.

The product should combine the strongest practices of leading global product ecosystems while remaining an original DentVision product. Initial market: Kazakhstan; architecture must be capable of international expansion.

## 2. Product scope
DentVision connects and orchestrates:
- clinic and doctor operations;
- patients and Patient 360;
- clinical records and treatment;
- diagnostics and laboratories;
- AI clinical and business workflows;
- finance and analytics;
- marketplace/shop;
- education;
- jobs;
- professional community;
- patient-facing experience;
- documents, consent and electronic signing.

## 3. Experience principles
The UX target combines the quality bar of Kaspi, Apple, OpenAI, Linear, Notion and Claude without copying their interfaces.

The interface must be intuitive, premium, fast and calm. Avoid overloaded screens, duplicated functionality, unclear navigation and fake functionality.

Default home experience:
1. AI greets the user.
2. AI summarizes the important items for the day.
3. AI exposes relevant next actions.
4. AI then visually recedes so the user's service cards/workspace becomes the primary working surface.

Service discovery uses a combination of sidebar, command center, search/command palette and adaptive service cards. The design must prevent service-card overflow and preserve hierarchy.

## 4. Navigation
Core sidebar includes, where relevant:
- Home / AI Workspace
- CRM / Patients
- AI Team
- Shop
- School / Academy
- Analytics
- Jobs
- Community
- Profile
- Settings

Top-level persistent controls may include logo, clinic switcher, notifications, AI assistant and patient quick search. Navigation must remain coherent across roles.

## 5. AI OS
AI is a system-wide orchestration layer, not a standalone chat.

AI capabilities include:
- AI Assistant
- Diagnosis AI
- CBCT AI
- TMJ AI
- Smile Design
- Treatment Planner
- AI Business
- AI Education

Priority is determined by dependency and clinical/business value, not by arbitrary feature order. Foundational AI orchestration and clinical context come before peripheral AI experiences.

AI lifecycle:
IDLE → THINKING → EXECUTING → RESULT → CONFIRMATION

AI may prepare or execute supported actions only within explicit authorization boundaries. Consequential clinical, financial, permission, deletion and legally significant actions require explicit user confirmation. Informational/non-mutating operations may be completed without an extra confirmation where safe.

Clinical AI must explain its reasoning/evidence, confidence and limitations. AI output is preliminary decision support; it never silently becomes the physician's final diagnosis.

## 6. Patient 360 / Clinical Core
Patient 360 is a foundational object across the product, not an isolated CRM page.

It should unify, subject to permissions:
- identity and contacts;
- medical history;
- odontogram;
- diagnoses;
- appointments;
- treatment plans;
- procedures and clinical notes;
- prescriptions/recommendations;
- photos and imaging;
- CBCT/diagnostic results;
- laboratory workflow;
- documents and signatures;
- payments/financial context;
- communications;
- AI history and recommendations;
- audit/history.

Clinical workflows must minimize navigation and duplicate data entry.

## 7. Odontogram and 3D
Initial clinical odontogram is 2D and must remain fast and touch-safe. Its domain model and component boundaries must be extensible toward a real 3D/WebGL dental model without requiring a destructive rewrite.

## 8. Documents and electronic signatures
DentVision must have a document orchestration layer.

When a service, treatment, procedure, diagnostic action or other workflow requires documentation, the system should determine the applicable document set from configured rules, generate/populate the required documents from trusted data, present them to the appropriate parties, and support electronic signing inside the application.

Supported parties include patients and clinicians; organization-specific signers/roles may be added through permissions.

The workflow must track:
- document type/version;
- source workflow/action;
- generated data;
- signer identity and role;
- signing status;
- timestamps;
- consent where applicable;
- audit trail;
- immutable/traceable final document state.

No legal claim of compliance is made merely by implementing this architecture; launch compliance requires validation against applicable Kazakhstan law and professional/legal requirements.

## 9. Patient experience
A dedicated patient-facing experience is required. Patients should be able to access appointments, treatment information, documents, signing, payments, communication, recommendations and other permitted functions through the product.

## 10. Business ecosystem
### Shop
A full dental marketplace experience inspired by the breadth and convenience of Kaspi Shop, but with original DentVision UX. Include catalog, search, categories, filters, product pages, sellers, cart, orders, payment, delivery, ratings/recommendations and B2B dental commerce as applicable.

### School
A full education platform with courses, AI Education, assessments/exams, certificates and progress.

### Jobs
A professional dental employment marketplace, not merely a static vacancy board.

### Community
A professional social/community product for dentistry.

### Finance / Analytics
Cover clinic finance, cashier, payments, income, expenses, payroll where applicable, debts, profitability and business analytics including unit economics, CAC, LTV, MRR, churn and forecasting where data quality permits.

## 11. Clinic ecosystem
DentVision connects:
Clinic ↔ Doctor ↔ Patient ↔ Laboratory ↔ Diagnostic Center.

Electronic referrals are first-class workflows and must carry structured patient, clinical and diagnostic context appropriate to the referral.

## 12. Web and Android
Web and Android must have the same product semantics, domain rules, API contracts, permissions and workflow outcomes. Presentation may adapt to device constraints.

The approved approach is shared design language + shared UX logic + device-appropriate presentation, not forced pixel identity.

Android supports partial offline operation with a synchronization layer and conflict resolution. Offline scope includes appropriate cached patient data and drafts/queued changes for key clinical workflows, subject to security and permissions.

## 13. Security and compliance
Security is a product invariant, not a later feature.

Required foundations include:
- tenant isolation;
- server-side RBAC/permissions;
- IDOR protection;
- authentication/session security;
- audit logging;
- encryption in transit and at rest where applicable;
- secure document/signature handling;
- rate limiting;
- security headers;
- backups and recovery strategy;
- consent management;
- privacy/data governance;
- observability;
- applicable Kazakhstan medical, personal-data, electronic-document/signature and other legal requirements;
- international privacy/security best practices where appropriate for expansion.

Infrastructure location must not be treated as proof of compliance. Data residency and processing requirements must be assessed before production launch.

## 14. Data truth
Database/backend are the source of truth. Frontend state is a representation/cache, never an authority.

Production must not rely on fake patient data, development-only mocks or hardcoded credentials. Demo environments must be explicitly separated and labelled.

## 15. Engineering authority
The implementation may refactor, replace or rewrite existing modules when this materially improves reliability, security, maintainability, UX or product coherence.

Existing code is not sacred. Product quality and system integrity are the governing constraints.

Technical decisions that preserve the approved product constitution may be made autonomously. When evidence shows a current implementation blocks the target, the implementation should be changed rather than preserving it for historical reasons.

## 16. Quality bar
A feature is not complete because a page renders.

Completion requires coherent:
- UI;
- routing;
- API;
- authorization;
- persistence;
- validation;
- loading/empty/error/success/permission states;
- tests;
- observability where relevant;
- Web/Android domain parity;
- release-gate evidence.

## 17. Release standard
Target release quality is production-ready at a premium/global level:
security + stability + clinical correctness + intuitive UX + AI safety + complete workflows + tests + build + Web/Android parity.

`NOT READY` remains the default until executable blocking checks pass.

## 18. Working memory outside chat
This repository is the durable project memory. Important product decisions, architecture decisions, release criteria, completed milestones and next actions must be written into version-controlled documentation rather than relying on chat history.

Required living records:
- this Constitution;
- execution contract;
- architecture decision records (ADR) for material changes;
- release-gate evidence/status;
- implementation roadmap/current sprint state;
- known issues/blockers.

Every significant implementation cycle must update the relevant record so a future session can reconstruct what was decided, what changed, what passed, what failed and what should happen next.

## 19. Change control
A product decision may be changed only by explicitly updating this Constitution or an approved ADR. Code must not silently redefine product behavior that conflicts with this document.

When a later decision supersedes an earlier one, the repository record must state the superseded decision and the reason.
