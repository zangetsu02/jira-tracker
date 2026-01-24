CREATE TABLE "microservices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"path" text NOT NULL,
	"pdf_filename" varchar(255),
	"pdf_path" text,
	"last_analysis" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "microservices_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "usecases" (
	"id" serial PRIMARY KEY NOT NULL,
	"microservice_id" integer,
	"code" varchar(50),
	"title" varchar(255),
	"description" text,
	"actors" text,
	"preconditions" text,
	"main_flow" text,
	"alternative_flows" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"microservice_id" integer,
	"usecase_id" integer,
	"status" varchar(50) NOT NULL,
	"confidence" varchar(50),
	"evidence" text,
	"notes" text,
	"jira_issue_key" varchar(50),
	"analyzed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jira_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"default_project" varchar(50),
	"updated_at" timestamp DEFAULT now(),
	"user_id" text NOT NULL,
	CONSTRAINT "jira_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"microservices_directory" text NOT NULL,
	"microservices_pattern" varchar(100) DEFAULT 'sil-ms-*',
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "app_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "usecases" ADD CONSTRAINT "usecases_microservice_id_microservices_id_fk" FOREIGN KEY ("microservice_id") REFERENCES "public"."microservices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_microservice_id_microservices_id_fk" FOREIGN KEY ("microservice_id") REFERENCES "public"."microservices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_usecase_id_usecases_id_fk" FOREIGN KEY ("usecase_id") REFERENCES "public"."usecases"("id") ON DELETE cascade ON UPDATE no action;