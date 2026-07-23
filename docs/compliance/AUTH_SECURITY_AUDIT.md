# Auth & Security Audit

## Current State (Pre-Compliance)

| Component | Status | Notes |
|-----------|--------|-------|
| JWT access tokens | ✅ Implemented | `jsonwebtoken`, configurable expiry |
| JWT refresh tokens | ✅ Implemented | Separate secret, `/auth/refresh` endpoint |
| Password hashing | ✅ Implemented | `bcrypt` via `hashPassword/comparePassword` |
| Password policy | ✅ Implemented | `assertPasswordPolicy` (min length, complexity) |
| Session tracking | ❌ Missing | No user session table or device tracking |
| Login history | ❌ Missing | No record of login attempts |
| Device/browser tracking | ❌ Missing | No user-agent parsing on login |
| 2FA / MFA | ❌ Not implemented | Not yet required |
| Email verification | ❌ Not implemented | Open registration without verification |
| Phone verification | ❌ Not implemented | Phone field exists but not verified |
| Rate limiting | ✅ Implemented | `express-rate-limit` on auth routes |

## Post-Compliance Improvements

- UserSession model added with device, browser, IP, lastActivity
- Session creation on login (`compliance/session.service.ts`)
- Session listing and expiry endpoints (`GET/POST /api/compliance/sessions`)
- IP logging on all audit events
- Consent management framework added
