import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { auth } from "$lib/server/auth";
import { validateAdminMutation } from "$lib/server/functions";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-user-role-api");

/**
 * POST /api/admin/users/[id]/role
 * Updates a user's role (admin, manager, user) with safety validation.
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
        const body = (await request.json()) as { role?: string };
        const newRole = (body.role || "") as "user" | "admin" | "manager";

        if (!newRole || !["admin", "manager", "user"].includes(newRole)) {
            return json({ error: "Invalid role specified." }, { status: 400 });
        }

        const validation = await validateAdminMutation({
            actorId: locals.user.id,
            actorRole: locals.user.role,
            targetUserId,
            targetNewRole: newRole
        });

        if (!validation.allowed) {
            return json({ error: validation.reason }, { status: 400 });
        }

        await auth.api.setRole({
            body: {
                userId: targetUserId,
                role: newRole
            },
            headers: request.headers
        });

        logger.info("User role updated successfully", {
            adminId: locals.user.id,
            targetUserId,
            newRole
        });

        return json({ success: true, message: `Role updated to ${newRole}.` });
    } catch (e: unknown) {
        logger.error("Failed to update user role", { error: e, targetUserId });
        const message = e instanceof Error ? e.message : "Failed to update role";
        return json({ error: message }, { status: 500 });
    }
};
