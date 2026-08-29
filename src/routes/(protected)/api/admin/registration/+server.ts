import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { setPublicRegistrationAllowed } from "$lib/server/functions";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-registration-api");

/**
 * POST /api/admin/registration
 * Toggles public user registration.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    try {
        const body = (await request.json()) as { allowed?: boolean };
        const allowed = body.allowed === true;

        await setPublicRegistrationAllowed(allowed);

        logger.info("Admin updated public registration setting", {
            adminId: locals.user.id,
            allowed
        });

        return json({ success: true, allowed });
    } catch (e: unknown) {
        logger.error("Failed to update registration setting", { error: e });
        const message = e instanceof Error ? e.message : "Failed to update setting";
        return json({ error: message }, { status: 500 });
    }
};
