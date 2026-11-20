-- Durable candidate-side recruitment lifecycle.
-- Applications remain independent of vacancy publication state; closing a vacancy
-- must not delete the applicant's history. Invitations, interviews and offers are
-- separate records and never imply a signed employment contract.

CREATE TABLE IF NOT EXISTS "job_application_events" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "candidateVisible" BOOLEAN NOT NULL DEFAULT true,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_application_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_application_events_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_application_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "job_application_events_applicationId_createdAt_idx"
  ON "job_application_events"("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "job_application_events_actorUserId_createdAt_idx"
  ON "job_application_events"("actorUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "job_invitations" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "employerOrganizationId" TEXT,
  "vacancyId" TEXT,
  "employerNameSnapshot" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "job_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_invitations_candidateUserId_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_invitations_senderUserId_fkey"
    FOREIGN KEY ("senderUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_invitations_employerOrganizationId_fkey"
    FOREIGN KEY ("employerOrganizationId") REFERENCES "organizations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "job_invitations_vacancyId_fkey"
    FOREIGN KEY ("vacancyId") REFERENCES "job_vacancies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "job_invitations_candidateUserId_status_createdAt_idx"
  ON "job_invitations"("candidateUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "job_invitations_employerOrganizationId_status_createdAt_idx"
  ON "job_invitations"("employerOrganizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "job_invitations_vacancyId_idx"
  ON "job_invitations"("vacancyId");

CREATE TABLE IF NOT EXISTS "job_interviews" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "employerOrganizationId" TEXT,
  "employerNameSnapshot" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
  "mode" TEXT NOT NULL DEFAULT 'online',
  "meetingUrl" TEXT,
  "location" TEXT,
  "agenda" TEXT,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "candidateResponse" TEXT,
  "candidateRespondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "job_interviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_interviews_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_interviews_candidateUserId_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_interviews_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_interviews_employerOrganizationId_fkey"
    FOREIGN KEY ("employerOrganizationId") REFERENCES "organizations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "job_interviews_candidateUserId_scheduledAt_idx"
  ON "job_interviews"("candidateUserId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "job_interviews_employerOrganizationId_scheduledAt_idx"
  ON "job_interviews"("employerOrganizationId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "job_interviews_applicationId_scheduledAt_idx"
  ON "job_interviews"("applicationId", "scheduledAt");

CREATE TABLE IF NOT EXISTS "job_offers" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT,
  "vacancyId" TEXT,
  "candidateUserId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "employerOrganizationId" TEXT,
  "employerNameSnapshot" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "salary" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "employmentType" TEXT NOT NULL,
  "startAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "version" INTEGER NOT NULL DEFAULT 1,
  "terms" JSONB,
  "documentUrl" TEXT,
  "respondedAt" TIMESTAMP(3),
  "candidateMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_offers_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "job_applications"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "job_offers_vacancyId_fkey"
    FOREIGN KEY ("vacancyId") REFERENCES "job_vacancies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "job_offers_candidateUserId_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_offers_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_offers_employerOrganizationId_fkey"
    FOREIGN KEY ("employerOrganizationId") REFERENCES "organizations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "job_offers_candidateUserId_status_createdAt_idx"
  ON "job_offers"("candidateUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "job_offers_employerOrganizationId_status_createdAt_idx"
  ON "job_offers"("employerOrganizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "job_offers_applicationId_createdAt_idx"
  ON "job_offers"("applicationId", "createdAt");
