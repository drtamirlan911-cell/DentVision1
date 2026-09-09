# DentVision Project State

Status: ACTIVE
Branch: `autonomous/superapp-foundation-2026-09-09`
Last updated: 2026-09-09

## Source of truth
1. `docs/00_CONSTITUTION/08_DENTVISION_MASTER_CONSTITUTION.md` — product and engineering constitution.
2. `docs/00_CONSTITUTION/07_AUTONOMOUS_SUPERAPP_EXECUTION.md` — execution contract.
3. This file — current implementation state and next actions.
4. ADRs — material architectural decisions.

## Confirmed product decisions
- DentVision is a Dental Super App + Dental Operating System + AI OS + ecosystem.
- North star: “DentVision — приложение, которое позволяет стоматологу творить чудо в один клик.”
- Target quality bar: Kaspi + Apple + OpenAI + Linear + Notion + Claude-level product quality, interpreted as inspiration rather than copying.
- Home: AI greeting + concise day briefing + relevant actions, then AI recedes and service cards/workspace becomes primary.
- Service discovery: sidebar + command center + command/search + adaptive cards.
- AI is an orchestration layer with specialized agents.
- Consequential actions require explicit confirmation; clinical AI remains decision support and explains its output.
- Patient 360 is a foundational cross-module object.
- Odontogram: 2D first, architected for future real 3D/WebGL.
- Documents are generated automatically from service/action rules and signed by patient/doctor in-app with traceable status/audit history.
- Shop is a full dental marketplace experience.
- School is a full education platform.
- Jobs is a professional dental employment marketplace.
- Community is a professional social/community product.
- Clinic ↔ Doctor ↔ Patient ↔ Laboratory ↔ Diagnostic Center is a core ecosystem flow.
- Web and Android share semantics/contracts but use device-appropriate presentation.
- Android has partial offline + sync/conflict resolution.
- Security, Kazakhstan legal requirements and international best practices are foundational.
- Production has no fake data, development mocks or hardcoded credentials.
- User authorizes autonomous technical refactoring/rewrite when needed for quality.
- Final readiness target: production-ready premium/global quality with executable evidence.

## Completed in this autonomous cycle
- Created autonomous execution contract.
- Added Web + Backend + Android CI quality workflow.
- Added Android debug build to CI.
- Added release-gate orchestration to CI.
- Preserved existing treatment-plan tenant/security controls.
- Added Master Constitution v1.0.
- Added this durable Project State record.

## Current status
- Product constitution: FIXED.
- Main branch: untouched by this autonomous cycle.
- Working branch: active.
- Release: NOT READY until executable gates pass.
- CI must be inspected after each meaningful change; failures are blockers until fixed or explicitly classified.

## Next execution sequence
1. Inspect current CI results and fix the first blocking failure.
2. Audit root/web/backend/Android build, typecheck, lint and tests.
3. Audit routing/navigation and remove dead or duplicate paths.
4. Audit authentication, RBAC, tenant isolation and IDOR across clinical/financial resources.
5. Map Patient 360 and clinical workflows end-to-end.
6. Map AI Workspace and enforce the authorization/confirmation state machine.
7. Implement document orchestration + electronic signature domain where missing.
8. Audit Web/Android API/domain parity and offline synchronization.
9. Refine Home/sidebar/service-card UX using the constitution and existing design system.
10. Convert release-gate placeholders into evidence-backed checks.
11. Re-run all gates and only then consider a release/merge decision.

## Rule for future sessions
Before making material changes, read this file and the Master Constitution. After material changes, update this file with completed work, blockers and the next execution sequence. Do not rely on chat memory for project state.
