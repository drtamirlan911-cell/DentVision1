## 2026-11-23 — Active-organization access for PARTNER subscription reads

- `GET /api/subscriptions/PARTNER/:ownerId` must not reuse user/supplier/lecturer ID matching. Access now requires the requested ownerId to equal the caller's active `organizationOriginalId`, the active canonical Organization mapping to resolve, and a scoped PersonRole to grant one of `billing.read`, `billing.manage`, `finance.read` or `finance.manage`.
- E2E adds positive cases for medical-lab Finance and diagnostic-center owner, and denial cases for medical-lab technician, center radiologist, unrelated clinic owner and cross-organization Finance. Exact-head CI is required before this is treated as verified.
- Academy mutation responses are now traced at `res.status()`/`res.json()` in E2E only. Route/handler/lookup/outcome markers matched the expected protection branch on the prior SHA, while the final response unexpectedly remained 404; the new JSON marker will reveal the actual writer. The expected 409 and learner-history integrity assertions are unchanged.

