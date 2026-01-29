ALTER TABLE "analysis_results" ADD COLUMN "ignored" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD COLUMN "ignored_at" timestamp;