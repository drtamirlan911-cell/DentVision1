-- Auto-fix: add missing updatedAt columns to all tables
DO $$
DECLARE
  tables text[] := ARRAY[
    'users', 'clinics', 'bookings', 'clinic_members', 'clinic_invitations',
    'patients', 'appointments', 'waiting_list', 'expenses', 'promotions',
    'services', 'chairs', 'visit_notes', 'teeth', 'treatment_plans',
    'patient_images', 'documents', 'invoices', 'invoice_items', 'inventory',
    'ai_sessions', 'ai_actions', 'ai_alerts', 'suppliers', 'supplier_documents',
    'products', 'cart_items', 'wishlist_items', 'academies', 'lecturers',
    'expert_verifications', 'courses', 'lessons', 'school_enrollments',
    'notifications', 'audit_logs', 'ai_messages', 'ai_memory',
    'community_posts', 'community_likes', 'community_comments', 'community_views',
    'dm_conversations', 'dm_participants', 'dm_messages',
    'wallets', 'transactions', 'ledger_entries', 'commission_rules',
    'payments', 'subscriptions', 'payouts', 'disputes',
    'dentcash_plans', 'job_applications', 'vacancies',
    'bi_snapshots', 'dashboards', 'metrics',
    'partners', 'partner_tiers', 'partner_kpis', 'partner_slas',
    'marketing_campaigns',
    'ai_events', 'customer_metrics',
    'user_sessions', 'consents', 'encrypted_files', 'medical_files'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ', t);
      RAISE NOTICE 'OK: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
