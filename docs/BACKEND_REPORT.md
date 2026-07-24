# DentVision V2 — Backend Report

**Date:** 2026-07-17

---

## TWO BACKENDS

| Property | Legacy (server/) | New (dentvision-backend/) |
|---|---|---|
| Language | JavaScript (ES Modules) | TypeScript |
| Framework | Express 4.x | Express 4.x |
| ORM | Prisma | Prisma |
| Deployed | YES (Render) | NO |
| Port | 3001 | 3001 (conflicts) |
| Files | 27 | ~40 |
| LOC | ~5,130 | ~4,000 |

---

## LEGACY BACKEND (`server/`)

### Entry Point: index.js (581 lines)
- 25+ bridge routes mapping frontend paths to CRM routes
- Full seed data (users, clinics, patients, shop, school)
- Inline handlers for medical, files, audit, shop
- Base64 body bypass middleware (x-dv-data header)
- Helmet, CORS, rate limiting

### Route Files (11)

| File | Lines | Endpoints | Auth |
|---|---|---|---|
| auth.js | 278 | 11 | Mixed |
| clinic.js | 172 | 4 | Protected |
| crm.js | 177 | 44 (14 resources × 3) | Protected |
| medical.js | 194 | 10 | Protected |
| notifications.js | 139 | 5 | Protected |
| profile.js | 191 | 13 | Protected |
| public.js | 63 | 3 | Public |
| school.js | 271 | 15 | Mixed |
| shop.js | 301 | 16 | Mixed |
| serviceAccess.js | 96 | 3 | Protected |
| audit.js | 57 | 2 | Protected |

**Total: ~126 endpoints** (including bridge routes)

### Middleware (3)

| File | Lines | Purpose |
|---|---|---|
| auth.js | 63 | JWT verify, generate tokens, optionalAuth |
| rbac.js | 103 | requireRole, requirePermission, requireSuperadmin, requireSameClinic |
| serviceAccess.js | 66 | requireServiceAccess, invalidateServiceCache, getEnabledServices |

### AI System (13 files)
See AI_REPORT.md for full details.

### Lib (2 files)
- `prisma.js` — Singleton Prisma client
- `notifications.js` — Notification creation helper

### Issues
- index.js is a god file (581 lines with bridge routes + seed + inline handlers)
- Raw SQL in clinic.js (table name interpolation)
- Encryption key random on restart
- JWT fallback secret from DATABASE_URL
- No WebSocket support
- No file upload processing (metadata only)

---

## NEW BACKEND (`dentvision-backend/`)

### Structure
```
src/
├── config.ts              — Zod env validation
├── app.ts                 — Express app setup
├── server.ts              — Server entry
├── lib/                   — prisma, jwt, password, logger
├── middleware/             — auth, rbac, validate, errorHandler
└── modules/
    ├── auth/              — Login, register, refresh, password reset (stub)
    ├── ai/                — Full AI system (not deployed)
    ├── files/             — Multer upload (fake storage)
    └── [planned]          — clinic, patient, appointment, etc.
```

### What's Built
- Auth with separate JWT secrets + Zod validation
- RBAC with 9 roles + hierarchy
- AI multi-agent system (18 files)
- File upload with Multer (fake storage)
- Validate middleware (exists but unused)

### What's Missing
- All CRUD modules (clinic, patient, appointment, billing, etc.)
- Real file storage (S3/local)
- WebSocket support
- Notification system
- Audit logging
- Password reset (stub only)

---

## RECOMMENDATIONS

### Immediate
1. Deploy new AI backend alongside legacy
2. Add bridge routes for AI endpoints in legacy backend
3. Fix security issues in legacy (JWT secret, auth on bridges)

### Short-term
4. Migrate CRUD modules to new backend one-by-one
5. Implement real file storage (S3 or local disk)
6. Add WebSocket support to new backend
7. Complete password reset flow

### Medium-term
8. Build all missing CRUD modules in new backend
9. Migrate frontend to new backend endpoints
10. Decommission legacy backend

### Architecture Decision
**Recommended path:** Keep legacy backend as primary. Gradually migrate modules to new backend. Use bridge routes to maintain compatibility. Do NOT rewrite from scratch.
