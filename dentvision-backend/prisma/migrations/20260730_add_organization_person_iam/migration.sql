-- CreateTable: organizations
CREATE TABLE "organizations" (
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
CREATE TABLE "persons" (
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
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- CreateTable: person_roles
CREATE TABLE "person_roles" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_id" TEXT,

    CONSTRAINT "person_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "organizations_original_type_original_id_key" ON "organizations"("original_type", "original_id");
CREATE INDEX "organizations_type_idx" ON "organizations"("type");
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

CREATE UNIQUE INDEX "persons_user_id_key" ON "persons"("user_id");
CREATE UNIQUE INDEX "persons_original_type_original_id_key" ON "persons"("original_type", "original_id");
CREATE INDEX "persons_person_type_idx" ON "persons"("person_type");
CREATE INDEX "persons_organization_id_idx" ON "persons"("organization_id");

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX "person_roles_person_id_role_id_key" ON "person_roles"("person_id", "role_id");
CREATE INDEX "person_roles_person_id_idx" ON "person_roles"("person_id");
CREATE INDEX "person_roles_role_id_idx" ON "person_roles"("role_id");

-- AddForeignKeys
ALTER TABLE "persons" ADD CONSTRAINT "persons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_roles" ADD CONSTRAINT "person_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
