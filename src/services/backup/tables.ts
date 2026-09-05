import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
    aiProfile,
    exercise,
    exerciseSet,
    measurement,
    user,
    workout,
    workoutExercise,
    workoutGroup,
} from '@/db/schema';
import { FITUP_EXERCISES_USER_ID } from '@/constants/fitup';

/**
 * The map between the device's tables and the account's.
 *
 * Everything the backup knows about the schema is in this file, so a column
 * added to `src/db/schema` has exactly one place to be accounted for — and
 * `tables.test.ts` fails until it has been, rather than letting the column go
 * quietly unbacked-up.
 *
 * Column names are listed rather than derived from camelCase. Derivation reads
 * as less work right up to the first column that does not follow the rule, and
 * three of them already do not: `order` is reserved in Postgres, so the
 * ordering columns become `position`.
 */

type LocalRow = Record<string, unknown>;

/**
 * How a row is traced back to the user who owns it.
 *
 * Needed only by the first upload, which has no change queue to read from and
 * so has to find the account's rows for itself. Sets and groups carry no
 * `user_id` of their own — they belong to whoever owns the workout above them.
 */
export type BackupScope =
    { kind: 'user'; column: string } | { kind: 'parent'; parent: string; column: string };

export interface BackupTableSpec {
    /** As it appears in `sync_queue.tableName`. */
    local: string;
    /** As it appears in Postgres. */
    remote: string;
    table: SQLiteTable;
    /** The local property holding the primary key. */
    idColumn: string;
    /**
     * What an upsert conflicts on. The two per-account singletons are keyed by
     * the account, everything else by the id the device generated.
     */
    conflictTarget: 'id' | 'account_id';
    scope: BackupScope;
    /** Local property → remote column. */
    columns: Readonly<Record<string, string>>;
    /** Local properties that drizzle hands back as `Date`. */
    dates: readonly string[];
    /**
     * Columns that stay on the device. Listed rather than omitted silently, so
     * the completeness test can tell a decision from an oversight.
     */
    deviceOnly: readonly string[];
    /** Rows that must not leave the device. */
    include?: (row: LocalRow) => boolean;
}

const TIMESTAMPS = ['createdAt', 'updatedAt'] as const;

/**
 * Ordered parent-first. Restore walks the array in order so a workout exists
 * before the sets that hang off it, and the local user row — whose id every
 * other `user_id` points at — is written before anything at all.
 */
