# DentVision Partner Economics

**Status:** CANONICAL BUSINESS POLICY  
**Version:** 1.2  
**Date:** 2026-09-17  
**Authority:** Business / Monetization foundation

## Purpose

This document establishes the default unit economics, commissions, minimum fees, caps, volume tiers and branch billing rules for DentVision ecosystem partners. It is the source of truth for product implementation, Finance Hub calculations, partner contracts and future pricing decisions.

The goal is **positive contribution margin for DentVision without destroying partner economics**. DentVision must monetize the ecosystem, not extract unsustainable fees from participants.

A critical distinction applies: DentVision can control its own fees and platform costs, but cannot mathematically guarantee that an independent partner is profitable because partner costs, taxes, staffing, equipment and other operating expenses are not fully observable by the platform. Therefore the product must provide **economic safeguards, transparency and release gates** rather than claim a false profitability guarantee.

This policy complements the canonical Product Mission and Marketplace specification. DentVision remains an AI Operating System for Digital Dentistry; CRM, Marketplace and School are ecosystem modules, not isolated products.

## 1. Universal economic rules

1. Never take a percentage of a clinic's entire clinical revenue as the default SaaS model.
2. Transaction commissions apply to transactions generated or processed through DentVision.
3. A commission is earned only on a commercial settlement event, not merely because an order, referral, lab case or diagnostic workflow exists.
4. Payment-processing costs, refunds, chargebacks and taxes must be tracked separately from DentVision commission revenue.
5. Every transactional vertical must have a minimum fee where a pure percentage would make the transaction unprofitable to operate.
6. Every transactional vertical should have a reasonable cap for unusually large transactions where a percentage becomes economically punitive.
7. Volume tiers reward partners who move more business through DentVision.
8. Pricing must be transparent to partners and buyers before confirmation.
9. Finance Hub must calculate gross platform revenue, payment cost, AI cost, storage, support, refunds/chargebacks, tax/VAT and contribution margin separately.
10. Any new commission must pass a bilateral unit-economics gate before release: the rule must be viable for DentVision and must be commercially explainable and sustainable for the partner.
11. Pricing can be overridden for strategic enterprise contracts, but the exception must be recorded and auditable.
12. A branch is not itself a transaction and does not create a percentage commission. Where a vertical is branch-priced, the branch is monetized through a subscription/add-on.
13. Branch subscription and transaction commission are separate economic layers and must appear separately in Finance Hub.
14. DentVision must never hide payment fees, platform commission, branch subscription or other deductions inside an unexplained single amount.
15. The partner must be able to preview the expected gross amount, DentVision fee, payment cost where known, other deductions, partner net and effective take-rate before a commercial transaction is confirmed.

## 2. Bilateral unit-economics safety gate

The platform must protect **both sides of the economic equation**.

### DentVision side

For every commissionable transaction, Finance must be able to calculate:

```text
commission
- payment processing cost
- AI cost
- storage/data cost
- support/operations cost
- expected refund/chargeback reserve
- attributable tax/VAT
= contribution margin
```

A new rule must not be released when it creates structurally negative contribution margin under its expected operating scenario. Minimum fees, caps, subscription pricing, service consumption or volume tiers must be adjusted before launch.

### Partner side

The partner must see:

```text
sale price
- DentVision commission
- payment/provider deductions
- applicable tax/deductions
= expected partner net
```

Where partner cost data is available, the pricing simulator may additionally calculate:

```text
partner net
- partner operating cost
= partner contribution
```

If the configured partner cost basis or target margin indicates that a proposed platform fee would make the transaction commercially unsustainable, the system must warn and require an authorized pricing/contract decision before activation. It must not silently apply the fee.

Partner profitability is not inferred from DentVision revenue alone. Partner cost data is private to the partner/authorized commercial roles and is never exposed to unrelated organizations.

### No hidden subsidy

DentVision must not create a business rule that appears profitable only because payment, AI, storage, support, refunds or taxes are omitted from the calculation. Likewise, DentVision must not rely on a partner absorbing undisclosed platform costs.

## 3. Settlement-first commission rule

The economic lifecycle is:

```text
quote
→ order
→ payment authorization
→ successful settlement
→ commission snapshot
→ partner payout
```

Commission must not be permanently recognized as earned merely because an order was created.

The settlement record must snapshot at minimum:

- organization;
- branch;
- transaction domain;
- gross settled amount;
- commission rate;
- minimum/cap applied;
- volume tier;
- economics/policy version;
- payment cost where known;
- partner net;
- settlement timestamp.

A later pricing-policy change must never rewrite this snapshot.

Refunds, cancellations, remakes and chargebacks create compensating financial events. They must not mutate the original settled transaction.

## 4. Clinics

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

## 5. Diagnostic / 3D centers

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

## 6. Medical analysis laboratories

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

## 7. Dental laboratories

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

## 8. Marketplace suppliers / sellers

DentVision Marketplace is seller-driven. Sellers are suppliers, consistent with the Marketplace specification.

**Standard take-rate:** 8%  
**High-volume:** 6%  
**Strategic supplier:** 4–5% by approved enterprise agreement

