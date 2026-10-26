CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "accounts_sub_unique" UNIQUE("sub")
);
--> statement-breakpoint
CREATE TABLE "render_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"photo_count" integer NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"output_bytes" integer,
	"duration_seconds" real,
	"render_ms" integer,
	CONSTRAINT "render_jobs_status_check" CHECK ("render_jobs"."status" in ('queued', 'rendering', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "render_jobs_account_created_idx" ON "render_jobs" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "render_jobs_queue_idx" ON "render_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "render_jobs_one_active_per_account" ON "render_jobs" USING btree ("account_id") WHERE "render_jobs"."status" in ('queued', 'rendering');--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" USING btree ("account_id");