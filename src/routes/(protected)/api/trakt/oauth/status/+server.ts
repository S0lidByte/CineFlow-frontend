import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActorHeadersForUser } from "$lib/server/permissions";

export type TraktOAuthStatus = {
    connected: boolean;
    has_client_id: boolean;
    has_client_secret: boolean;
    redirect_uri: string;
    redirect_uri_hint: string;
};

/** GET: Trakt OAuth connection status (BFF → backend). */
export const GET: RequestHandler = async ({ locals }) => {
    if (locals.user?.role !== "admin") {
        throw error(403, "Forbidden");
    }
    if (!locals.backendUrl || !locals.apiKey) {
        throw error(500, "Backend not configured");
    }

    const actorHeaders = getActorHeadersForUser(locals.user);
    const res = await fetch(`${locals.backendUrl}/api/v1/trakt/oauth/status`, {
        headers: {
            "x-api-key": locals.apiKey,
            ...actorHeaders,
            accept: "application/json"
        }
    });

    if (!res.ok) {
        const body = await res.text();
        throw error(res.status, body || "Failed to load Trakt OAuth status");
    }

    const data = (await res.json()) as TraktOAuthStatus;
    return json(data);
};
