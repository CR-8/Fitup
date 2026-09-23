import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_exercises_category" AS ENUM('strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other');
  CREATE TYPE "public"."enum_exercises_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__exercises_v_version_category" AS ENUM('strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other');
  CREATE TYPE "public"."enum__exercises_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_foods_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__foods_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "exercises" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"catalogue_id" varchar,
  	"name" varchar,
  	"category" "enum_exercises_category",
  	"gif_filename" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_exercises_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "exercises_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_exercises_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_catalogue_id" varchar,
  	"version_name" varchar,
  	"version_category" "enum__exercises_v_version_category",
  	"version_gif_filename" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__exercises_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_exercises_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "foods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"catalogue_id" varchar,
  	"name" varchar,
  	"category" varchar DEFAULT 'other',
  	"serving_size" varchar,
  	"calories" numeric DEFAULT 0,
  	"protein_g" numeric DEFAULT 0,
  	"carbs_g" numeric DEFAULT 0,
  	"fat_g" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_foods_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_foods_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_catalogue_id" varchar,
  	"version_name" varchar,
  	"version_category" varchar DEFAULT 'other',
  	"version_serving_size" varchar,
  	"version_calories" numeric DEFAULT 0,
  	"version_protein_g" numeric DEFAULT 0,
  	"version_carbs_g" numeric DEFAULT 0,
  	"version_fat_g" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__foods_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"exercises_id" integer,
  	"foods_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exercises_texts" ADD CONSTRAINT "exercises_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_exercises_v" ADD CONSTRAINT "_exercises_v_parent_id_exercises_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_exercises_v_texts" ADD CONSTRAINT "_exercises_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_exercises_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_foods_v" ADD CONSTRAINT "_foods_v_parent_id_foods_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exercises_fk" FOREIGN KEY ("exercises_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_foods_fk" FOREIGN KEY ("foods_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "exercises_catalogue_id_idx" ON "exercises" USING btree ("catalogue_id");
  CREATE INDEX "exercises_updated_at_idx" ON "exercises" USING btree ("updated_at");
  CREATE INDEX "exercises_created_at_idx" ON "exercises" USING btree ("created_at");
  CREATE INDEX "exercises__status_idx" ON "exercises" USING btree ("_status");
  CREATE INDEX "exercises_texts_order_parent" ON "exercises_texts" USING btree ("order","parent_id");
  CREATE INDEX "_exercises_v_parent_idx" ON "_exercises_v" USING btree ("parent_id");
  CREATE INDEX "_exercises_v_version_version_catalogue_id_idx" ON "_exercises_v" USING btree ("version_catalogue_id");
  CREATE INDEX "_exercises_v_version_version_updated_at_idx" ON "_exercises_v" USING btree ("version_updated_at");
  CREATE INDEX "_exercises_v_version_version_created_at_idx" ON "_exercises_v" USING btree ("version_created_at");
  CREATE INDEX "_exercises_v_version_version__status_idx" ON "_exercises_v" USING btree ("version__status");
  CREATE INDEX "_exercises_v_created_at_idx" ON "_exercises_v" USING btree ("created_at");
  CREATE INDEX "_exercises_v_updated_at_idx" ON "_exercises_v" USING btree ("updated_at");
  CREATE INDEX "_exercises_v_latest_idx" ON "_exercises_v" USING btree ("latest");
  CREATE INDEX "_exercises_v_texts_order_parent" ON "_exercises_v_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "foods_catalogue_id_idx" ON "foods" USING btree ("catalogue_id");
  CREATE INDEX "foods_updated_at_idx" ON "foods" USING btree ("updated_at");
  CREATE INDEX "foods_created_at_idx" ON "foods" USING btree ("created_at");
  CREATE INDEX "foods__status_idx" ON "foods" USING btree ("_status");
  CREATE INDEX "_foods_v_parent_idx" ON "_foods_v" USING btree ("parent_id");
  CREATE INDEX "_foods_v_version_version_catalogue_id_idx" ON "_foods_v" USING btree ("version_catalogue_id");
  CREATE INDEX "_foods_v_version_version_updated_at_idx" ON "_foods_v" USING btree ("version_updated_at");
  CREATE INDEX "_foods_v_version_version_created_at_idx" ON "_foods_v" USING btree ("version_created_at");
  CREATE INDEX "_foods_v_version_version__status_idx" ON "_foods_v" USING btree ("version__status");
  CREATE INDEX "_foods_v_created_at_idx" ON "_foods_v" USING btree ("created_at");
  CREATE INDEX "_foods_v_updated_at_idx" ON "_foods_v" USING btree ("updated_at");
  CREATE INDEX "_foods_v_latest_idx" ON "_foods_v" USING btree ("latest");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_exercises_id_idx" ON "payload_locked_documents_rels" USING btree ("exercises_id");
  CREATE INDEX "payload_locked_documents_rels_foods_id_idx" ON "payload_locked_documents_rels" USING btree ("foods_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "exercises" CASCADE;
  DROP TABLE "exercises_texts" CASCADE;
  DROP TABLE "_exercises_v" CASCADE;
  DROP TABLE "_exercises_v_texts" CASCADE;
  DROP TABLE "foods" CASCADE;
  DROP TABLE "_foods_v" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_exercises_category";
  DROP TYPE "public"."enum_exercises_status";
  DROP TYPE "public"."enum__exercises_v_version_category";
  DROP TYPE "public"."enum__exercises_v_version_status";
  DROP TYPE "public"."enum_foods_status";
  DROP TYPE "public"."enum__foods_v_version_status";`)
}
