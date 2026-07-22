import '@testing-library/jest-dom/vitest'

// Backend modules parse env at import time. CI frontend job has no secrets —
// provide safe test defaults so pure unit tests (planEntitlements, currency, …) load.
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@127.0.0.1:5432/dentvision_test'
process.env.JWT_SECRET ||= 'test-jwt-secret-16c'
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret16'
process.env.NODE_ENV ||= 'test'
