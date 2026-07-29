-- Migration: add_registration_requests
-- Creates a table for center/lab self-registration requests

CREATE TABLE IF NOT EXISTS registration_requests (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('center', 'laboratory')),
    name        TEXT NOT NULL,
    city        TEXT,
    address     TEXT,
    phone       TEXT,
    email       TEXT,
    comment     TEXT,
    status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewer_id TEXT,
    review_note TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_type ON registration_requests(type);
