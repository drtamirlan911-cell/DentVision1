-- Keep partner branch capacity subscriptions separate from clinic SaaS and transaction commissions.
ALTER TYPE "RevenueSource" ADD VALUE IF NOT EXISTS 'PARTNER_BRANCH_SUBSCRIPTION';
