import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActorHeadersForUser } from "$lib/server/permissions";

/** POST: Clear Trakt OAuth tokens (BFF → backend). */
export const POST: RequestHandler = async ({ locals }) => {
    if (locals.user?.role !== "admin") {
        throw error(403, "Forbidden");
    }
    if (!locals.backendUrl || !locals.apiKey) {
        throw error(500, "Backend not configured");
    }

    const actorHeaders = getActorHeadersForUser(locals.user);
    const res = await fetch(`${locals.backendUrl}/api/v1/trakt/oauth/disconnect`, {
        method: "POST",
        headers: {
            "x-api-key": locals.apiKey,
            ...actorHeaders,
            accept: "application/json"
        }
    });

    if (!res.ok) {
        const body = await res.text();
        throw error(res.status, body || "Failed to disconnect Trakt");
    }

    return json({ message: "Trakt OAuth tokens cleared" });
};
