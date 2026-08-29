import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-user-password-api");

/**
 * POST /api/admin/users/[id]/password
 * Resets a user's password directly (useful for lockout recovery).
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
        const body = (await request.json()) as { password?: string };
        const newPassword = body.password;

        if (!newPassword || newPassword.length < 8) {
            return json({ error: "Password must be at least 8 characters long." }, { status: 400 });
        }

        await auth.api.setUserPassword({
            body: {
                userId: targetUserId,
                newPassword
            },
            headers: request.headers
        });

        logger.info("User password reset by admin", {
            adminId: locals.user.id,
            targetUserId
        });

        return json({ success: true, message: "Password updated successfully." });
    } catch (e: unknown) {
        logger.error("Failed to reset user password", { error: e, targetUserId });
        const message = e instanceof Error ? e.message : "Failed to reset password";
        return json({ error: message }, { status: 500 });
    }
};
