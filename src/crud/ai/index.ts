import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import {
    aiConversation,
    type AiConversationSelect,
    aiMessage,
    type AiMessageInsert,
    type AiMessageSelect,
    aiPlan,
    type AiPlanSelect,
    aiProfile,
    type AiProfileSelect,
    exercise,
    measurement,
    workout,
    workoutExercise,
} from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import {
    AI_CONTEXT_MESSAGE_LIMIT,
    AI_EXERCISE_CANDIDATE_LIMIT,
    AI_HISTORY_WORKOUT_LIMIT,
    type AiMessageRole,
    type AiPlanKind,
} from '@/constants/ai';
import type {
    AiExerciseCandidate,
    AiHistoryEntry,
    AiPlanPayload,
    AiProfileContext,
    AiRequestContext,
} from '@/types/ai';

import { queueSyncOperations } from '../sync';

const now = () => new Date();

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export const getConversations = async (userId: string): Promise<AiConversationSelect[]> =>
    await db
        .select()
        .from(aiConversation)
        .where(eq(aiConversation.userId, userId))
        .orderBy(desc(aiConversation.updatedAt));

export const getLatestConversation = async (
    userId: string,
): Promise<AiConversationSelect | null> => {
    const [row] = await db
        .select()
        .from(aiConversation)
        .where(eq(aiConversation.userId, userId))
        .orderBy(desc(aiConversation.updatedAt))
        .limit(1);

    return row ?? null;
};

