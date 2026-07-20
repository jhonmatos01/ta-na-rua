CREATE TYPE "public"."ai_analysis_type" AS ENUM('CLASSIFICATION', 'DUPLICATE_DETECTION', 'CONTENT_MODERATION', 'REASSESSMENT');--> statement-breakpoint
CREATE TYPE "public"."image_type" AS ENUM('INITIAL', 'UPDATE', 'BEFORE_REPAIR', 'DURING_REPAIR', 'AFTER_REPAIR', 'EVALUATION');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('OCCURRENCE_CREATED', 'STATUS_CHANGED', 'OCCURRENCE_CONFIRMED', 'OCCURRENCE_DUPLICATE', 'REPAIR_EVALUATION_REQUESTED', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('PENDING_REVIEW', 'PUBLISHED', 'FORWARDED', 'ACKNOWLEDGED', 'UNDER_ANALYSIS', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CONTESTED', 'CLOSED', 'REJECTED', 'DUPLICATE');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('WEB_APP', 'TELEGRAM', 'WHATSAPP', 'ADMIN', 'API');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'PENDING', 'BLOCKED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(120),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"state" char(2) NOT NULL,
	"ibge_code" varchar(7) NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_latitude_chk" CHECK ("municipalities"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "municipalities_longitude_chk" CHECK ("municipalities"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid,
	"report_id" uuid,
	"analysis_type" "ai_analysis_type" NOT NULL,
	"model_name" varchar(150) NOT NULL,
	"suggested_category" varchar(100),
	"suggested_subcategory" varchar(100),
	"suggested_severity" integer,
	"suggested_risk" varchar(20),
	"confidence" numeric(4, 3) NOT NULL,
	"summary" text,
	"possible_duplicates" jsonb,
	"raw_result" jsonb NOT NULL,
	"requires_human_review" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_analyses_target_chk" CHECK ("ai_analyses"."occurrence_id" IS NOT NULL OR "ai_analyses"."report_id" IS NOT NULL),
	CONSTRAINT "ai_analyses_confidence_chk" CHECK ("ai_analyses"."confidence" BETWEEN 0 AND 1),
	CONSTRAINT "ai_analyses_severity_chk" CHECK ("ai_analyses"."suggested_severity" IS NULL OR "ai_analyses"."suggested_severity" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "occurrence_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"directly_affected" boolean DEFAULT false NOT NULL,
	"problem_worsened" boolean DEFAULT false NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_confirmations_comment_length_chk" CHECK ("occurrence_confirmations"."comment" IS NULL OR char_length("occurrence_confirmations"."comment") <= 500)
);
--> statement-breakpoint
CREATE TABLE "occurrence_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"report_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"file_url" varchar(2048) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"image_type" "image_type" DEFAULT 'INITIAL' NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_images_file_size_chk" CHECK ("occurrence_images"."file_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "occurrence_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"original_description" text NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "report_source" DEFAULT 'WEB_APP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrence_reports_latitude_chk" CHECK ("occurrence_reports"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "occurrence_reports_longitude_chk" CHECK ("occurrence_reports"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "occurrence_reports_description_length_chk" CHECK (char_length("occurrence_reports"."original_description") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "occurrence_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"previous_status" "occurrence_status",
	"new_status" "occurrence_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"reason" text,
	"public_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" varchar(32) NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"category_id" uuid,
	"municipality_id" uuid NOT NULL,
	"neighborhood_id" uuid,
	"created_by" uuid NOT NULL,
	"assigned_department_id" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone,
	"status" "occurrence_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"severity" integer,
	"priority_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"risk_level" "risk_level",
	"address" varchar(500),
	"neighborhood_text" varchar(150),
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"location_accuracy" numeric(10, 2),
	"anonymous_publication" boolean DEFAULT false NOT NULL,
	"confirmation_count" integer DEFAULT 0 NOT NULL,
	"duplicate_of_occurrence_id" uuid,
	"expected_resolution_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"resolution_description" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"first_reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "occurrences_latitude_chk" CHECK ("occurrences"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "occurrences_longitude_chk" CHECK ("occurrences"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "occurrences_severity_chk" CHECK ("occurrences"."severity" IS NULL OR "occurrences"."severity" BETWEEN 1 AND 5),
	CONSTRAINT "occurrences_priority_score_chk" CHECK ("occurrences"."priority_score" BETWEEN 0 AND 100),
	CONSTRAINT "occurrences_confirmation_count_chk" CHECK ("occurrences"."confirmation_count" >= 0),
	CONSTRAINT "occurrences_duplicate_self_chk" CHECK ("occurrences"."duplicate_of_occurrence_id" IS NULL OR "occurrences"."duplicate_of_occurrence_id" <> "occurrences"."id"),
	CONSTRAINT "occurrences_description_length_chk" CHECK ("occurrences"."description" IS NULL OR char_length("occurrences"."description") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "repair_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"problem_resolved" boolean NOT NULL,
	"service_quality" integer,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_evaluations_rating_chk" CHECK ("repair_evaluations"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "repair_evaluations_service_quality_chk" CHECK ("repair_evaluations"."service_quality" IS NULL OR "repair_evaluations"."service_quality" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(150) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"previous_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(150) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_attempts_chk" CHECK ("outbox_events"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "protocol_counters" (
	"year" integer NOT NULL,
	"last_value" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protocol_counters_pkey" PRIMARY KEY("year"),
	CONSTRAINT "protocol_counters_year_chk" CHECK ("protocol_counters"."year" BETWEEN 2000 AND 9999),
	CONSTRAINT "protocol_counters_last_value_chk" CHECK ("protocol_counters"."last_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"external_event_id" varchar(255) NOT NULL,
	"event_type" varchar(150) NOT NULL,
	"payload_hash" varchar(255) NOT NULL,
	"status" "webhook_event_status" DEFAULT 'RECEIVED' NOT NULL,
	"response_code" integer,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_response_code_chk" CHECK ("webhook_events"."response_code" IS NULL OR "webhook_events"."response_code" BETWEEN 100 AND 599)
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" varchar(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(32),
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'CITIZEN' NOT NULL,
	"municipality_id" uuid,
	"neighborhood" varchar(150),
	"avatar_url" varchar(2048),
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_report_id_occurrence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."occurrence_reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_confirmations" ADD CONSTRAINT "occurrence_confirmations_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_confirmations" ADD CONSTRAINT "occurrence_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_images" ADD CONSTRAINT "occurrence_images_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_images" ADD CONSTRAINT "occurrence_images_report_id_occurrence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."occurrence_reports"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_images" ADD CONSTRAINT "occurrence_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_reports" ADD CONSTRAINT "occurrence_reports_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_reports" ADD CONSTRAINT "occurrence_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_status_history" ADD CONSTRAINT "occurrence_status_history_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrence_status_history" ADD CONSTRAINT "occurrence_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_neighborhood_id_neighborhoods_id_fk" FOREIGN KEY ("neighborhood_id") REFERENCES "public"."neighborhoods"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_assigned_department_id_departments_id_fk" FOREIGN KEY ("assigned_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_duplicate_of_occurrence_id_occurrences_id_fk" FOREIGN KEY ("duplicate_of_occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "repair_evaluations" ADD CONSTRAINT "repair_evaluations_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "repair_evaluations" ADD CONSTRAINT "repair_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_code_uidx" ON "categories" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uidx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_active_name_idx" ON "categories" USING btree ("active","name");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_municipality_name_uidx" ON "departments" USING btree ("municipality_id","name");--> statement-breakpoint
CREATE INDEX "departments_municipality_active_idx" ON "departments" USING btree ("municipality_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_ibge_code_uidx" ON "municipalities" USING btree ("ibge_code");--> statement-breakpoint
CREATE INDEX "municipalities_state_name_idx" ON "municipalities" USING btree ("state","name");--> statement-breakpoint
CREATE UNIQUE INDEX "neighborhoods_municipality_slug_uidx" ON "neighborhoods" USING btree ("municipality_id","slug");--> statement-breakpoint
CREATE INDEX "neighborhoods_municipality_idx" ON "neighborhoods" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "neighborhoods_name_idx" ON "neighborhoods" USING btree ("name");--> statement-breakpoint
CREATE INDEX "neighborhoods_slug_idx" ON "neighborhoods" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ai_analyses_occurrence_idx" ON "ai_analyses" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "ai_analyses_report_idx" ON "ai_analyses" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "ai_analyses_review_idx" ON "ai_analyses" USING btree ("requires_human_review","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_confirmations_occurrence_user_uidx" ON "occurrence_confirmations" USING btree ("occurrence_id","user_id");--> statement-breakpoint
CREATE INDEX "occurrence_confirmations_user_idx" ON "occurrence_confirmations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_images_storage_key_uidx" ON "occurrence_images" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "occurrence_images_occurrence_idx" ON "occurrence_images" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "occurrence_images_report_idx" ON "occurrence_images" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "occurrence_images_moderation_idx" ON "occurrence_images" USING btree ("moderation_status","created_at");--> statement-breakpoint
CREATE INDEX "occurrence_reports_occurrence_idx" ON "occurrence_reports" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "occurrence_reports_reported_by_idx" ON "occurrence_reports" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX "occurrence_reports_reported_at_idx" ON "occurrence_reports" USING btree ("reported_at");--> statement-breakpoint
CREATE INDEX "occurrence_reports_location_gist_idx" ON "occurrence_reports" USING gist ("location");--> statement-breakpoint
CREATE INDEX "occurrence_status_history_occurrence_created_idx" ON "occurrence_status_history" USING btree ("occurrence_id","created_at");--> statement-breakpoint
CREATE INDEX "occurrence_status_history_changed_by_idx" ON "occurrence_status_history" USING btree ("changed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_protocol_uidx" ON "occurrences" USING btree ("protocol");--> statement-breakpoint
CREATE INDEX "occurrences_municipality_idx" ON "occurrences" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "occurrences_neighborhood_idx" ON "occurrences" USING btree ("neighborhood_id");--> statement-breakpoint
CREATE INDEX "occurrences_category_idx" ON "occurrences" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "occurrences_status_idx" ON "occurrences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "occurrences_created_at_idx" ON "occurrences" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "occurrences_confirmation_count_idx" ON "occurrences" USING btree ("confirmation_count");--> statement-breakpoint
CREATE INDEX "occurrences_dashboard_idx" ON "occurrences" USING btree ("municipality_id","status","category_id","created_at");--> statement-breakpoint
CREATE INDEX "occurrences_priority_idx" ON "occurrences" USING btree ("municipality_id","priority_score");--> statement-breakpoint
CREATE INDEX "occurrences_location_gist_idx" ON "occurrences" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "repair_evaluations_occurrence_user_uidx" ON "repair_evaluations" USING btree ("occurrence_id","user_id");--> statement-breakpoint
CREATE INDEX "repair_evaluations_user_idx" ON "repair_evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "outbox_events_status_available_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_events_entity_idx" ON "outbox_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_external_uidx" ON "webhook_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_received_idx" ON "webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_uidx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_revoked_idx" ON "refresh_tokens" USING btree ("expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uidx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_municipality_role_status_idx" ON "users" USING btree ("municipality_id","role","status");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");
