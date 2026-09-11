-- Connects public diagnostic bookings to the existing clinic referral/result pipeline.
-- The mapping is intentionally separate from DiagnosticBooking so existing Prisma
-- clients and public booking writes remain backwards-compatible.
CREATE TABLE IF NOT EXISTS "diagnostic_booking_referrals" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "referral_id" TEXT NOT NULL,
  "center_id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "doctor_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_booking_referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "diagnostic_booking_referrals_booking_id_key" UNIQUE ("booking_id"),
  CONSTRAINT "diagnostic_booking_referrals_referral_id_key" UNIQUE ("referral_id")
);

CREATE INDEX IF NOT EXISTS "diagnostic_booking_referrals_center_id_idx"
  ON "diagnostic_booking_referrals" ("center_id");
CREATE INDEX IF NOT EXISTS "diagnostic_booking_referrals_clinic_id_idx"
  ON "diagnostic_booking_referrals" ("clinic_id");
CREATE INDEX IF NOT EXISTS "diagnostic_booking_referrals_doctor_id_idx"
  ON "diagnostic_booking_referrals" ("doctor_id");

-- Do not add hard FK constraints here: Referral and DiagnosticBooking have
-- independent lifecycle/legacy migrations and this bridge must remain deploy-safe.
