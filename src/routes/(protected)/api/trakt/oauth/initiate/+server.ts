import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import providers from "$lib/providers";
import { dev } from "$app/environment";
import { randomBytes } from "node:crypto";
import { getActorHeadersForUser } from "$lib/server/permissions";

/** GET: Start Trakt OAuth — redirects browser to Trakt authorize URL. */
export const GET: RequestHandler = async ({ locals, fetch: fetchFn, url, cookies }) => {
    if (locals.user?.role !== "admin") {
        throw error(403, "Forbidden");
    }

    const actorHeaders = getActorHeadersForUser(locals.user);
    const res = await providers.riven.GET("/api/v1/trakt/oauth/initiate", {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey, ...actorHeaders },
        fetch: fetchFn
    });

    if (res.error || !res.data?.auth_url) {
        const detail =
            typeof res.error === "object" && res.error && "detail" in res.error
                ? String((res.error as { detail?: unknown }).detail)
                : "Failed to start Trakt OAuth";
        throw redirect(
            303,
            `/settings?tab=content&trakt=error&message=${encodeURIComponent(detail)}`
        );
    }

    const next = url.searchParams.get("next") || "/settings?tab=content&trakt=connected";
    cookies.set("trakt_oauth_next", next, {
        path: "/",
        httpOnly: true,
        secure: !dev,
        sameSite: "lax",
        maxAge: 60 * 10
    });

    const state = randomBytes(24).toString("hex");
    cookies.set("trakt_oauth_state", state, {
        path: "/",
        httpOnly: true,
        secure: !dev,
        sameSite: "lax",
        maxAge: 60 * 10
    });

    const authUrl = new URL(res.data.auth_url);
    authUrl.searchParams.set("state", state);
    throw redirect(302, authUrl.toString());
};
