DO $$ BEGIN
    ALTER TYPE "public"."auth_provider" ADD VALUE 'github';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "public"."auth_provider" ADD VALUE 'email';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "public"."user_role" ADD VALUE 'user';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TYPE "public"."user_role" ADD VALUE 'guest';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "audit_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_connections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "system_stats" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_personalization_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "audit_events" CASCADE;--> statement-breakpoint
DROP TABLE "external_connections" CASCADE;--> statement-breakpoint
DROP TABLE "resource_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "system_stats" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_personalization_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "secrets" DROP CONSTRAINT "secrets_project_key_unique";--> statement-breakpoint
ALTER TABLE "ai_settings" DROP CONSTRAINT "ai_settings_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "connections" DROP CONSTRAINT "connections_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "workflow_run_metrics" DROP CONSTRAINT IF EXISTS "workflow_run_metrics_run_id_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_creator_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_owner_id_users_id_fk";

--> statement-breakpoint
DROP INDEX IF EXISTS "connections_type_idx";--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" SET DEFAULT 'http'::text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."connection_type" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('postgres', 'mysql', 'salesforce', 'hubspot', 'slack', 'stripe', 'google_sheets', 'http');--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" SET DEFAULT 'http'::"public"."connection_type";--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" SET DATA TYPE "public"."connection_type" USING "type"::"public"."connection_type";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_feedback_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_feedback_rating_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_feedback_operation_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_feedback_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_question_event_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_page_event_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_duration_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_survey_question_event_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_survey_page_event_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "anonymous_tracking_survey_session_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "api_keys_key_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_ws_ts_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_resource_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "blocks_section_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collab_docs_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collab_docs_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collab_snapshots_doc_ts_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collab_updates_doc_ts_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collection_fields_slug_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collection_fields_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collection_fields_collection_slug_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collections_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collections_slug_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collections_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "collections_tenant_slug_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connections_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connections_project_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connections_enabled_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connections_project_name_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_datavault_api_tokens_tenant_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_datavault_api_tokens_expires_at";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_databases_updated";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_datavault_row_notes_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_datavault_row_notes_row_created";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_table_permissions_user";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_table_permissions_role";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_writeback_mappings_table";--> statement-breakpoint
DROP INDEX IF EXISTS "document_hooks_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "document_hooks_phase_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "document_hooks_enabled_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "document_hooks_document_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "email_template_metadata_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "external_destinations_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "external_destinations_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "lifecycle_hooks_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "lifecycle_hooks_phase_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "lifecycle_hooks_section_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "lifecycle_hooks_enabled_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "logic_rules_condition_step_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "logic_rules_target_step_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "logic_rules_target_section_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "metrics_events_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "metrics_events_run_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "metrics_rollups_workflow_bucket_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "metrics_rollups_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_org_invites_email_failed";--> statement-breakpoint
DROP INDEX IF EXISTS "records_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_created_by_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "records_data_gin_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "review_tasks_node_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "review_tasks_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "review_tasks_project_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "run_generated_documents_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "run_outputs_template_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "run_outputs_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "run_outputs_workflow_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "script_execution_log_script_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "script_execution_log_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "script_execution_log_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "secrets_project_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "secrets_project_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "secrets_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_events_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_requests_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_requests_node_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_requests_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_requests_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "signature_requests_project_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sli_configs_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sli_configs_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sli_windows_workflow_window_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "sli_windows_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "steps_is_virtual_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "template_metrics_result_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "template_metrics_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "template_versions_template_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "template_versions_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "template_versions_created_by_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "templates_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transform_blocks_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transform_blocks_workflow_order_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transform_blocks_phase_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transform_blocks_virtual_step_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_blueprints_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_blueprints_creator_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_blueprints_public_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_workflow_data_sources_source";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_workflow_queries_table";--> statement-breakpoint
DROP INDEX IF EXISTS "wre_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "wrm_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_snapshots_workflow_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_snapshots_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_snapshots_version_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_templates_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_templates_template_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_templates_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_versions_published_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_versions_created_by_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_versions_checksum_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflows_source_blueprint_idx";--> statement-breakpoint
ALTER TABLE "ai_settings" ALTER COLUMN "scope" SET DEFAULT 'global';--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "resource_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_fields" ALTER COLUMN "type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "base_url" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "base_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_template_metadata" ALTER COLUMN "template_key" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "external_destinations" ALTER COLUMN "type" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "external_destinations" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "external_destinations" ALTER COLUMN "config" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "key" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "creator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "collection_fields" ADD COLUMN "required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "collection_fields" ADD COLUMN "order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "auth_type" varchar(50) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "secret_id" uuid;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "value" text;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "environment" varchar DEFAULT 'production';--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "verification_token" varchar;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_metrics" ADD CONSTRAINT "workflow_run_metrics_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_settings_scope_idx" ON "ai_settings" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_fields_slug_unique" ON "collection_fields" USING btree ("collection_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_slug_unique" ON "collections" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "email_templates_key_idx" ON "email_template_metadata" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "ext_dest_tenant_idx" ON "external_destinations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "secrets_project_key_env_unique" ON "secrets" USING btree ("project_id","key","environment");--> statement-breakpoint
ALTER TABLE "ai_settings" DROP COLUMN "scope_id";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "collection_fields" DROP COLUMN "is_required";--> statement-breakpoint
ALTER TABLE "collection_fields" DROP COLUMN "default_value";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "auth_config";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "secret_refs";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "oauth_state";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "enabled";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "last_tested_at";--> statement-breakpoint
ALTER TABLE "connections" DROP COLUMN "last_used_at";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."collection_field_type" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."external_destination_type" CASCADE;
