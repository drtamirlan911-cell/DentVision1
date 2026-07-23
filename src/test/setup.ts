import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Backend modules parse env at import time. CI frontend job has no secrets —
// provide safe test defaults so pure unit tests (planEntitlements, currency, …) load.
vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:5432/dentvision_test')
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-16c')
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret16')
vi.stubEnv('NODE_ENV', 'test')
