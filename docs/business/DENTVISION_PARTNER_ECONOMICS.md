# DentVision Partner Economics

**Status:** CANONICAL BUSINESS POLICY  
**Version:** 1.1  
**Date:** 2026-09-17  
**Authority:** Business / Monetization foundation

## Purpose

This document establishes the default unit economics, commissions, minimum fees, caps, volume tiers and branch billing rules for DentVision ecosystem partners. It is the source of truth for product implementation, Finance Hub calculations, partner contracts and future pricing decisions.

The goal is **positive contribution margin for DentVision without destroying partner economics**. DentVision must monetize the ecosystem, not extract unsustainable fees from participants.

This policy complements the canonical Product Mission and Marketplace specification. DentVision remains an AI Operating System for Digital Dentistry; CRM, Marketplace and School are ecosystem modules, not isolated products.

## 1. Universal economic rules

1. Never take a percentage of a clinic's entire clinical revenue as the default SaaS model.
2. Transaction commissions apply to transactions generated or processed through DentVision.
3. Payment-processing costs, refunds, chargebacks and taxes must be tracked separately from DentVision commission revenue.
4. Every transactional vertical must have a minimum fee where a pure percentage would make the transaction unprofitable to operate.
5. Every transactional vertical should have a reasonable cap for unusually large transactions where a percentage becomes economically punitive.
6. Volume tiers reward partners who move more business through DentVision.
7. Pricing must be transparent to partners and buyers.
8. Finance Hub must calculate gross platform revenue, payment cost, AI cost, storage, support, refunds/chargebacks, tax/VAT and contribution margin separately.
9. Any new commission must pass a unit-economics gate before release.
10. Pricing can be overridden for strategic enterprise contracts, but the exception must be recorded and auditable.
11. **A branch is not itself a transaction and does not create a percentage commission.** Where a vertical is branch-priced, the branch is monetized through a subscription/add-on.
12. **Branch subscription and transaction commission are separate economic layers** and must appear separately in Finance Hub.

## 2. Clinics

### Standard SaaS

| Tier | Monthly price | Intended use |
|---|---:|---|
| START | ₸19,900 | 1–2 doctors |
| PRO | ₸39,900 | up to 5 doctors |
| BUSINESS | ₸79,900 | up to 15 doctors |
| NETWORK | from ₸149,900 / branch | dental groups / networks |

**Default rule:** no percentage commission on the clinic's total treatment revenue.

START/PRO/BUSINESS are organization SaaS plans. The NETWORK plan is the branch-priced clinic model.

Additional monetization may come from diagnostics, laboratories, dental labs, Shop, Academy, premium AI, communications, payments and advanced analytics.

## 3. Diagnostic / 3D centers

**Branch subscription:** ₸49,900 / active billable branch / month  
**Transaction commission:** 7% of orders originating through DentVision  
**Minimum:** ₸500 / study  
**Maximum:** ₸3,000 / study

Examples:

| Study price | DentVision fee |
|---:|---:|
| ₸5,000 | ₸500 minimum |
| ₸10,000 | ₸700 |
| ₸15,000 | ₸1,050 |
| ₸20,000 | ₸1,400 |
| ₸30,000 | ₸2,100 |
| ₸50,000+ | ₸3,000 cap |

The economic value must include digital referral, booking, payment, DICOM/result exchange, notification and workflow integration—not merely listing the center.

## 4. Medical analysis laboratories

**Branch subscription:** ₸19,900 / active billable branch / month  
**Transaction commission:** 6% per analysis/order through DentVision  
**Minimum:** ₸150 / analysis  
**Maximum:** ₸2,500 / analysis

Examples:

| Analysis price | DentVision fee |
|---:|---:|
| ₸1,000 | ₸150 minimum |
| ₸1,500 | ₸150 minimum |
| ₸2,500 | ₸150 |
| ₸5,000 | ₸300 |
| ₸10,000 | ₸600 |
| ₸20,000 | ₸1,200 |
| ₸40,000 | ₸2,400 |
| ₸50,000+ | ₸2,500 cap |

The minimum fee prevents low-ticket laboratory transactions from producing negative contribution margin.

## 5. Dental laboratories

