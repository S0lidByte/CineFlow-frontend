import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";
import { validateAdminMutation } from "$lib/server/functions";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-user-detail-api");

/**
 * DELETE /api/admin/users/[id]
 * Deletes a user account with safety validation (cannot delete the last admin).
 */
export const DELETE: RequestHandler = async ({ params, locals, request }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    const targetUserId = params.id;
    if (!targetUserId) {
        return json({ error: "User ID is required." }, { status: 400 });
    }

    const validation = await validateAdminMutation({
        actorId: locals.user.id,
        actorRole: locals.user.role,
        targetUserId,
        isDelete: true
    });

    if (!validation.allowed) {
        return json({ error: validation.reason }, { status: 400 });
    }

    try {
        await auth.api.removeUser({
            body: {
                userId: targetUserId
            },
            headers: request.headers
        });

        logger.info("User deleted successfully", {
            adminId: locals.user.id,
            deletedUserId: targetUserId
        });

        return json({ success: true, message: "User deleted successfully." });
    } catch (e: unknown) {
        logger.error("Failed to delete user", { error: e, targetUserId });
        const message = e instanceof Error ? e.message : "Failed to delete user";
        return json({ error: message }, { status: 500 });
    }
};
