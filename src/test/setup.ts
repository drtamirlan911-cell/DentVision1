import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Backend modules parse env at import time. CI frontend job has no secrets —
// provide safe test defaults so pure unit tests (planEntitlements, currency, …) load.
vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:5432/dentvision_test')
// Secrets must be ≥32 chars to satisfy the backend env schema (config.ts).
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-0000000000000000000000')
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-000000000000000000')
vi.stubEnv('NODE_ENV', 'test')
