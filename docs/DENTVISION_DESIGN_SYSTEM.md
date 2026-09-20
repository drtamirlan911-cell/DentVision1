# DentVision Design System — Canonical UI Direction

**Status:** ACTIVE implementation baseline  
**Scope:** Web + mobile  
**Source of truth:** DentVision product IA and existing `dentvision-unified-theme.css`, `dentvision-superapp.css`, and `dentvision-polish.css`.

## Principles

- Premium clinical workspace; no generic SaaS/AI-incubator styling.
- One information architecture across desktop and mobile.
- AI is the primary workspace, not a decorative splash screen.
- Clinical actions stay separated from business/marketplace actions.
- Role visibility is enforced through IAM, not visual hiding alone.
- Existing CSS design tokens are reused; feature screens must not introduce arbitrary theme primitives.

## Canonical navigation

1. **Workspace:** AI, diagnostics.
2. **Practice:** patients, schedule, dental chart, treatment plans, medical card, visits, lab, patient conversations.
3. **Partners:** diagnostic centers, medical laboratories, dental laboratories, suppliers.
4. **Market & Development:** Market, Academy, Jobs, Community.
5. **Business:** Finance, inventory, price list, staff, marketing, documents, analytics.
6. **Administration:** only role-authorized admin/audit/AI/BI/backup tools.
7. **More:** profile, settings, clinic settings, billing, integrations, ICD-10.

Desktop sidebar and mobile bottom navigation must resolve to these same route concepts. Mobile may expose only a compact subset; it must not invent a separate IA.

## Visual foundations

- Use existing `--dv-*` tokens from the unified DentVision theme.
- Radius, spacing, typography and state colors must come from the existing design-system classes/tokens where available.
- Icons are Lucide/custom product icons; avoid emoji.
- Interactive states must include hover/focus/active/disabled/loading/error.
- Accessible labels are mandatory for icon-only controls.

## Figma handoff contract

When a connected Figma file is available, the canonical pages/components to align are:
- App Shell / Sidebar
- AI Workspace
- Clinical workspace
- Partner workspace
- Finance Hub
- Mobile bottom navigation
- Dialogs, forms, tables and empty/error/loading states

Do not create a second navigation taxonomy in Figma. Figma components should map to these same route concepts and token names.