Suggested volume progression:

| Monthly GMV | Commission |
|---|---:|
| standard | 8% |
| high volume | 6% |
| strategic / very high volume | 5% or negotiated 4–5% |

Payment processing is accounted for separately and must not be confused with DentVision take-rate.

## 9. Academy / lecturers

The commission depends on customer acquisition source.

| Acquisition model | DentVision | Lecturer |
|---|---:|---:|
| Lecturer brings the student | 10% | 90% |
| DentVision brings the student | 25% | 75% |
| DentVision provides full marketing + sales | 30% | 70% |

This creates a strong incentive for lecturers to bring their own audience while compensating DentVision when it supplies demand, distribution and sales infrastructure.

## 10. Universal branch billing

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

## 11. Organization types without a fixed branch price

Not every organization type should automatically receive a new charge.

Supplier/Manufacturer, Academy and other organization families may support branches operationally, but until a branch price is approved they use their existing organization/subscription economics and **no invented branch fee**.

This is deliberate: branch capability and branch monetization are separate configuration decisions.

## 12. Transaction commission resolution

Commission remains transaction-based and is resolved in this order:

```text
specific branch rule
→ specific organization rule
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

## 13. Partner price protection and simulation

Before activating a commercial service, the partner-facing pricing surface should provide a deterministic simulation:

```text
partner list price
→ DentVision commission
→ known payment/provider fees
→ estimated applicable deductions
→ expected partner net
```

For partners that configure internal cost data:

```text
expected partner net
→ partner cost basis
→ partner contribution
→ target margin comparison
```

The system must not silently change the partner's public price to compensate for a commission. Any repricing requires explicit partner action or an authorized contract change.

For low-ticket services, the platform should show the effective take-rate because a minimum fee can represent a higher percentage than the headline rate. Example: a ₸1,000 medical analysis with a ₸150 minimum has a 15% effective fee, even though the headline rate is 6%.

This transparency is required to prevent partners from discovering the economics only after settlement.

## 14. Platform margin protection

DentVision must monitor unit economics by vertical, organization and transaction class.

At minimum:

```text
gross commission
- payment cost
- AI cost
- storage cost
- support cost
- refund/chargeback reserve
- attributable tax/VAT
= contribution margin
```

A rule that is persistently negative must be flagged for commercial review. The correction hierarchy is:

1. reduce avoidable platform consumption;
2. adjust minimum/cap where commercially justified;
3. adjust subscription/add-on price;
4. adjust volume tiers;
5. negotiate an enterprise contract;
6. disable the loss-making transaction configuration.

DentVision must not solve negative unit economics by silently increasing an unrelated partner fee.

## 15. Refunds, remakes and disputes

Refund economics must be proportional and ledger-based.

A successful transaction followed by a full refund must produce a compensating commission reversal consistent with the original commission snapshot.

Partial refunds must reverse the corresponding economic portion.

Dental-lab remakes caused by a quality workflow must not automatically create a second commission on the same economic value. The case workflow and commercial settlement must distinguish a genuine new sale from a remake/rework event.

Chargebacks and disputes must preserve the original transaction and create separate financial events.

## 16. Finance Hub implementation requirements

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
- partner retention;
- partner economic warnings.

The organization owner sees its own organization and branch economics. A branch manager sees branch operational economics only to the extent permitted by role.

## 17. Governance

This document is the canonical starting point for pricing implementation. Product, Finance and Engineering must not create conflicting commission or branch-price constants in individual screens or services.

Pricing values must ultimately be centralized in a versioned configuration / pricing model and consumed by Marketplace, Academy, diagnostics, laboratory workflows and Finance Hub.

Any pricing change requires:

1. updated version / effective date;
2. migration or compatibility plan where required;
3. impact calculation;
4. partner-facing simulation;
5. auditability;
6. no silent retroactive repricing of completed transactions.

Enterprise overrides must record organization, scope, previous rule, new rule, effective date, expiry where applicable, approver and audit event.

## 18. Release gates

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
14. unsupported organization types do not receive an invented branch fee;
15. commission is recognized from settled commercial transactions rather than order creation alone;
16. refunds/chargebacks create compensating events without mutating original history;
17. partner-facing simulations show gross, fees and expected net before confirmation;
18. minimum-fee transactions expose their effective take-rate;
19. a structurally negative DentVision contribution-margin rule is blocked or requires explicit commercial override;
20. configured partner cost/target-margin warnings are surfaced before activating an economically unsustainable rule.

## 19. Non-goals

This document does not establish legal tax advice, final payment-provider pricing, or country-specific medical-service regulation. Those must be validated before production contracts and payment flows.

## 20. Decision

**Adopted as DentVision default partner-economics policy v1.2.**

**Core decision:** subscription monetizes the operational capacity of a billable branch; commission monetizes DentVision-generated transactions. There is no separate "branch commission" merely for having multiple locations.

**Economic safety decision:** DentVision must maintain positive contribution economics for the platform while providing transparent net-payout simulation, minimum/cap/volume protections, settlement snapshots and partner-margin warnings so that platform fees do not knowingly create structurally unsustainable partner economics.
