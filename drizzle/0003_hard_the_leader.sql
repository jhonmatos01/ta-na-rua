ALTER TABLE "occurrence_images" ADD COLUMN "public_storage_key" varchar(512);--> statement-breakpoint
ALTER TABLE "occurrence_images" ADD COLUMN "sanitization_mode" varchar(20);