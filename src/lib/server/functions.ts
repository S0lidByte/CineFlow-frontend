import { db, sqlite } from "./db";
import { user, session, systemSettings } from "./schema";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("server-functions");

// Ensure system_settings table exists
try {
    sqlite.exec(
        "CREATE TABLE IF NOT EXISTS system_settings (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL);"
    );
} catch {
    // ignore
}

export async function getUsersCount(): Promise<number> {
    return await db.$count(user);
}

export async function getAdminCount(): Promise<number> {
    const adminUsers = await db.select().from(user).where(eq(user.role, "admin"));
    return adminUsers.length;
}

export async function getSystemSetting(
    key: string,
    defaultValue?: string
): Promise<string | undefined> {
    try {
        const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
        if (rows.length > 0) {
            return rows[0].value;
        }
    } catch (e) {
        logger.error("Error reading system setting", { key, error: e });
    }
    return defaultValue;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
    await db
        .insert(systemSettings)
        .values({
            key,
            value,
            updatedAt: new Date()
        })
        .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
                value,
                updatedAt: new Date()
            }
        });
}

/**
 * Checks whether public user registration is enabled.
 * Prioritizes dynamic system setting 'allow_public_registration',
 * falling back to environment variable ENABLE_EMAIL_PASSWORD_SIGNUP.
 */
export async function isPublicRegistrationAllowed(): Promise<boolean> {
    const setting = await getSystemSetting("allow_public_registration");
    if (setting !== undefined && setting !== null) {
        return setting === "true" || setting === "1";
    }
    return env.ENABLE_EMAIL_PASSWORD_SIGNUP === "true";
}

/**
 * Updates public user registration setting.
 */
export async function setPublicRegistrationAllowed(allowed: boolean): Promise<void> {
    await setSystemSetting("allow_public_registration", allowed ? "true" : "false");
}

export interface AdminMutationValidation {
    allowed: boolean;
    reason?: string;
}

/**
 * Validates whether an admin mutation (role change, ban, deletion) is permitted.
 * Enforces:
 * 1. Actor must be an admin.
 * 2. An admin cannot ban, demote, or delete their own account.
 * 3. Cannot demote or delete the last remaining administrator.
 */
export async function validateAdminMutation({
    actorId,
    actorRole,
    targetUserId,
    targetNewRole,
    isDelete = false,
    isBan = false
}: {
    actorId: string;
    actorRole?: string | null;
    targetUserId: string;
    targetNewRole?: string;
    isDelete?: boolean;
    isBan?: boolean;
}): Promise<AdminMutationValidation> {
    if (actorRole !== "admin") {
        return { allowed: false, reason: "Unauthorized: Administrator privileges required." };
    }

    if (actorId === targetUserId) {
        if (isBan) {
            return { allowed: false, reason: "Administrators cannot ban their own account." };
        }
        if (isDelete) {
            return { allowed: false, reason: "Administrators cannot delete their own account." };
        }
        if (targetNewRole && targetNewRole !== "admin") {
            return { allowed: false, reason: "Administrators cannot demote their own account." };
        }
    }

    // Check target user's current role
    const targetUser = await db.select().from(user).where(eq(user.id, targetUserId));
    if (targetUser.length === 0) {
        return { allowed: false, reason: "User not found." };
    }

    const currentRole = targetUser[0].role;
    if (currentRole === "admin") {
        const isDemoting = targetNewRole && targetNewRole !== "admin";
        if (isDelete || isDemoting) {
            const adminCount = await getAdminCount();
            if (adminCount <= 1) {
                return {
                    allowed: false,
                    reason: "Cannot demote or delete the last remaining administrator."
                };
            }
        }
    }

    return { allowed: true };
}