**Laboratory / branch subscription:** ₸29,900 / active billable branch / month  
**Default transaction commission:** 8% per case  
**Minimum:** ₸500 / case  
**Default maximum:** ₸15,000 / case

### Volume tiers

| Monthly GMV through DentVision | Commission |
|---:|---:|
| up to ₸1M | 10% |
| ₸1M–₸5M | 8% |
| ₸5M–₸15M | 7% |
| ₸15M–₸30M | 6% |
| ₸30M+ | 5% |

For very large complex cases, enterprise contracts may use a negotiated cap. The objective is to preserve laboratory margin while making DentVision the digital case-routing, communication and workflow layer.

## 6. Marketplace suppliers / sellers

DentVision Marketplace is seller-driven. Sellers are suppliers, consistent with the Marketplace specification.

**Standard take-rate:** 8%  
**High-volume:** 6%  
**Strategic supplier:** 4–5% by approved enterprise agreement

Suggested volume progression:

| Monthly GMV | Commission |
|---:|---:|
| standard | 8% |
| high volume | 6% |
| strategic / very high volume | 5% or negotiated 4–5% |

Payment processing is accounted for separately and must not be confused with DentVision take-rate.

## 7. Academy / lecturers

The commission depends on customer acquisition source.

| Acquisition model | DentVision | Lecturer |
|---|---:|---:|
| Lecturer brings the student | 10% | 90% |
| DentVision brings the student | 25% | 75% |
| DentVision provides full marketing + sales | 30% | 70% |

This creates a strong incentive for lecturers to bring their own audience while compensating DentVision when it supplies demand, distribution and sales infrastructure.

## 8. Universal branch billing

Branch support is an organization capability, not a clinic-only feature.

The following organization families may have branches where operationally relevant:

- Dental Clinic
- Diagnostic / 3D Center
- Medical Laboratory
- Dental Laboratory
- Medical Organization
- Supplier / Manufacturer
- Academy / Education Organization
- other organization types explicitly enabled by platform configuration

The default economic rule is:

```text
organization
  → active billable branches
  → branch subscription

DentVision transaction
  → transaction commission
```

A branch does **not** create an extra commission percentage merely because it exists.

### Billable quantity

For branch-priced verticals:

```text
monthly branch subscription = billable active branches × branch unit price
```

The minimum billable quantity is one for an activated branch-priced organization. A single-location partner therefore pays the published one-branch price; additional active branches increase subscription quantity.

Inactive branches are removed from the next billable period after their effective deactivation date. Newly activated branches become billable at the next billing boundary unless an enterprise contract explicitly defines proration.

### Clinic exception

START/PRO/BUSINESS clinics remain organization-priced and do not receive the NETWORK branch economics automatically.

Additional clinic branches require the NETWORK plan or an approved enterprise override. This prevents a ₸19,900/₸39,900/₸79,900 clinic plan from silently becoming an unlimited multi-branch network plan.

### Current branch prices

| Organization | Branch price / month | Transaction commission |
|---|---:|---:|
| Clinic NETWORK | from ₸149,900 | 0% of total clinical revenue by default |
| Diagnostic / 3D Center | ₸49,900 | 7%, min ₸500, cap ₸3,000 |
| Medical Laboratory | ₸19,900 | 6%, min ₸150, cap ₸2,500 |
| Dental Laboratory | ₸29,900 | 8% default, volume tiers above |

The branch price is a subscription/capacity charge. It is not deducted from each transaction.

## 9. Branch lifecycle and finance

Every branch has an auditable lifecycle:

```text
requested → active → suspended → inactive
```

Billing semantics:

- requested: no charge until activated;
- active: billable;
- suspended: billing follows the explicit subscription/contract state;
- inactive: not billable after the effective boundary.

Historical transactions keep their original organization and branch context. Branch deactivation never rewrites financial history.

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

## 10. Transaction commission resolution

Commission remains transaction-based and is resolved in this order:

```text
specific organization rule
→ organization/domain rule
→ global domain rule
→ default policy
```

Branch context is retained for reporting and security. A branch does not change the rate unless an explicit, versioned commission rule says so.

Where the existing `CommissionRule` configuration supports only percentage today, minimums, caps and volume tiers must be represented by the canonical pricing engine before the corresponding production contract relies on them. Screens must never hard-code these values.

Volume tiers default to the economic owner level, not independently per branch:

