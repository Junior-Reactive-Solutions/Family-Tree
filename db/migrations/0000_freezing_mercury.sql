CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "parentage" (
	"child_id" uuid NOT NULL,
	"union_id" uuid,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"path" text,
	"full_name" text NOT NULL,
	"title" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"is_blood_member" boolean NOT NULL,
	"gender" text DEFAULT 'U' NOT NULL,
	"gender_source" text,
	"birth_year" integer,
	"death_year" integer,
	"twin_group" text,
	"birth_order" integer,
	"photo_public_id" text,
	"photo_alt" text,
	"bio" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_path_unique" UNIQUE("path"),
	CONSTRAINT "gender_chk" CHECK ("persons"."gender" in ('M','F','U')),
	CONSTRAINT "gender_source_chk" CHECK ("persons"."gender_source" in ('stated','inferred'))
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"person_id" uuid,
	"message" text NOT NULL,
	"submitter_name" text,
	"submitter_contact" text,
	"status" text DEFAULT 'new' NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_a" uuid NOT NULL,
	"partner_b" uuid,
	"sequence" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parentage" ADD CONSTRAINT "parentage_child_id_persons_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parentage" ADD CONSTRAINT "parentage_union_id_unions_id_fk" FOREIGN KEY ("union_id") REFERENCES "public"."unions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parentage" ADD CONSTRAINT "parentage_parent_id_persons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_a_persons_id_fk" FOREIGN KEY ("partner_a") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unions" ADD CONSTRAINT "unions_partner_b_persons_id_fk" FOREIGN KEY ("partner_b") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;