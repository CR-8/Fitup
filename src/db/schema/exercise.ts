import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export type ExerciseSelect = typeof exercise.$inferSelect;
export type ExerciseInsert = typeof exercise.$inferInsert;

export type ExerciseSetSelect = typeof exerciseSet.$inferSelect;
export type ExerciseSetInsert = typeof exerciseSet.$inferInsert;

export type ExerciseMuscleLoadProfile = Record<string, unknown>[];

export const exercise = sqliteTable('exercise', {
    id: text('id', { length: 21 }).primaryKey(),
    name: text('name').notNull(),
    /**
     * The catalogue's English name, kept beside the localised one so search
     * still answers a Latin query after the library has been pulled in Hindi.
     * Null for user-authored exercises, which have only the name they were
     * given.
     */
    nameEn: text('name_en'),
    category: text('category', {
        enum: ['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other'],
    }).notNull(),
    tracking: text('tracking', { mode: 'json' })
        .$type<('weight' | 'reps' | 'time' | 'distance')[]>()
        .notNull(),
    weightUnits: text('weight_units', { enum: ['kg', 'lb'] }),
    weightAssisted: integer('weight_assisted', { mode: 'boolean' }),
    weightDoubleInStats: integer('weight_double_in_stats', { mode: 'boolean' }),
    distanceUnits: text('distance_units', { enum: ['km', 'mi'] }),
    distanceActivityType: text('distance_activity_type', {
        enum: [
            'outdoor_running',
            'indoor_running',
            'outdoor_walking',
            'indoor_walking',
            'stationary_bike',
            'bike',
            'elliptical',
            'cardio',
        ],
    }),
    distanceTrackAW: integer('distance_track_aw', { mode: 'boolean' }),
    timeOptions: text('time_options', { enum: ['log', 'timer', 'stopwatch'] }),
    timeHalfwayAlert: integer('time_halfway_alert', { mode: 'boolean' }),
    source: text('source', { enum: ['user', 'system'] })
        .notNull()
        .default('user'),
    fitupSourceId: text('fitup_source_id'),
    primaryMuscleGroups: text('primary_muscle_groups', { mode: 'json' }).$type<string[]>(),
    secondaryMuscleGroups: text('secondary_muscle_groups', { mode: 'json' }).$type<string[]>(),
    equipment: text('equipment', { mode: 'json' }).$type<string[]>(),
    mistakes: text('mistakes', { mode: 'json' }).$type<string[]>(),
    instructions: text('instructions', { mode: 'json' }).$type<string[]>(),
    description: text('description'),
    difficulty: text('difficulty'),
    gifFilename: text('gif_filename'),
    muscleLoad: text('muscle_load', { mode: 'json' }).$type<ExerciseMuscleLoadProfile>(),
    confidence: text('confidence', { enum: ['high', 'medium', 'low'] }),
    userId: text('user_id', { length: 21 }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});

export const exerciseSet = sqliteTable(
    'exercise_set',
    {
        id: text('id', { length: 21 }).primaryKey(),
        workoutExerciseId: text('workout_exercise_id', { length: 21 }).notNull(),
        order: integer('order').notNull(),
        type: text('type', {
            enum: ['warmup', 'working', 'dropset', 'failure'],
        })
            .notNull()
            .default('working'),
        round: integer('round'),
        weight: real('weight'),
        weightUnits: text('weight_units', { enum: ['kg', 'lb'] }),
        reps: integer('reps'),
        time: integer('time'),
        distance: real('distance'),
        distanceUnits: text('distance_units', { enum: ['km', 'mi'] }),
        rpe: integer('rpe'),
        restTime: integer('rest_time'),
        restCompletedAt: integer('rest_completed_at', { mode: 'timestamp_ms' }),
        finalRestTime: integer('final_rest_time'),
        startedAt: integer('started_at', { mode: 'timestamp_ms' }),
        completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
        /**
         * Durable pause for the set's current phase.
         *
         * Every timer in the app is derived from an absolute anchor
         * (`startedAt` for work, `completedAt` for rest) against the wall clock,
         * so a pause that only clears an interval or lives in React state comes
         * back to life the moment the app is backgrounded or the row is re-read.
         *
         * `pausedAt` is the instant the current pause began (null while
         * running); `pausedMs` is the time already banked. Elapsed becomes
         * `now - anchor - offset` and rest end `anchor + planned + offset`,
         * which freezes on its own while `pausedAt` is set because the offset
         * then grows at exactly the rate of the clock.
         *
         * A set has one work phase (ending at `completedAt`) and one rest phase
         * (starting there), never both at once, so `pausedMs` is scoped to
         * whichever is current and reset when the set completes.
         *
         * Device-local: excluded from backup and stripped before sync. A paused
         * session belongs to the phone running it.
         */
        pausedAt: integer('paused_at', { mode: 'timestamp_ms' }),
        pausedMs: integer('paused_ms').notNull().default(0),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('exercise_set_workout_exercise_completed_type_idx').on(
            table.workoutExerciseId,
            table.completedAt,
            table.type,
        ),
    ],
);