```text
organization GMV across eligible branches
→ one volume tier
→ rate applies to eligible organization transactions
```

This prevents a partner from losing a volume discount simply by distributing its activity among branches.

## 11. Organization types without a fixed branch price

Not every organization type should automatically receive a new charge.

Supplier/Manufacturer, Academy and other organization families may support branches operationally, but until a branch price is approved they use their existing organization/subscription economics and **no invented branch fee**.

This is deliberate: branch capability and branch monetization are separate configuration decisions.

## 12. Partner unit-economics gate

Every partner vertical must expose at least:

```text
GMV
→ Gross platform revenue
→ Subscription revenue
→ Transaction commission revenue
→ Payment processing cost
→ AI inference cost
→ Storage / data cost
→ Support / operations cost
→ Refund / chargeback reserve
→ Tax / VAT
→ Contribution margin
→ Net platform revenue
```

A partner should not be launched at a price that creates structurally negative contribution margin. If margin deteriorates below the approved operating threshold, Finance/Product must adjust minimum fee, cap, subscription, volume tier or service consumption.

## 13. Example target economics

Illustrative mature monthly cluster:

- 100 clinics × average ₸39,900 SaaS = ₸3.99M
- 20 diagnostic branches × average ₸200K platform revenue = ₸4.0M
- 20 medical laboratories × average ₸250K = ₸5.0M
- 30 dental laboratories × average ₸300K = ₸9.0M
- Shop GMV ₸100M × average 7% = ₸7.0M
- Academy GMV ₸20M × average 20% = ₸4.0M

Illustrative platform revenue: **~₸32.99M/month**, before additional Jobs, Community, Finance Hub, premium AI, advertising, sponsored placements, logistics or hardware revenue.

These figures are planning scenarios, not guaranteed forecasts.

## 14. Finance Hub implementation requirements

Finance Hub should expose, by organization and by branch where permitted:

- active branches;
- billable branches;
- branch subscription unit price;
- branch subscription total;
- GMV;
- orders / cases / studies / analyses;
- subscription revenue;
- commission revenue;
- payment cost;
- AI cost;
- storage cost;
- support cost;
- refund / chargeback cost;
- VAT / tax accounting fields;
- contribution margin;
- partner payout;
- DentVision net revenue;
- effective take-rate;
- partner retention.

The organization owner sees its own organization and branch economics. A branch manager sees branch operational economics only to the extent permitted by role.

## 15. Governance

This document is the canonical starting point for pricing implementation. Product, Finance and Engineering must not create conflicting commission or branch-price constants in individual screens or services.

Pricing values must ultimately be centralized in a versioned configuration / pricing model and consumed by Marketplace, Academy, diagnostics, laboratory workflows and Finance Hub.

Any pricing change requires:

1. updated version / effective date;
2. migration or compatibility plan where required;
3. impact calculation;
4. auditability;
5. no silent retroactive repricing of completed transactions.

Enterprise overrides must record organization, scope, previous rule, new rule, effective date, expiry where applicable, approver and audit event.

## 16. Release gates

Branch economics is not considered implemented until E2E proves:

1. a single-location diagnostic center has one billable branch;
2. a second branch changes subscription quantity, not transaction commission;
3. medical and dental laboratory prices remain distinct;
4. clinic START/PRO/BUSINESS cannot silently obtain NETWORK branch economics;
5. clinic NETWORK scales by active billable branch;
6. deactivating a branch removes it from the next billable quantity;
7. transactions in different branches use the correct organization commission rule;
8. organization-level volume tiers aggregate eligible branch GMV;
9. historical transactions preserve branch and commission values;
10. organization A cannot view or alter organization B's branch billing;
11. billing permissions remain organization-scoped;
12. Finance Hub separates subscription revenue from commission revenue;
13. enterprise overrides are auditable;
14. unsupported organization types do not receive an invented branch fee.

## 17. Non-goals

This document does not establish legal tax advice, final payment-provider pricing, or country-specific medical-service regulation. Those must be validated before production contracts and payment flows.

## 18. Decision

**Adopted as DentVision default partner-economics policy v1.1.**

**Core decision:** subscription monetizes the operational capacity of a billable branch; commission monetizes DentVision-generated transactions. There is no separate "branch commission" merely for having multiple locations.
