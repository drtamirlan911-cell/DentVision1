-- CreateTable: organizations
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "contacts" JSONB,
    "settings" JSONB,
    "original_type" TEXT,
    "original_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: persons
CREATE TABLE IF NOT EXISTS "persons" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "person_type" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "specialization" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "contacts" JSONB,
    "original_type" TEXT,
    "original_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: permissions
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: roles
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_permissions
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- CreateTable: person_roles
CREATE TABLE IF NOT EXISTS "person_roles" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_id" TEXT,

    CONSTRAINT "person_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_original_type_original_id_key" ON "organizations"("original_type", "original_id");
CREATE INDEX IF NOT EXISTS "organizations_type_idx" ON "organizations"("type");
CREATE INDEX IF NOT EXISTS "organizations_name_idx" ON "organizations"("name");

-- The global unique on persons(user_id) that used to be created here is gone:
-- it limited the unified model to one organization per user and is replaced by
-- the per-organization unique in 20260808_person_multi_org. Re-creating it here
-- would undo that migration on any database where this one runs afterwards.
CREATE UNIQUE INDEX IF NOT EXISTS "persons_original_type_original_id_key" ON "persons"("original_type", "original_id");
CREATE INDEX IF NOT EXISTS "persons_person_type_idx" ON "persons"("person_type");
CREATE INDEX IF NOT EXISTS "persons_organization_id_idx" ON "persons"("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "person_roles_person_id_role_id_key" ON "person_roles"("person_id", "role_id");
CREATE INDEX IF NOT EXISTS "person_roles_person_id_idx" ON "person_roles"("person_id");
CREATE INDEX IF NOT EXISTS "person_roles_role_id_idx" ON "person_roles"("role_id");

-- AddForeignKeys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'persons_organization_id_fkey') THEN
    ALTER TABLE "persons" ADD CONSTRAINT "persons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'role_permissions_role_id_fkey') THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'role_permissions_permission_id_fkey') THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'person_roles_person_id_fkey') THEN
    ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = 'person_roles_role_id_fkey') THEN
    ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
