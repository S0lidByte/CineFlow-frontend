import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";
import { validateAdminMutation } from "$lib/server/functions";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-user-ban-api");

/**
 * POST /api/admin/users/[id]/ban
 * Suspends (bans) or reactivates (unbans) a user.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    const targetUserId = params.id;
    if (!targetUserId) {
        return json({ error: "User ID is required." }, { status: 400 });
    }

    try {
        const body = (await request.json()) as { ban?: boolean; banReason?: string };
        const shouldBan = body.ban !== false;
        const banReason = body.banReason?.trim() || undefined;

        if (shouldBan) {
            const validation = await validateAdminMutation({
                actorId: locals.user.id,
                actorRole: locals.user.role,
                targetUserId,
                isBan: true
            });

            if (!validation.allowed) {
                return json({ error: validation.reason }, { status: 400 });
            }

            await auth.api.banUser({
                body: {
                    userId: targetUserId,
                    banReason
                },
                headers: request.headers
            });

            logger.info("User banned successfully", {
                adminId: locals.user.id,
                targetUserId,
                banReason
            });

            return json({ success: true, message: "User suspended successfully." });
        } else {
            await auth.api.unbanUser({
                body: {
                    userId: targetUserId
                },
                headers: request.headers
            });

            logger.info("User unbanned successfully", {
                adminId: locals.user.id,
                targetUserId
            });

            return json({ success: true, message: "User reactivated successfully." });
        }
    } catch (e: unknown) {
        logger.error("Failed to update user ban state", { error: e, targetUserId });
        const message = e instanceof Error ? e.message : "Failed to update ban state";
        return json({ error: message }, { status: 500 });
    }
};
