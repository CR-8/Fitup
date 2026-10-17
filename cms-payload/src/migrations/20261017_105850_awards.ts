import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Mirrors BUILT_IN_AWARDS in the app (src/services/award-catalogue.ts) and its English and Hindi words. */
const BUILT_IN_AWARDS = [
  {
    "awardId": "calorieGoal",
    "active": true,
    "nameEn": "Calorie Goal",
    "descriptionEn": "Earn this every day you eat to your calorie goal. Your goal is {{target}} kcal and you've had {{value}} kcal so far today.",
    "nameHi": "कैलोरी लक्ष्य",
    "descriptionHi": "हर उस दिन मिलता है जब आप अपना कैलोरी लक्ष्य पूरा करते हैं। आपका लक्ष्य {{target}} kcal है और आज अब तक {{value}} kcal हुई।",
    "metric": "calories_today",
    "repeat": "daily",
    "group": "daily",
    "shape": "circle",
    "symbol": "flame",
    "color": "#5AB0FF",
    "sortOrder": 10
  },
  {
    "awardId": "calorieGoals100",
    "active": true,
    "nameEn": "100 Calorie Goals",
    "descriptionEn": "Meet your calorie goal on 100 days. You've met it on {{value}} days in the past year.",
    "nameHi": "100 कैलोरी लक्ष्य",
    "descriptionHi": "100 दिन अपना कैलोरी लक्ष्य पूरा करें। पिछले साल में {{value}} दिन पूरा हुआ।",
    "metric": "calorie_goal_days",
    "target": 100,
    "repeat": "once",
    "group": "daily",
    "shape": "circle",
    "symbol": "target",
    "color": "#5AB0FF",
    "sortOrder": 20
  },
  {
    "awardId": "waterGoal",
    "active": true,
    "nameEn": "Water Goal",
    "descriptionEn": "Earn this every day you drink your water goal. Your goal is {{target}} ml and you've had {{value}} ml so far today.",
    "nameHi": "पानी का लक्ष्य",
    "descriptionHi": "हर उस दिन मिलता है जब आप अपना पानी का लक्ष्य पूरा करते हैं। आपका लक्ष्य {{target}} ml है और आज अब तक {{value}} ml हुआ।",
    "metric": "water_today",
    "repeat": "daily",
    "group": "daily",
    "shape": "circle",
    "symbol": "drop",
    "color": "#FF6F91",
    "sortOrder": 30
  },
  {
    "awardId": "waterGoals30",
    "active": true,
    "nameEn": "30 Water Goals",
    "descriptionEn": "Meet your water goal on 30 days. You've met it on {{value}} days in the past year.",
    "nameHi": "30 पानी लक्ष्य",
    "descriptionHi": "30 दिन अपना पानी का लक्ष्य पूरा करें। पिछले साल में {{value}} दिन पूरा हुआ।",
    "metric": "water_goal_days",
    "target": 30,
    "repeat": "once",
    "group": "daily",
    "shape": "circle",
    "symbol": "target",
    "color": "#FF6F91",
    "sortOrder": 40
  },
  {
    "awardId": "workouts1",
    "active": true,
    "nameEn": "First Workout",
    "descriptionEn": "Finish your first session.",
    "nameHi": "पहला वर्कआउट",
    "descriptionHi": "अपना पहला सेशन पूरा करें।",
    "metric": "workouts_total",
    "target": 1,
    "repeat": "once",
    "group": "workouts",
    "shape": "square",
    "symbol": "dumbbell",
    "color": "#D6F25A",
    "sortOrder": 50
  },
  {
    "awardId": "workouts10",
    "active": true,
    "nameEn": "10 Workouts",
    "descriptionEn": "Finish 10 sessions. You've finished {{value}} so far.",
    "nameHi": "10 वर्कआउट",
    "descriptionHi": "10 सेशन पूरे करें। अब तक {{value}} पूरे हुए।",
    "metric": "workouts_total",
    "target": 10,
    "repeat": "once",
    "group": "workouts",
    "shape": "square",
    "symbol": "trophy",
    "color": "#D6F25A",
    "sortOrder": 60
  },
  {
    "awardId": "workouts50",
    "active": true,
    "nameEn": "50 Workouts",
    "descriptionEn": "Finish 50 sessions. You've finished {{value}} so far.",
    "nameHi": "50 वर्कआउट",
    "descriptionHi": "50 सेशन पूरे करें। अब तक {{value}} पूरे हुए।",
    "metric": "workouts_total",
    "target": 50,
    "repeat": "once",
    "group": "workouts",
    "shape": "square",
    "symbol": "trophy",
    "color": "#D6F25A",
    "sortOrder": 70
  },
  {
    "awardId": "workouts100",
    "active": true,
    "nameEn": "100 Workouts",
    "descriptionEn": "Finish 100 sessions. You've finished {{value}} so far.",
    "nameHi": "100 वर्कआउट",
    "descriptionHi": "100 सेशन पूरे करें। अब तक {{value}} पूरे हुए।",
    "metric": "workouts_total",
    "target": 100,
    "repeat": "once",
    "group": "workouts",
    "shape": "square",
    "symbol": "trophy",
    "color": "#D6F25A",
    "sortOrder": 80
  },
  {
    "awardId": "perfectWeek",
    "active": true,
    "nameEn": "Perfect Week",
    "descriptionEn": "Meet your weekly target of {{target}} sessions. You've done {{value}} this week.",
    "nameHi": "परफ़ेक्ट हफ़्ता",
    "descriptionHi": "हफ़्ते का {{target}} सेशन का लक्ष्य पूरा करें। इस हफ़्ते {{value}} हुए।",
    "metric": "workouts_week",
    "repeat": "weekly",
    "group": "workouts",
    "shape": "diamond",
    "symbol": "calendar",
    "color": "#FF9F0A",
    "sortOrder": 90
  },
  {
    "awardId": "sevenWorkoutWeek",
    "active": true,
    "nameEn": "7-Workout Week",
    "descriptionEn": "Finish 7 sessions in one week. You've done {{value}} this week.",
    "nameHi": "7 वर्कआउट हफ़्ता",
    "descriptionHi": "एक हफ़्ते में 7 सेशन पूरे करें। इस हफ़्ते {{value}} हुए।",
    "metric": "workouts_week",
    "target": 7,
    "repeat": "weekly",
    "group": "workouts",
    "shape": "diamond",
    "symbol": "bolt",
    "color": "#FF9F0A",
    "sortOrder": 100
  },
  {
    "awardId": "streak7",
    "active": true,
    "nameEn": "7-Day Streak",
    "descriptionEn": "Train 7 days in a row. Your current streak is {{value}} days.",
    "nameHi": "7 दिन की लय",
    "descriptionHi": "लगातार 7 दिन ट्रेन करें। आपकी मौजूदा लय {{value}} दिन की है।",
    "metric": "streak_days",
    "target": 7,
    "repeat": "once",
    "group": "workouts",
    "shape": "diamond",
    "symbol": "flame",
    "color": "#FF9F0A",
    "sortOrder": 110
  }
] as const

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_awards_metric" AS ENUM('calories_today', 'calorie_goal_days', 'water_today', 'water_goal_days', 'workouts_total', 'workouts_week', 'streak_days');
  CREATE TYPE "public"."enum_awards_repeat" AS ENUM('once', 'daily', 'weekly');
  CREATE TYPE "public"."enum_awards_group" AS ENUM('daily', 'workouts');
  CREATE TYPE "public"."enum_awards_shape" AS ENUM('circle', 'square', 'diamond');
  CREATE TYPE "public"."enum_awards_symbol" AS ENUM('flame', 'target', 'drop', 'dumbbell', 'trophy', 'calendar', 'bolt');
  CREATE TYPE "public"."enum_awards_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__awards_v_version_metric" AS ENUM('calories_today', 'calorie_goal_days', 'water_today', 'water_goal_days', 'workouts_total', 'workouts_week', 'streak_days');
  CREATE TYPE "public"."enum__awards_v_version_repeat" AS ENUM('once', 'daily', 'weekly');
  CREATE TYPE "public"."enum__awards_v_version_group" AS ENUM('daily', 'workouts');
  CREATE TYPE "public"."enum__awards_v_version_shape" AS ENUM('circle', 'square', 'diamond');
  CREATE TYPE "public"."enum__awards_v_version_symbol" AS ENUM('flame', 'target', 'drop', 'dumbbell', 'trophy', 'calendar', 'bolt');
  CREATE TYPE "public"."enum__awards_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "awards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"award_id" varchar,
  	"active" boolean DEFAULT true,
  	"name_en" varchar,
  	"description_en" varchar,
  	"name_hi" varchar,
  	"description_hi" varchar,
  	"metric" "enum_awards_metric" DEFAULT 'workouts_total',
  	"target" numeric,
  	"repeat" "enum_awards_repeat" DEFAULT 'once',
  	"group" "enum_awards_group" DEFAULT 'workouts',
  	"shape" "enum_awards_shape" DEFAULT 'circle',
  	"symbol" "enum_awards_symbol" DEFAULT 'trophy',
  	"color" varchar DEFAULT '#D6F25A',
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_awards_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_awards_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_award_id" varchar,
  	"version_active" boolean DEFAULT true,
  	"version_name_en" varchar,
  	"version_description_en" varchar,
  	"version_name_hi" varchar,
  	"version_description_hi" varchar,
  	"version_metric" "enum__awards_v_version_metric" DEFAULT 'workouts_total',
  	"version_target" numeric,
  	"version_repeat" "enum__awards_v_version_repeat" DEFAULT 'once',
  	"version_group" "enum__awards_v_version_group" DEFAULT 'workouts',
  	"version_shape" "enum__awards_v_version_shape" DEFAULT 'circle',
  	"version_symbol" "enum__awards_v_version_symbol" DEFAULT 'trophy',
  	"version_color" varchar DEFAULT '#D6F25A',
  	"version_sort_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__awards_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "awards_id" integer;
  ALTER TABLE "_awards_v" ADD CONSTRAINT "_awards_v_parent_id_awards_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."awards"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "awards_award_id_idx" ON "awards" USING btree ("award_id");
  CREATE INDEX "awards_updated_at_idx" ON "awards" USING btree ("updated_at");
  CREATE INDEX "awards_created_at_idx" ON "awards" USING btree ("created_at");
  CREATE INDEX "awards__status_idx" ON "awards" USING btree ("_status");
  CREATE INDEX "_awards_v_parent_idx" ON "_awards_v" USING btree ("parent_id");
  CREATE INDEX "_awards_v_version_version_award_id_idx" ON "_awards_v" USING btree ("version_award_id");
  CREATE INDEX "_awards_v_version_version_updated_at_idx" ON "_awards_v" USING btree ("version_updated_at");
  CREATE INDEX "_awards_v_version_version_created_at_idx" ON "_awards_v" USING btree ("version_created_at");
  CREATE INDEX "_awards_v_version_version__status_idx" ON "_awards_v" USING btree ("version__status");
  CREATE INDEX "_awards_v_created_at_idx" ON "_awards_v" USING btree ("created_at");
  CREATE INDEX "_awards_v_updated_at_idx" ON "_awards_v" USING btree ("updated_at");
  CREATE INDEX "_awards_v_latest_idx" ON "_awards_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_awards_fk" FOREIGN KEY ("awards_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_awards_id_idx" ON "payload_locked_documents_rels" USING btree ("awards_id");`)

  // The awards the app ships with, so editors start from what people already see.
  // Not synced: the app has these built in, and publishing an edit syncs it.
  for (const data of BUILT_IN_AWARDS) {
    await payload.create({ collection: 'awards', data: { ...data, _status: 'published' }, context: { skipSync: true }, req })
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_awards_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "awards" CASCADE;
  DROP TABLE "_awards_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_awards_fk";
  
  DROP INDEX "payload_locked_documents_rels_awards_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "awards_id";
  DROP TYPE "public"."enum_awards_metric";
  DROP TYPE "public"."enum_awards_repeat";
  DROP TYPE "public"."enum_awards_group";
  DROP TYPE "public"."enum_awards_shape";
  DROP TYPE "public"."enum_awards_symbol";
  DROP TYPE "public"."enum_awards_status";
  DROP TYPE "public"."enum__awards_v_version_metric";
  DROP TYPE "public"."enum__awards_v_version_repeat";
  DROP TYPE "public"."enum__awards_v_version_group";
  DROP TYPE "public"."enum__awards_v_version_shape";
  DROP TYPE "public"."enum__awards_v_version_symbol";
  DROP TYPE "public"."enum__awards_v_version_status";`)
}
