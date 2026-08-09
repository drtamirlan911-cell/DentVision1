-- Google sign-in.
--
-- `password` becomes optional: an account that only ever signed in with Google
-- has no password, and storing a random unguessable one instead would make
-- "does this account have a password?" unanswerable. Dropping NOT NULL is a
-- catalogue change — no table rewrite, no lock worth worrying about.
--
-- Idempotent throughout: `prisma migrate deploy` stops at the first failing
-- migration and blocks every one behind it.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- One Google identity maps to at most one account. Without this, two rows could
-- claim the same `sub` and the second sign-in would be ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
