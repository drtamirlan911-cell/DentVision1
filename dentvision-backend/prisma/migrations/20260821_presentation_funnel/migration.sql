-- Concierge Phase 6: the funnel.
--
-- `firstViewedAt`/`finishedAt` on the release: whether the patient actually
-- opened and finished their presentation. Kept on the release, not on
-- PatientPresentation, because a patient may watch the plain deterministic
-- script with no PatientPresentation row ever existing.
--
-- `Booking.releaseId`: set when a request was filed from the presentation
-- screen — the funnel's tracked conversion. Null everywhere else.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

ALTER TABLE "treatment_plan_releases" ADD COLUMN IF NOT EXISTS "firstViewedAt" TIMESTAMP(3);
ALTER TABLE "treatment_plan_releases" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "releaseId" TEXT;
CREATE INDEX IF NOT EXISTS "bookings_releaseId_idx" ON "bookings"("releaseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bookings_releaseId_fkey') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "treatment_plan_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
