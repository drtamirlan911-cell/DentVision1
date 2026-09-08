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
-- The V2 bootstrap may be supplied separately in some environments, so this
-- migration remains deploy-safe when one of its dependent tables is absent.
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

DO $$
BEGIN
  IF to_regclass('public.treatment_plan_releases') IS NOT NULL THEN
    ALTER TABLE "treatment_plan_releases" ADD COLUMN IF NOT EXISTS "firstViewedAt" TIMESTAMP(3);
    ALTER TABLE "treatment_plan_releases" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
  END IF;

  IF to_regclass('public.bookings') IS NOT NULL THEN
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "releaseId" TEXT;
    CREATE INDEX IF NOT EXISTS "bookings_releaseId_idx" ON "bookings"("releaseId");

    IF to_regclass('public.treatment_plan_releases') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'bookings_releaseId_fkey'
       ) THEN
      ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_releaseId_fkey"
        FOREIGN KEY ("releaseId") REFERENCES "treatment_plan_releases"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
