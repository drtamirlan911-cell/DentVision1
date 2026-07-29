# Security Policy

## Authentication
- JWT-based with access + refresh tokens
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, rotatable
- Passwords hashed with bcrypt, minimum 8 chars, complexity enforced

## Session Management
- Sessions recorded on login: device, browser, IP, last activity
- Sessions auto-expire after 7 days inactivity
- Users can view/terminate sessions from Security & Compliance panel
- "Logout everywhere" terminates all active sessions

## Access Control
- Role-based: UserRole enum (OWNER/ADMIN/DOCTOR/ASSISTANT/...)
- Permission-based: granular `domain.action` keys for fine-grained access
- Middleware: `requirePermission()`, `requireRole()`, `requireMinRole()`, `requireSuperadmin()`
- Multi-tenant isolation: `clinicId` scoping on all CRM queries

## Audit
- All mutating operations logged to `audit_logs` table
- Audit includes: userId, clinicId, action, entity, entityId, IP, timestamp
- Audit log viewable by ADMIN+ roles
- CSV export available from audit UI
