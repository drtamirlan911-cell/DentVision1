# DentVision Universal Branch Billing Policy

**Status:** CANONICAL BUSINESS POLICY EXTENSION  
**Version:** 1.0  
**Date:** 2026-09-17  
**Parent policy:** `docs/business/DENTVISION_PARTNER_ECONOMICS.md`

## Decision

DentVision does **not** charge a transaction commission merely because an organization has multiple branches.

A branch is an operational unit. Where the parent economics policy defines branch-based SaaS, DentVision charges a **subscription per active billable branch**. Transaction commissions remain separate and are charged only when a transaction is generated or processed through DentVision.

This prevents double-charging the same economic event:

```text
active branch
  → branch subscription

transaction generated through DentVision
  → transaction commission
```

A branch that produces no DentVision transaction still consumes operational infrastructure and therefore may carry its subscription charge; a transaction in a branch does not create an additional "branch commission".

## 1. Who may have branches

Branch support is an organization capability, not a clinic-only feature.

The following organization families may use branches when operationally relevant:

- Dental Clinic
- Diagnostic / 3D Center
- Medical Laboratory
- Dental Laboratory
- Medical Organization
- Supplier / Manufacturer
- Academy / Education Organization
- other organization types explicitly enabled by platform configuration

A single-location organization still has one default operational location. Creating additional locations is optional.

## 2. Billing unit

The billing engine uses these concepts:

```text
organization
branch
active branch
billable branch
subscription
transaction
commission
```

For branch-priced verticals:

```text
monthly branch charge = billable active branches × branch unit price
```

The default billable quantity is at least 1 for an activated organization, so a single-location partner pays the same published branch price as the current policy.

Inactive branches do not create a monthly branch charge after their effective deactivation date.

A newly created branch becomes billable at the next billing boundary unless an enterprise contract explicitly defines immediate proration. No silent retroactive billing is allowed.

## 3. Current canonical branch prices

These values inherit directly from the partner economics policy:

| Organization / vertical | Monthly price per active billable branch | Transaction commission |
|---|---:|---:|
| Dental clinic network | from ₸149,900 | 0% of total clinical revenue by default |
| Diagnostic / 3D center | ₸49,900 | 7%, min ₸500, cap ₸3,000 per study |
| Medical laboratory | ₸19,900 | 6%, min ₸150, cap ₸2,500 per analysis/order |
| Dental laboratory | ₸29,900 | 8% default, subject to its existing volume tiers |

The clinic START/PRO/BUSINESS tiers remain organization SaaS tiers. The NETWORK tier is explicitly branch-priced by the parent policy.

## 4. Branch creation and entitlement

The owner/admin may create additional branches only when the organization type supports branches.

The branch-management flow must show before confirmation:

```text
New branch
→ monthly additional subscription
→ next billing date
→ effective date
→ current number of active branches
→ projected monthly total
```

For example, if a diagnostic organization has 3 active billable branches:

```text
3 × ₸49,900 = ₸149,700 / month
```

No separate percentage is added merely for having those three branches.

## 5. Transaction commissions remain branch-aware

When a transaction occurs, the commission engine must resolve in this order:

```text
specific organization / partner rule
→ organization-type / domain rule
→ global domain rule
→ default policy
```

The branch is carried as transaction context for reporting and isolation, but branch existence does not change the commission percentage unless a versioned commission rule explicitly says so.

Commission calculation must still apply the parent policy's minimum, maximum and volume-tier rules where configured.

## 6. Volume tiers

Volume tiers are calculated at the economic owner level defined by the vertical, not independently per branch unless an enterprise contract explicitly says otherwise.

Default rule:

```text
organization GMV across its active branches
→ one volume tier
→ that tier applies to eligible transactions for the organization
```

This prevents a partner from being penalized for distributing the same DentVision volume across several branches.

## 7. Branch lifecycle

A branch has a lifecycle:

```text
requested
→ active
→ suspended
→ inactive
```

Billing rules:

- `requested`: no charge until activated;
- `active`: billable;
- `suspended`: billing follows the subscription/contract state and must be explicit;
- `inactive`: not billable after the effective deactivation boundary.

The system must preserve the historical branch context of completed transactions. Deactivating a branch must never rewrite historical financial records.

## 8. Ownership and security

Branch billing belongs to the organization, not to the individual employee.

```text
User
 → Organization Membership
   → Organization
     → Branch[]
       → billing context
```

Only authorized organization roles may:

- create a branch;
- activate/deactivate a branch;
- view branch billing;
- request a subscription change.

A user who is OWNER in Organization A but only DOCTOR in Organization B cannot manage B's branches or billing merely because they are an owner elsewhere.

## 9. Finance Hub

Finance Hub must separate:

```text
Branch subscription revenue
Transaction commission revenue
Payment processing cost
Refunds / chargebacks
AI cost
Storage cost
Support cost
Tax / VAT fields
Partner payout
Contribution margin
```

Per-organization reporting must show:

- active branches;
- billable branches;
- branch subscription unit price;
- branch subscription total;
- transaction GMV;
- transaction commission;
- effective take-rate;
- total DentVision revenue;
- contribution margin.

## 10. Pricing changes

Branch prices are versioned. A price change applies to future billing boundaries and never silently reprices completed periods or completed transactions.

Enterprise overrides must record:

- organization;
- branch scope or organization scope;
- previous price/rule;
- new price/rule;
- effective date;
- expiry date if temporary;
- approving actor;
- audit event.

## 11. Product UX

The organization cabinet must not hide branch economics.

The billing surface should show a compact summary such as:

```text
Филиалы
3 активных

Подписка филиалов
₸149 700 / месяц

Комиссии за операции
по факту операций

Следующее списание
01.10.2026
```

The branch manager should see operational information relevant to the branch; only authorized billing roles see the financial totals.

## 12. Implementation invariant

There must be one pricing engine. Do not hard-code branch prices inside diagnostic, medical-lab, dental-lab or clinic screens.

The implementation contract is:

```text
BranchBillingPolicy
  → branch capability
  → active/billable branch count
  → unit price
  → subscription quote
  → version/effective date

CommissionPolicy
  → domain
  → organization scope
  → branch context
  → minimum
  → maximum
  → volume tier
  → commission
```

The two engines may contribute to Finance Hub revenue, but they must never be conflated.

## 13. Release gate

A branch-billing release is not complete until E2E proves:

1. single-location organization has one billable branch;
2. adding a second branch changes subscription quantity, not transaction commission;
3. deactivating a branch removes it from the next billable quantity;
4. a transaction in either branch uses the correct commission rule;
5. organization A cannot see or alter organization B's branch billing;
6. OWNER+DOCTOR can operate clinically without gaining billing rights unless granted;
7. volume tiers aggregate according to the organization-level rule;
8. historical transactions retain their original branch and commission values;
9. enterprise overrides are auditable;
10. subscription and commission revenue are separate in Finance Hub.

## 14. Decision summary

**Use subscription for the existence/capacity of a billable branch. Use commission for DentVision-generated transactions. Never introduce a separate "branch commission" simply because a partner has multiple locations.**
