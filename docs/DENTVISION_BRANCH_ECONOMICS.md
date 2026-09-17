# DentVision Branch & Economics Policy

**Status:** CANONICAL ECONOMIC CONSTRAINT / ACTIVE  
**Date:** 2026-09-17  
**Applies to:** all organization types that support branches and all commercial workflows

## 1. Core decision

DentVision uses **subscription economics for software/organization usage** and **transaction commissions only where DentVision actually facilitates a commercial transaction**.

A branch is not charged a percentage commission merely because it exists.

Therefore:

- organization subscription pays for DentVision software access;
- included branch count is a property of the subscription/tariff;
- additional branches may be sold as branch add-ons or by a higher tier;
- marketplace, Academy and other platform-mediated transactions may carry a transaction commission according to the active commission policy;
- ordinary clinical treatment revenue is not subject to a default DentVision percentage commission;
- branch revenue is attributed to the branch for analytics and settlement, but the platform fee is not multiplied by the number of branches.

## 2. Branch support

Branches may be enabled for any organization type whose workflow benefits from physical operating units, including:

- dental clinics and clinic groups;
- diagnostic centers;
- medical laboratories;
- dental laboratories;
- medical organizations;
- suppliers/manufacturers/distributors where physical locations require separate operations;
- academies with multiple campuses/locations;
- other organization types when explicitly enabled by their domain contract.

A branch is always owned by exactly one organization context.

## 3. Subscription model

Subscription belongs to the **organization**, not to an individual branch.

The subscription contract must expose at least:

- plan;
- status;
- billing period;
- included branch limit;
- active branch count;
- extra branch quantity;
- extra branch price;
- enabled capabilities/limits;
- effective and expiry dates.

Recommended commercial behavior:

- one-branch organization: base subscription;
- multi-branch organization within included limit: no extra branch charge;
- branch count above included limit: explicit branch add-on or automatic plan upgrade according to the organization's selected billing mode;
- deactivated branch does not count as an active operating branch after the effective deactivation timestamp;
- deleting/merging a branch never deletes its historical financial or audit data.

Exact KZT prices are configuration, not code constants.

## 4. Commission hierarchy

A commission is resolved deterministically in this order:

`branch rule → organization rule → domain/global rule → platform default`

A branch-specific rule can override an organization rule when the platform explicitly enables that capability.

A commission rule must identify its scope type. `scopeId` without a scope type is not sufficient for a production policy because clinic, branch, supplier and other identifiers may collide.

Recommended rule dimensions:

- domain;
- organization type;
- scope type (`PLATFORM`, `ORGANIZATION`, `BRANCH`, optionally `PARTNER`);
- scope id;
- seller/recipient type where needed;
- rate in basis points;
- effective from/to;
- active flag;
- settlement split;
- minimum/maximum fee where applicable;
- currency.

Historical transactions must keep the resolved commission snapshot so later rule changes cannot rewrite history.

## 5. What is commissionable

### SaaS

Subscription revenue is platform SaaS revenue. It is not represented as a marketplace commission.

### Marketplace / Shop

A platform-mediated sale may create:

`buyer payment → seller net → DentVision commission → payment/ledger fees where applicable`

The seller's organization/branch is recorded for attribution.

### Academy

Courses, webinars, textbooks and other platform-mediated education sales may use the Academy/lecturer commission policy.

### Diagnostics

A diagnostic transaction may use a platform commission **only if DentVision is actually the commercial intermediary for that transaction**. Purely clinical/referral workflow without platform-mediated settlement must not silently create a commission.

### Medical laboratory

The same principle applies: commission is tied to platform-mediated commercial settlement, not simply to the fact that a laboratory receives an order.

### Dental laboratory

The same principle applies to dental-lab cases. A lab case being managed through DentVision is not by itself a commission event. Commission is generated only by the configured commercial transaction/settlement event.

### Clinical treatment

Clinic treatment revenue remains at 0% default DentVision platform commission. This preserves the existing economic policy and avoids treating the clinic's entire patient revenue as marketplace GMV.

## 6. Branch economics

Every commercial event should carry:

- source organization;
- source branch when known;
- destination organization;
- destination branch when known;
- transaction domain;
- gross amount;
- platform commission;
- payment/provider fee if applicable;
- seller/organization net;
- settlement status.

For a clinic group:

`Organization total = sum(branch economics)`

For a diagnostic center, medical lab or dental lab the same rule applies.

The organization owner sees consolidated economics; a branch-scoped manager sees only authorized branch economics.

## 7. Settlement

A platform-mediated sale should create a balanced ledger transaction. The transaction stores the commission snapshot used at the moment of sale.

Payouts are made from the seller's wallet. The platform must never recompute historical commission using today's rule when paying an old transaction.

Refunds, remakes, disputes and cancellations create compensating ledger events rather than mutating the original financial history.

## 8. Organization owner vs branch manager

OWNER of the organization:

- sees all branches;
- sees consolidated finance;
- may configure branch billing where permitted;
- may see branch-level economics;
- may approve commercial policy changes subject to platform permissions.

Branch-scoped manager:

- sees only assigned branch economics;
- cannot alter platform commission rules;
- cannot access another branch's financial records.

## 9. Required data model direction

The current legacy `Subscription(ownerType, ownerId)` and `CommissionRule(domain, scopeId)` are useful foundations but are not sufficient for the final branch-aware economic contract.

The implementation must evolve toward:

`Organization → Subscription → Branch entitlement`

and

`CommissionPolicy → Scope → Effective rate → Transaction snapshot`

without breaking existing ledger history.

## 10. Release gates

Before branch economics is considered complete, E2E must prove at minimum:

1. clinic with one branch;
2. clinic with multiple branches;
3. diagnostic center with multiple branches;
4. medical laboratory with multiple branches;
5. dental laboratory with multiple branches;
6. organization owner sees consolidated totals;
7. branch manager sees only assigned branch;
8. subscription included-branch limit;
9. additional branch entitlement;
10. branch-specific commission override;
11. organization-level commission fallback;
12. global commission fallback;
13. clinical treatment remains 0% default platform commission;
14. platform-mediated shop/academy transaction creates commission;
15. diagnostic/lab commission occurs only for configured commercial settlement;
16. refund/reversal does not corrupt original transaction;
17. historical commission remains unchanged after policy update;
18. cross-organization and cross-branch financial reads are denied.

## 11. Implementation rule

No new UI may expose a percentage, subscription price or branch fee as a hard-coded business truth. Rates and prices belong to governed configuration and must be auditable.
