CREATE TABLE "microservice_pdfs" (
	"id" serial PRIMARY KEY NOT NULL,
	"microservice_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "microservice_pdfs" ADD CONSTRAINT "microservice_pdfs_microservice_id_microservices_id_fk" FOREIGN KEY ("microservice_id") REFERENCES "public"."microservices"("id") ON DELETE cascade ON UPDATE no action;