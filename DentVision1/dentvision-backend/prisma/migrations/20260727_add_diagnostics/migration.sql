-- CreateDiagnostics: diagnostic centers, laboratories, referrals, results
-- Run this in Neon Console SQL Editor

-- Enums
DO $$ BEGIN CREATE TYPE "DiagnosticCategory" AS ENUM('CBCT','OPG','TRG','TMJ','STL','FACE_SCAN','DICOM','ALLERGY','HISTOLOGY','PCR','MICROBIOLOGY','BLOOD','GENETICS','BIOPSY','SALIVA','PATHOLOGY','OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ReferralStatus" AS ENUM('DRAFT','SENT','ACCEPTED','SCHEDULED','PATIENT_ARRIVED','IN_PROGRESS','COMPLETED','REVIEWED','DELIVERED','CLOSED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ReferralPriority" AS ENUM('NORMAL','URGENT','EMERGENCY'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- DiagnosticCenter
CREATE TABLE IF NOT EXISTS "diagnostic_centers" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  logo TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  active BOOLEAN DEFAULT true,
  accredited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- DiagnosticCenterMember
CREATE TABLE IF NOT EXISTS "diagnostic_center_members" (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(center_id, user_id)
);
CREATE INDEX IF NOT EXISTS dcm_user_idx ON diagnostic_center_members(user_id);

-- Laboratory
CREATE TABLE IF NOT EXISTS "laboratories" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  accredited BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- LaboratoryMember
CREATE TABLE IF NOT EXISTS "laboratory_members" (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_id, user_id)
);
CREATE INDEX IF NOT EXISTS lm_user_idx ON laboratory_members(user_id);

-- DiagnosticStudy
CREATE TABLE IF NOT EXISTS "diagnostic_studies" (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category "DiagnosticCategory" NOT NULL,
  description TEXT,
  price DECIMAL DEFAULT 0,
  duration_min INT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ds_center_idx ON diagnostic_studies(center_id);
CREATE INDEX IF NOT EXISTS ds_cat_idx ON diagnostic_studies(category);

-- LaboratoryTest
CREATE TABLE IF NOT EXISTS "laboratory_tests" (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category "DiagnosticCategory" NOT NULL,
  description TEXT,
  price DECIMAL DEFAULT 0,
  turnaround_hr INT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lt_lab_idx ON laboratory_tests(lab_id);
CREATE INDEX IF NOT EXISTS lt_cat_idx ON laboratory_tests(category);

-- Operator
CREATE TABLE IF NOT EXISTS "operators" (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS op_center_idx ON operators(center_id);

-- Radiologist
CREATE TABLE IF NOT EXISTS "radiologists" (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT,
  license TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rad_center_idx ON radiologists(center_id);

-- Referral (core table)
CREATE TABLE IF NOT EXISTS "referrals" (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_iin TEXT,
  patient_birth TIMESTAMPTZ,
  patient_age INT,
  patient_gender TEXT,
  patient_phone TEXT,
  patient_email TEXT,
  pregnancy BOOLEAN DEFAULT false,
  allergies TEXT,
  special_notes TEXT,
  patient_photo TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  doctor_id TEXT NOT NULL REFERENCES users(id),
  doctor_name TEXT,
  doctor_phone TEXT,
  doctor_email TEXT,
  category "DiagnosticCategory" NOT NULL,
  study_type TEXT NOT NULL,
  anatomical_sites JSONB,
  complaints TEXT,
  preliminary_dx TEXT,
  study_goal TEXT,
  comment_for_doctor TEXT,
  comment_for_lab TEXT,
  priority "ReferralPriority" DEFAULT 'NORMAL',
  status "ReferralStatus" DEFAULT 'DRAFT',
  center_id TEXT REFERENCES diagnostic_centers(id),
  lab_id TEXT REFERENCES laboratories(id),
  operator_id TEXT REFERENCES operators(id),
  radiologist_id TEXT REFERENCES radiologists(id),
  scheduled_date TIMESTAMPTZ,
  scheduled_time TEXT,
  cost DECIMAL DEFAULT 0,
  platform_fee DECIMAL DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ref_clinic_idx ON referrals(clinic_id);
CREATE INDEX IF NOT EXISTS ref_center_idx ON referrals(center_id);
CREATE INDEX IF NOT EXISTS ref_lab_idx ON referrals(lab_id);
CREATE INDEX IF NOT EXISTS ref_doctor_idx ON referrals(doctor_id);
CREATE INDEX IF NOT EXISTS ref_patient_idx ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS ref_status_idx ON referrals(status);
CREATE INDEX IF NOT EXISTS ref_created_idx ON referrals(created_at);

-- ReferralFile
CREATE TABLE IF NOT EXISTS "referral_files" (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rf_ref_idx ON referral_files(referral_id);

-- ReferralComment
CREATE TABLE IF NOT EXISTS "referral_comments" (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_ref_idx ON referral_comments(referral_id);

-- DiagnosticResult
CREATE TABLE IF NOT EXISTS "diagnostic_results" (
  id TEXT PRIMARY KEY,
  referral_id TEXT NOT NULL UNIQUE REFERENCES referrals(id) ON DELETE CASCADE,
  report_text TEXT,
  conclusion TEXT,
  pdf_url TEXT,
  signed_by TEXT REFERENCES users(id),
  signed_at TIMESTAMPTZ,
  ai_summary TEXT,
  ai_generated BOOLEAN DEFAULT false,
  template_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Booking
CREATE TABLE IF NOT EXISTS "diagnostic_bookings" (
  id TEXT PRIMARY KEY,
  referral_id TEXT REFERENCES referrals(id),
  center_id TEXT REFERENCES diagnostic_centers(id),
  lab_id TEXT REFERENCES laboratories(id),
  study_id TEXT REFERENCES diagnostic_studies(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  date TIMESTAMPTZ NOT NULL,
  time TEXT NOT NULL,
  duration_min INT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS db_center_idx ON diagnostic_bookings(center_id);
CREATE INDEX IF NOT EXISTS db_date_idx ON diagnostic_bookings(date);

-- Schedule
CREATE TABLE IF NOT EXISTS "diagnostic_schedules" (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slots INT DEFAULT 1,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ds_center_date_idx ON diagnostic_schedules(center_id, date);