export const createConversation = async (
    userId: string,
    title?: string | null,
): Promise<AiConversationSelect> => {
    const row = {
        id: nanoid(),
        userId,
        title: title ?? null,
        createdAt: now(),
        updatedAt: now(),
    };

    await db.insert(aiConversation).values(row);

    await queueSyncOperations([
        {
            tableName: 'ai_conversation',
            recordId: row.id,
            operation: 'create',
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);

    return row as AiConversationSelect;
};

export const touchConversation = async (id: string, title?: string | null): Promise<void> => {
    const updates: Partial<AiConversationSelect> = { updatedAt: now() };
    if (title) updates.title = title;

    await db.update(aiConversation).set(updates).where(eq(aiConversation.id, id));
};

export const deleteConversation = async (id: string): Promise<void> => {
    await db.delete(aiMessage).where(eq(aiMessage.conversationId, id));
    await db.delete(aiPlan).where(eq(aiPlan.conversationId, id));
    await db.delete(aiConversation).where(eq(aiConversation.id, id));

    await queueSyncOperations([
        {
            tableName: 'ai_conversation',
            recordId: id,
            operation: 'delete',
            data: null,
            timestamp: now(),
        },
    ]);
};

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

export const getMessages = async (conversationId: string): Promise<AiMessageSelect[]> =>
    await db
        .select()
        .from(aiMessage)
        .where(eq(aiMessage.conversationId, conversationId))
        .orderBy(aiMessage.createdAt);

export interface CreateMessageInput {
    conversationId: string;
    role: AiMessageRole;
    content: string;
    planId?: string | null;
    errorCode?: string | null;
}

export const createMessage = async (input: CreateMessageInput): Promise<AiMessageSelect> => {
    const row: AiMessageInsert = {
        id: nanoid(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        planId: input.planId ?? null,
        errorCode: input.errorCode ?? null,
        createdAt: now(),
        updatedAt: now(),
    };

    await db.insert(aiMessage).values(row);
    await touchConversation(input.conversationId);

    await queueSyncOperations([
        {
            tableName: 'ai_message',
            recordId: row.id!,
            operation: 'create',
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);

    return row as AiMessageSelect;
};

/* -------------------------------------------------------------------------- */
/* Plans                                                                      */
/* -------------------------------------------------------------------------- */

export const getPlanById = async (id: string): Promise<AiPlanSelect | null> => {
    const [row] = await db.select().from(aiPlan).where(eq(aiPlan.id, id)).limit(1);
    return row ?? null;
};

export const getPlansByIds = async (ids: string[]): Promise<AiPlanSelect[]> => {
    if (ids.length === 0) return [];
    return await db.select().from(aiPlan).where(inArray(aiPlan.id, ids));
};

/**
 * The plan the user is currently training on, or null.
 *
 * "Current" is the most recently applied one, not the most recently created: a
 * draft nobody accepted is a suggestion, and two applied plans mean the later
 * one replaced the earlier. `appliedAt` rather than `createdAt` orders them,
 * because a plan generated on Monday and applied on Friday is newer than one
 * generated on Tuesday and applied on Wednesday.
 *
 * `ai_plan_user_created_idx` covers the user filter; the ordering is over at
 * most a handful of rows per user, so it needs no index of its own.
 */
export const getActivePlan = async (userId: string): Promise<AiPlanSelect | null> => {
    const [row] = await db
        .select()
        .from(aiPlan)
        .where(and(eq(aiPlan.userId, userId), eq(aiPlan.status, 'applied')))
        .orderBy(desc(aiPlan.appliedAt))
        .limit(1);

    return row ?? null;
};

export interface CreatePlanInput {
    userId: string;
    conversationId?: string | null;
    kind: AiPlanKind;
    intent?: string | null;
    payload: AiPlanPayload;
    modelId?: string | null;
}

export const createPlan = async (input: CreatePlanInput): Promise<AiPlanSelect> => {
    const row = {
        id: nanoid(),
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        kind: input.kind,
        status: 'draft' as const,
        intent: input.intent ?? null,
        payload: input.payload,
        modelId: input.modelId ?? null,
        appliedWorkoutIds: null,
        appliedAt: null,
        createdAt: now(),
        updatedAt: now(),
    };

    await db.insert(aiPlan).values(row);

    await queueSyncOperations([
        {
            tableName: 'ai_plan',
            recordId: row.id,
            operation: 'create',
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);

    return row as AiPlanSelect;
};

export const markPlanApplied = async (id: string, workoutIds: string[]): Promise<void> => {
    const updates = {
        status: 'applied' as const,
        appliedWorkoutIds: workoutIds,
        appliedAt: now(),
        updatedAt: now(),
    };

    await db.update(aiPlan).set(updates).where(eq(aiPlan.id, id));

    await queueSyncOperations([
        {
            tableName: 'ai_plan',
            recordId: id,
            operation: 'update',
            data: updates as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);
};

export const markPlanDiscarded = async (id: string): Promise<void> => {
    const updates = {
        status: 'discarded' as const,
        appliedWorkoutIds: null,
        appliedAt: null,
        updatedAt: now(),
    };

    await db.update(aiPlan).set(updates).where(eq(aiPlan.id, id));

    await queueSyncOperations([
        {
            tableName: 'ai_plan',
            recordId: id,
            operation: 'update',
            data: updates as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);
};

/**
 * Successful generations in the current calendar month. Used for the local quota
 * indicator only — a client-side count is an advisory display, not a control. Real
 * enforcement belongs on the server that holds the provider credential.
 */
export const countPlansThisMonth = async (userId: string): Promise<number> => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const rows = await db
        .select({ id: aiPlan.id })
        .from(aiPlan)
        .where(and(eq(aiPlan.userId, userId), gte(aiPlan.createdAt, start)));

    return rows.length;
};

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export const getProfile = async (userId: string): Promise<AiProfileSelect | null> => {
    const [row] = await db.select().from(aiProfile).where(eq(aiProfile.userId, userId)).limit(1);
    return row ?? null;
};

export const upsertProfile = async (
    userId: string,
    updates: Partial<Omit<AiProfileSelect, 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<AiProfileSelect> => {
    const existing = await getProfile(userId);

    if (existing) {
        const next = { ...updates, updatedAt: now() };
        await db.update(aiProfile).set(next).where(eq(aiProfile.userId, userId));

        await queueSyncOperations([
            {
                tableName: 'ai_profile',
                recordId: userId,
                operation: 'update',
                data: next as unknown as Record<string, unknown>,
                timestamp: now(),
            },
        ]);

        return { ...existing, ...next } as AiProfileSelect;
    }

    const row = {
        userId,
        goal: null,
        activityLevel: null,
        sessionsPerWeek: null,
        sessionMinutes: null,
        dietaryPattern: null,
        allergens: null,
        conditions: null,
        equipment: null,
        dailyCalorieTarget: null,
        notes: null,
        ...updates,
        createdAt: now(),
        updatedAt: now(),
    };

    await db.insert(aiProfile).values(row);

    await queueSyncOperations([
        {
            tableName: 'ai_profile',
            recordId: userId,
            operation: 'create',
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);

    return row as AiProfileSelect;
};

/* -------------------------------------------------------------------------- */
/* Context assembly                                                           */
/* -------------------------------------------------------------------------- */

const getLatestMeasurement = async (userId: string, metric: string): Promise<number | null> => {
    const [row] = await db
        .select({ value: measurement.value })
        .from(measurement)
        .where(and(eq(measurement.userId, userId), eq(measurement.metric, metric)))
        .orderBy(desc(measurement.recordedAt))
        .limit(1);

    return row?.value ?? null;
};

const buildProfileContext = async (userId: string): Promise<AiProfileContext> => {
    const [profile, bodyWeightKg, heightCm] = await Promise.all([
        getProfile(userId),
        getLatestMeasurement(userId, 'body_weight'),
        getLatestMeasurement(userId, 'height'),
    ]);

    return {
        goal: profile?.goal ?? null,
        activityLevel: profile?.activityLevel ?? null,
        sessionsPerWeek: profile?.sessionsPerWeek ?? null,
        sessionMinutes: profile?.sessionMinutes ?? null,
        dietaryPattern: profile?.dietaryPattern ?? null,
        allergens: profile?.allergens ?? [],
        conditions: profile?.conditions ?? [],
        equipment: profile?.equipment ?? [],
        dailyCalorieTarget: profile?.dailyCalorieTarget ?? null,
        bodyWeightKg,
        heightCm,
        notes: profile?.notes ?? null,
    };
};

/**
 * Candidate exercises offered to the model.
 *
 * Equipment the user has not declared is filtered out here, before the request is
 * built, rather than being described as a rule in the prompt. A model cannot select
 * what it was never shown, which makes this the load-bearing constraint rather than
 * the prompt wording.
 */
const buildCandidates = async (
    userId: string,
    availableEquipment: string[],
): Promise<AiExerciseCandidate[]> => {
    const rows = await db
        .select({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
            equipment: exercise.equipment,
            primaryMuscleGroups: exercise.primaryMuscleGroups,
            tracking: exercise.tracking,
        })
        .from(exercise)
        .limit(500);

    const allowed = new Set(availableEquipment.map((entry) => entry.toLowerCase()));

    const isUsable = (row: (typeof rows)[number]): boolean => {
        const required = row.equipment ?? [];
        // No declared equipment means no filtering — an empty profile should still
        // produce a usable plan rather than an empty candidate set.
        if (allowed.size === 0) return true;
        if (required.length === 0) return true;
        return required.every((item) => allowed.has(item.toLowerCase()));
    };

    return rows
        .filter(isUsable)
        .slice(0, AI_EXERCISE_CANDIDATE_LIMIT)
        .map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            equipment: row.equipment ?? [],
            primaryMuscleGroups: row.primaryMuscleGroups ?? [],
            tracking: row.tracking ?? [],
        }));
};

const buildHistory = async (userId: string): Promise<AiHistoryEntry[]> => {
    const workouts = await db
        .select({
            id: workout.id,
            name: workout.name,
            completedAt: workout.completedAt,
            difficulty: workout.difficulty,
        })
        .from(workout)
        .where(and(eq(workout.userId, userId), isNotNull(workout.completedAt)))
        .orderBy(desc(workout.completedAt))
        .limit(AI_HISTORY_WORKOUT_LIMIT);

    if (workouts.length === 0) return [];

    const links = await db
        .select({ workoutId: workoutExercise.workoutId, name: exercise.name })
        .from(workoutExercise)
        .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
        .where(
            inArray(
                workoutExercise.workoutId,
                workouts.map((entry) => entry.id),
            ),
        );

    const byWorkout = links.reduce<Record<string, string[]>>((acc, link) => {
        (acc[link.workoutId] ??= []).push(link.name);
        return acc;
    }, {});

    return workouts.map((entry) => ({
        name: entry.name,
        completedAt: entry.completedAt!.getTime(),
        exerciseNames: byWorkout[entry.id] ?? [],
        difficulty: entry.difficulty ?? null,
    }));
};

export const buildRequestContext = async (
    userId: string,
    locale: string,
    weightUnit: string,
): Promise<AiRequestContext> => {
    const profile = await buildProfileContext(userId);

    const [candidates, history] = await Promise.all([
        buildCandidates(userId, profile.equipment),
        buildHistory(userId),
    ]);

    return { profile, candidates, history, locale, weightUnit };
};

export const buildChatHistory = (messages: AiMessageSelect[]) =>
    messages
        .filter((message) => message.role !== 'system' && !message.errorCode)
        .slice(-AI_CONTEXT_MESSAGE_LIMIT)
        .map((message) => ({
            role: message.role as 'user' | 'assistant',
            content: message.content,
        }));
