-- DICOM study/series/instance metadata index for imported Part 10 objects.
-- Pixel data stays in private object storage; these rows contain identifiers and
-- presentation metadata only. This is not a DICOMweb/PACS archive implementation.
CREATE TABLE IF NOT EXISTS "diagnostic_dicom_studies" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "modalityId" TEXT,
  "studyInstanceUid" TEXT NOT NULL,
  "accessionNumber" TEXT,
  "modality" TEXT,
  "studyDate" TEXT,
  "studyTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "diagnostic_dicom_studies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_dicom_studies_centerId_studyInstanceUid_key"
  ON "diagnostic_dicom_studies"("centerId", "studyInstanceUid");
CREATE INDEX IF NOT EXISTS "diagnostic_dicom_studies_referralId_createdAt_idx"
  ON "diagnostic_dicom_studies"("referralId", "createdAt");
CREATE INDEX IF NOT EXISTS "diagnostic_dicom_studies_modalityId_idx"
  ON "diagnostic_dicom_studies"("modalityId");

DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_studies" ADD CONSTRAINT "diagnostic_dicom_studies_referralId_fkey"
    FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_studies" ADD CONSTRAINT "diagnostic_dicom_studies_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "diagnostic_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_studies" ADD CONSTRAINT "diagnostic_dicom_studies_modalityId_fkey"
    FOREIGN KEY ("modalityId") REFERENCES "diagnostic_modalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "diagnostic_dicom_series" (
  "id" TEXT NOT NULL,
  "dicomStudyId" TEXT NOT NULL,
  "seriesInstanceUid" TEXT NOT NULL,
  "modality" TEXT,
  "seriesNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_dicom_series_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_dicom_series_dicomStudyId_seriesInstanceUid_key"
  ON "diagnostic_dicom_series"("dicomStudyId", "seriesInstanceUid");
CREATE INDEX IF NOT EXISTS "diagnostic_dicom_series_dicomStudyId_createdAt_idx"
  ON "diagnostic_dicom_series"("dicomStudyId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_series" ADD CONSTRAINT "diagnostic_dicom_series_dicomStudyId_fkey"
    FOREIGN KEY ("dicomStudyId") REFERENCES "diagnostic_dicom_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "diagnostic_dicom_instances" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "referralFileId" TEXT NOT NULL,
  "sopInstanceUid" TEXT NOT NULL,
  "sopClassUid" TEXT NOT NULL,
  "transferSyntaxUid" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "rows" INTEGER,
  "columns" INTEGER,
  "numberOfFrames" INTEGER,
  "bitsAllocated" INTEGER,
  "photometricInterpretation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_dicom_instances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_dicom_instances_referralFileId_key"
  ON "diagnostic_dicom_instances"("referralFileId");
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_dicom_instances_sopInstanceUid_key"
  ON "diagnostic_dicom_instances"("sopInstanceUid");
CREATE INDEX IF NOT EXISTS "diagnostic_dicom_instances_seriesId_createdAt_idx"
  ON "diagnostic_dicom_instances"("seriesId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_instances" ADD CONSTRAINT "diagnostic_dicom_instances_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "diagnostic_dicom_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "diagnostic_dicom_instances" ADD CONSTRAINT "diagnostic_dicom_instances_referralFileId_fkey"
    FOREIGN KEY ("referralFileId") REFERENCES "referral_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
