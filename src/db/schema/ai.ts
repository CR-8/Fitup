import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { AiPlanPayload } from '@/types/ai';

export type AiConversationSelect = typeof aiConversation.$inferSelect;
export type AiConversationInsert = typeof aiConversation.$inferInsert;

export type AiMessageSelect = typeof aiMessage.$inferSelect;
export type AiMessageInsert = typeof aiMessage.$inferInsert;

export type AiPlanSelect = typeof aiPlan.$inferSelect;
export type AiPlanInsert = typeof aiPlan.$inferInsert;

export type AiProfileSelect = typeof aiProfile.$inferSelect;
export type AiProfileInsert = typeof aiProfile.$inferInsert;

export const aiConversation = sqliteTable(
    'ai_conversation',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        title: text('title'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('ai_conversation_user_updated_idx').on(table.userId, table.updatedAt)],
);

export const aiMessage = sqliteTable(
    'ai_message',
    {
        id: text('id', { length: 21 }).primaryKey(),
        conversationId: text('conversation_id', { length: 21 }).notNull(),
        role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
        content: text('content').notNull(),
        // Set when the assistant turn produced a plan, so the message list can render
        // the plan card inline rather than duplicating the payload.
        planId: text('plan_id', { length: 21 }),
        // Populated on failure so a turn can be retried or explained without guessing.
        errorCode: text('error_code'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('ai_message_conversation_created_idx').on(table.conversationId, table.createdAt),
    ],
);

export const aiPlan = sqliteTable(
    'ai_plan',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        conversationId: text('conversation_id', { length: 21 }),
        kind: text('kind', { enum: ['workout', 'nutrition', 'combined'] }).notNull(),
        status: text('status', { enum: ['draft', 'applied', 'discarded'] })
            .notNull()
            .default('draft'),
        intent: text('intent'),
        payload: text('payload', { mode: 'json' }).$type<AiPlanPayload>().notNull(),
        modelId: text('model_id'),
        // Workouts created by applying this plan, so the action can be undone.
        appliedWorkoutIds: text('applied_workout_ids', { mode: 'json' }).$type<string[]>(),
        appliedAt: integer('applied_at', { mode: 'timestamp_ms' }),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('ai_plan_user_created_idx').on(table.userId, table.createdAt),
        index('ai_plan_conversation_idx').on(table.conversationId),
    ],
);

/**
 * The subset of profile data the assistant needs. Height and weight deliberately live
 * in `measurement` rather than here, so charts, health import, and history stay
 * correct and unduplicated.
 */
export const aiProfile = sqliteTable('ai_profile', {
    userId: text('user_id', { length: 21 }).primaryKey(),
    goal: text('goal', { enum: ['lose', 'maintain', 'gain', 'recomp'] }),
    activityLevel: text('activity_level', {
        enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    }),
    sessionsPerWeek: integer('sessions_per_week'),
    sessionMinutes: integer('session_minutes'),
    dietaryPattern: text('dietary_pattern', {
        enum: ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher'],
    }),
    allergens: text('allergens', { mode: 'json' }).$type<string[]>(),
    conditions: text('conditions', { mode: 'json' }).$type<string[]>(),
    equipment: text('equipment', { mode: 'json' }).$type<string[]>(),
    dailyCalorieTarget: integer('daily_calorie_target'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});
