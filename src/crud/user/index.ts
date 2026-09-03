import { and, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { aiProfile, measurement, user, UserInsert, UserSelect, workout } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { getActiveUserId, setActiveUserId } from '@/services/active-user';
import type { AccountIdentity } from '@/services/account';
import { queueSyncOperation } from '../sync';

/**
 * The local user row this device is acting as.
 *
 * This used to be `select … limit 1` — the first row in the table, whoever was
 * signed in. That is correct for exactly one account per device and silently
 * wrong for two: the second account inherited the first one's name, weight,
 * history and workouts.
 *
 * The active pointer is set by `resolveLocalUserForAccount` when a session
 * resolves. The unlinked-row fallback covers the two cases where there is no
 * account to resolve from: a build shipped without accounts, and the window on
 * a first launch before anyone has signed in.
 */
export const getCurrentUser = async (): Promise<UserSelect | null> => {
    const activeId = getActiveUserId();

    if (activeId) {
        const active = await db.select().from(user).where(eq(user.id, activeId)).limit(1);
        if (active.length > 0) return active[0];
    }

    const unlinked = await db.select().from(user).where(isNull(user.accountId)).limit(1);
    if (unlinked.length > 0) return unlinked[0];

    /**
     * An install that signed in before the pointer existed.
     *
     * Its one row is linked to an account, so the query above finds nothing, and
     * without this the caller would conclude the device has no user and create a
     * second one beside it — on every upgrade, for every existing install. One
     * row is the whole of the pre-account world by definition, so it is adopted
     * rather than abandoned.
     */
    const only = await db.select().from(user).limit(2);

    if (only.length === 1) {
        setActiveUserId(only[0].id);
        return only[0];
    }

    return null;
};

/**
 * Removes local users that belong to no account and hold nothing.
 *
 * The upgrade path above could leave one behind before it existed: a row created
 * because the pointer was missing, never linked, never written to. It is
 * unreachable — `getCurrentUser` prefers the pointer — but it is also the row the
 * unlinked fallback would hand to the next account that signs in, which would
 * then adopt an empty stranger instead of getting a clean profile.
 *
 * Emptiness is tested, not assumed. A row with any training against it is left
 * alone and reported, because deleting it would be silent data loss.
 */
const pruneEmptyUnlinkedUsers = async (activeUserId: string): Promise<void> => {
    const candidates = await db
        .select()
        .from(user)
        .where(and(isNull(user.accountId), ne(user.id, activeUserId)));

    for (const candidate of candidates) {
        const [workouts, measurements, profiles] = await Promise.all([
            db.select().from(workout).where(eq(workout.userId, candidate.id)).limit(1),
            db.select().from(measurement).where(eq(measurement.userId, candidate.id)).limit(1),
            db.select().from(aiProfile).where(eq(aiProfile.userId, candidate.id)).limit(1),
        ]);

        if (workouts.length > 0 || measurements.length > 0 || profiles.length > 0) {
            reportError(
                new Error('An unlinked local user holds training data'),
                'Left an unlinked local user in place:',
                { extras: { userId: candidate.id } },
            );
            continue;
        }

        await db.delete(user).where(eq(user.id, candidate.id));
    }
};

/** The row linked to an account, if this device already has one. */
export const getUserByAccountId = async (accountId: string): Promise<UserSelect | null> => {
    const rows = await db.select().from(user).where(eq(user.accountId, accountId)).limit(1);

    return rows.length > 0 ? rows[0] : null;
};

/**
 * Finds, adopts, or creates the local row for a signed-in account, and makes it
 * the active one.
 *
 * The adoption step is what keeps the first sign-in from throwing away the
 * training someone has already done: a row that belongs to no account yet is
 * theirs, so it is linked rather than abandoned beside a new empty one. Every
 * account after that gets its own row, which is the whole point.
 */
const resolveWithoutPruning = async (
    identity: AccountIdentity,
    preferredLocalUserId?: string,
): Promise<UserSelect> => {
    const linked = await db
        .select()
        .from(user)
        .where(eq(user.accountId, identity.accountId))
        .limit(1);

    if (linked.length > 0) {
        setActiveUserId(linked[0].id);

        // The address or provider can change on the account's side between
        // sessions, so the mirror is refreshed rather than assumed.
        if (
            linked[0].accountEmail !== identity.accountEmail ||
            linked[0].accountProvider !== identity.accountProvider
        ) {
            return await updateUser(linked[0].id, {
                accountEmail: identity.accountEmail,
                accountProvider: identity.accountProvider,
            });
        }

        return linked[0];
    }

    if (preferredLocalUserId) {
        const existing = await db
            .select()
            .from(user)
            .where(eq(user.id, preferredLocalUserId))
            .limit(1);

        setActiveUserId(preferredLocalUserId);

        return existing.length > 0
            ? await updateUser(preferredLocalUserId, identity)
            : await createUser({ ...identity, id: preferredLocalUserId });
    }

    const unlinked = await db.select().from(user).where(isNull(user.accountId)).limit(1);

    if (unlinked.length > 0) {
        setActiveUserId(unlinked[0].id);
        return await updateUser(unlinked[0].id, identity);
    }

    const created = await createUser(identity);
    setActiveUserId(created.id);

    return created;
};

export const resolveLocalUserForAccount = async (
    identity: AccountIdentity,
    /**
     * The id the account's backup says this user has. Supplied on the first
     * sign-in after a reinstall, so the rebuilt row keeps the id the restored
     * rows already reference.
     */
    preferredLocalUserId?: string,
): Promise<UserSelect> => {
    const resolved = await resolveWithoutPruning(identity, preferredLocalUserId);

    // Only once the active row is known, so the sweep can tell the row being
    // kept from the ones left over. A failure here costs nothing but tidiness.
    try {
        await pruneEmptyUnlinkedUsers(resolved.id);
    } catch (error) {
        reportError(error, 'Failed to clean up unlinked local users:');
    }

    return resolved;
};

export const createUser = async (
    data: Omit<UserInsert, 'id'> & { id?: string },
): Promise<UserSelect> => {
    const newUser: UserInsert = {
        // An explicit id is passed when a row is being rebuilt from the
        // account's backup: every `user_id` in the restored workouts and
        // measurements points at it, so it has to come back unchanged.
        id: data.id ?? nanoid(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    try {
        await db.insert(user).values(newUser);

        const createdUser = await db.select().from(user).where(eq(user.id, newUser.id)).limit(1);

        if (createdUser.length === 0) {
            throw new Error('Failed to retrieve created user');
        }

        await queueSyncOperation({
            tableName: 'user',
            recordId: newUser.id,
            operation: 'create',
            timestamp: createdUser[0].updatedAt,
            data: createdUser[0],
        });

        return createdUser[0];
    } catch (error) {
        reportError(error, 'Failed to create user:');
        throw error;
    }
};

export const updateUser = async (id: string, updates: Partial<UserSelect>): Promise<UserSelect> => {
    const updatedData = {
        ...updates,
        updatedAt: new Date(),
    };

    try {
        await db.update(user).set(updatedData).where(eq(user.id, id));

        const updatedUser = await db.select().from(user).where(eq(user.id, id)).limit(1);

        if (updatedUser.length === 0) {
            throw new Error('User not found after update');
        }

        await queueSyncOperation({
            tableName: 'user',
            recordId: id,
            operation: 'update',
            timestamp: updatedUser[0].updatedAt,
            data: {
                ...updatedData,
                updatedAt: updatedUser[0].updatedAt,
            },
        });

        return updatedUser[0];
    } catch (error) {
        reportError(error, 'Failed to update user:');
        throw error;
    }
};

export const createOrUpdateCurrentUser = async (
    data: Omit<UserInsert, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<UserSelect> => {
    try {
        const exists = await getCurrentUser();

        if (exists) {
            return await updateUser(exists.id, data);
        } else {
            return await createUser(data);
        }
    } catch (error) {
        reportError(error, 'Failed to create or update current user:');
        throw error;
    }
};