export const BACKUP_TABLES: readonly BackupTableSpec[] = [
    {
        local: 'user',
        remote: 'profiles',
        scope: { kind: 'user', column: 'id' },
        table: user,
        idColumn: 'id',
        conflictTarget: 'account_id',
        columns: {
            id: 'local_user_id',
            displayName: 'display_name',
            birthday: 'birthday',
            biologicalSex: 'biological_sex',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: ['birthday', ...TIMESTAMPS],
        // The rest of `user` is this device describing itself — build number,
        // model, locale, theme, notification permissions, unit preferences.
        // Restoring it onto a different phone would be wrong, and restoring it
        // onto a fresh install would overwrite what that install just detected.
        deviceOnly: [
            'status',
            'isActive',
            'isDelayed',
            'isDelayedDate',
            'pushes',
            'nativeToken',
            'epsToken',
            'applicationId',
            'applicationName',
            'applicationVersion',
            'applicationBuildNumber',
            'deviceBrand',
            'device',
            'deviceType',
            'deviceModel',
            'deviceSystemName',
            'deviceSystemVersion',
            'lng',
            'alert',
            'badge',
            'lockScreen',
            'notificationCenter',
            'provisional',
            'sound',
            'carPlay',
            'criticalAlert',
            'providesAppSettings',
            'theme',
            'bodyWeightUnits',
            'measurementUnits',
            'weightUnits',
            'distanceUnits',
            'temperatureUnits',
            'screenAutoLock',
            'playSounds',
            'playHaptics',
            'soundsVolume',
            'firstWeekday',
            'timeFormat',
            'timeZone',
            'calendar',
            'textDirection',
            'currencyCode',
            'currencySymbol',
            'regionCode',
            'mhrFormula',
            'mhrManualValue',
            // Identity of the account this row is already linked to. It is
            // re-derived from the session on restore, never copied.
            'accountId',
            'accountEmail',
            'accountProvider',
            // Superseded by `ai_profile.activityLevel`, which is the one the
            // onboarding flow and the assistant both read.
            'activityLevel',
        ],
    },
    {
        local: 'ai_profile',
        remote: 'training_profiles',
        scope: { kind: 'user', column: 'userId' },
        table: aiProfile,
        idColumn: 'userId',
        conflictTarget: 'account_id',
        columns: {
            userId: 'local_user_id',
            goal: 'goal',
            activityLevel: 'activity_level',
            sessionsPerWeek: 'sessions_per_week',
            sessionMinutes: 'session_minutes',
            dietaryPattern: 'dietary_pattern',
            allergens: 'allergens',
            conditions: 'conditions',
            equipment: 'equipment',
            dailyCalorieTarget: 'daily_calorie_target',
            dailyProteinTargetG: 'daily_protein_target_g',
            dailyCarbsTargetG: 'daily_carbs_target_g',
            dailyFatTargetG: 'daily_fat_target_g',
            targetWeightKg: 'target_weight_kg',
            somatotype: 'somatotype',
            notes: 'notes',
            completedAt: 'completed_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: ['completedAt', ...TIMESTAMPS],
        deviceOnly: [],
    },
    {
        local: 'measurement',
        remote: 'measurements',
        scope: { kind: 'user', column: 'userId' },
        table: measurement,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            userId: 'user_id',
            metric: 'metric',
            value: 'value',
            unit: 'unit',
            recordedAt: 'recorded_at',
            source: 'source',
            sourcePlatform: 'source_platform',
            externalId: 'external_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: ['recordedAt', ...TIMESTAMPS],
        deviceOnly: [],
    },
    {
        local: 'exercise',
        remote: 'custom_exercises',
        scope: { kind: 'user', column: 'userId' },
        table: exercise,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            name: 'name',
            category: 'category',
            tracking: 'tracking',
            weightUnits: 'weight_units',
            weightAssisted: 'weight_assisted',
            weightDoubleInStats: 'weight_double_in_stats',
            distanceUnits: 'distance_units',
            distanceActivityType: 'distance_activity_type',
            distanceTrackAW: 'distance_track_aw',
            timeOptions: 'time_options',
            timeHalfwayAlert: 'time_halfway_alert',
            source: 'source',
            fitupSourceId: 'fitup_source_id',
            primaryMuscleGroups: 'primary_muscle_groups',
            secondaryMuscleGroups: 'secondary_muscle_groups',
            equipment: 'equipment',
            mistakes: 'mistakes',
            instructions: 'instructions',
            description: 'description',
            difficulty: 'difficulty',
            gifFilename: 'gif_filename',
            muscleLoad: 'muscle_load',
            confidence: 'confidence',
            userId: 'user_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: [...TIMESTAMPS],
        // `nameEn` only ever holds a catalogue name, and catalogue rows do not
        // leave the device at all (see `include` below). A user-authored
        // exercise has it null, so there would be nothing to carry either way.
        deviceOnly: ['nameEn'],
        // The catalogue is 1,324 rows that re-seed from Cloudflare D1 on any
        // install. Sending them would multiply every account's backup by a
        // thousand to restore data the app already fetches for itself.
        include: (row) => row.userId !== FITUP_EXERCISES_USER_ID,
    },
    {
        local: 'workout',
        remote: 'workouts',
        scope: { kind: 'user', column: 'userId' },
        table: workout,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            name: 'name',
            status: 'status',
            startAt: 'start_at',
            startedAt: 'started_at',
            completedAt: 'completed_at',
            duration: 'duration',
            remind: 'remind',
            userId: 'user_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: ['startAt', 'startedAt', 'completedAt', ...TIMESTAMPS],
        deviceOnly: [],
    },
    {
        local: 'workout_group',
        remote: 'workout_groups',
        scope: { kind: 'parent', parent: 'workout', column: 'workoutId' },
        table: workoutGroup,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            workoutId: 'workout_id',
            type: 'type',
            order: 'position',
            notes: 'notes',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: [...TIMESTAMPS],
        deviceOnly: [],
    },
    {
        local: 'workout_exercise',
        remote: 'workout_exercises',
        scope: { kind: 'parent', parent: 'workout', column: 'workoutId' },
        table: workoutExercise,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            workoutId: 'workout_id',
            exerciseId: 'exercise_id',
            groupId: 'group_id',
            orderInGroup: 'position',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: [...TIMESTAMPS],
        deviceOnly: [],
    },
    {
        local: 'exercise_set',
        remote: 'exercise_sets',
        scope: { kind: 'parent', parent: 'workout_exercise', column: 'workoutExerciseId' },
        table: exerciseSet,
        idColumn: 'id',
        conflictTarget: 'id',
        columns: {
            id: 'id',
            workoutExerciseId: 'workout_exercise_id',
            order: 'position',
            type: 'type',
            round: 'round',
            weight: 'weight',
            weightUnits: 'weight_units',
            reps: 'reps',
            time: 'time',
            distance: 'distance',
            distanceUnits: 'distance_units',
            rpe: 'rpe',
            restTime: 'rest_time',
            restCompletedAt: 'rest_completed_at',
            finalRestTime: 'final_rest_time',
            startedAt: 'started_at',
            completedAt: 'completed_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        dates: ['restCompletedAt', 'startedAt', 'completedAt', ...TIMESTAMPS],
        // Pause is the state of a session running on this phone right now, not
        // a property of the set. A restore lands on a device that is not in the
        // middle of that rest, so carrying it would only resume someone else's
        // stopwatch. Both read as "not paused" when absent.
        deviceOnly: ['pausedAt', 'pausedMs'],
    },
];

export const backupTableByLocalName = new Map(BACKUP_TABLES.map((spec) => [spec.local, spec]));

export const isBackedUpTable = (tableName: string): boolean =>
    backupTableByLocalName.has(tableName);

/**
 * A local row as Postgres wants it.
 *
 * Dates become Unix milliseconds rather than ISO strings: every `*_at` column
 * in the remote schema is `bigint`, so the value that comes back is the exact
 * number SQLite held and no timezone is involved in either direction.
 */
export const toRemoteRow = (
    spec: BackupTableSpec,
    row: LocalRow,
    accountId: string,
): Record<string, unknown> => {
    const remote: Record<string, unknown> = { account_id: accountId };

    for (const [local, column] of Object.entries(spec.columns)) {
        const value = row[local];
        remote[column] = value instanceof Date ? value.getTime() : (value ?? null);
    }

    return remote;
};

/** The inverse, ready to hand to drizzle. */
export const toLocalRow = (
    spec: BackupTableSpec,
    remote: Record<string, unknown>,
): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    const dates = new Set(spec.dates);

    for (const [local, column] of Object.entries(spec.columns)) {
        const value = remote[column];

        if (value === null || value === undefined) {
            row[local] = null;
            continue;
        }

        row[local] = dates.has(local) ? new Date(Number(value)) : value;
    }

    return row;
};
