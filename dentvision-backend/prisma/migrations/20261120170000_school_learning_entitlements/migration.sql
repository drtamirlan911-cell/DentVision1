-- Personal learning access is independent from academy membership.
-- Payment facts are snapshotted onto the entitlement at provider-confirmed settlement.
-- Legacy enrollments remain active but are labelled acquisitionType='legacy'.

ALTER TABLE "school_enrollments"
  ADD COLUMN IF NOT EXISTS "acquisitionType" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS "accessStatus" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "paidAmountMinor" BIGINT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KZT',
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "school_enrollments_userId_accessStatus_idx"
  ON "school_enrollments"("userId", "accessStatus");
CREATE INDEX IF NOT EXISTS "school_enrollments_paymentId_idx"
  ON "school_enrollments"("paymentId");

CREATE TABLE IF NOT EXISTS "school_assessment_attempts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "lessonId" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "correct" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "answers" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_assessment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_assessment_attempts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "school_assessment_attempts_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "school_enrollments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "school_assessment_attempts_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_assessment_attempts_enrollmentId_attemptNumber_key"
  ON "school_assessment_attempts"("enrollmentId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "school_assessment_attempts_userId_submittedAt_idx"
  ON "school_assessment_attempts"("userId", "submittedAt");
CREATE INDEX IF NOT EXISTS "school_assessment_attempts_courseId_submittedAt_idx"
  ON "school_assessment_attempts"("courseId", "submittedAt");
