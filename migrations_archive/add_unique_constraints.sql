-- Migration: Add Missing Unique Constraints
-- Date: 2025-12-21
-- Description: Adds unique constraints to prevent data integrity issues

-- Issue #25: Add unique constraints for data integrity

-- 1. Users: email should be unique
-- First, check for and handle duplicates if any exist
DO $$
BEGIN
  -- Add unique constraint on email (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    -- Clean up duplicates first (keep the oldest)
    DELETE FROM users a USING users b
    WHERE a.id > b.id
      AND a.email = b.email
      AND a.email IS NOT NULL;

    -- Add unique constraint
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- 2. Workflows: slug should be unique (used for public URLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflows_slug_unique'
  ) THEN
    -- Clean up duplicate slugs (keep the oldest)
    UPDATE workflows a
    SET slug = slug || '-' || substring(id::text, 1, 8)
    WHERE slug IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM workflows b
        WHERE b.slug = a.slug
          AND b.id < a.id
      );

    -- Add unique constraint
    ALTER TABLE workflows ADD CONSTRAINT workflows_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- 3. Secrets: (projectId, key) should be unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'secrets_project_key_unique'
  ) THEN
    -- Clean up duplicates (keep the most recent)
    DELETE FROM secrets a USING secrets b
    WHERE a.id < b.id
      AND a.project_id = b.project_id
      AND a.key = b.key;

    -- Add unique constraint
    ALTER TABLE secrets ADD CONSTRAINT secrets_project_key_unique UNIQUE (project_id, key);
  END IF;
END $$;

-- 4. Connections: (projectId, name) should be unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connections_project_name_unique'
  ) THEN
    -- Clean up duplicates (keep the most recent)
    UPDATE connections a
    SET name = name || '-' || substring(id::text, 1, 8)
    WHERE EXISTS (
      SELECT 1 FROM connections b
      WHERE b.project_id = a.project_id
        AND b.name = a.name
        AND b.id < a.id
    );

    -- Add unique constraint
    ALTER TABLE connections ADD CONSTRAINT connections_project_name_unique UNIQUE (project_id, name);
  END IF;
END $$;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added unique constraints to users.email, workflows.slug, secrets.(project_id,key), connections.(project_id,name)';
END $$;
