-- Compatibility marker for an abandoned parallel branch foundation.
-- Canonical branch storage is public.branches (clinic/org scoped). The old
-- PascalCase Branch/BranchMember schema referenced Organization/User, which
-- are not part of the canonical physical schema and could make a fresh Prisma
-- deploy fail before init_full_schema. Keep this migration as a successful
-- marker; canonical branch provisioning is handled by the adjacent migrations
-- and ensure-branch-model.ts.
SELECT 1;
