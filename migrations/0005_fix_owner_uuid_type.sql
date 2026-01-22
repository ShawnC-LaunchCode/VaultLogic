-- Migration to fix owner_uuid type mismatch (UUID -> VARCHAR)
-- This allows storing both UUIDs (Orgs) and Nanoids (Users) in the same column

ALTER TABLE "projects" ALTER COLUMN "owner_uuid" SET DATA TYPE VARCHAR;
ALTER TABLE "workflows" ALTER COLUMN "owner_uuid" SET DATA TYPE VARCHAR;
ALTER TABLE "datavault_databases" ALTER COLUMN "owner_uuid" SET DATA TYPE VARCHAR;
ALTER TABLE "workflow_runs" ALTER COLUMN "owner_uuid" SET DATA TYPE VARCHAR;
