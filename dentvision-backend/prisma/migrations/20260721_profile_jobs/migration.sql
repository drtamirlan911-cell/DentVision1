-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileMeta" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_vacancies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "salary" TEXT NOT NULL DEFAULT '',
    "employmentType" TEXT NOT NULL DEFAULT 'Полная занятость',
    "description" TEXT NOT NULL DEFAULT '',
    "tags" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "kind" TEXT NOT NULL DEFAULT 'vacancy',
    "userId" TEXT,
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_applications" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "coverNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_vacancies_status_city_idx" ON "job_vacancies"("status", "city");
CREATE INDEX IF NOT EXISTS "job_vacancies_userId_idx" ON "job_vacancies"("userId");
CREATE INDEX IF NOT EXISTS "job_applications_userId_idx" ON "job_applications"("userId");
CREATE INDEX IF NOT EXISTS "job_applications_vacancyId_userId_idx" ON "job_applications"("vacancyId", "userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "job_vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
