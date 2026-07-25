import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import providers from "$lib/providers";

/**
 * GET: Trakt OAuth callback (browser redirect from trakt.tv).
 *
 * Redirect URI registered in the Trakt app must be:
 *   {ORIGIN}/api/trakt/oauth/callback
 * (frontend BFF — not the backend /api/v1/trakt/oauth/callback, which requires an API key).
 */
export const GET: RequestHandler = async ({ locals, fetch: fetchFn, url, cookies }) => {
    if (locals.user?.role !== "admin") {
        throw error(403, "Forbidden");
    }

    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const nextCookie = cookies.get("trakt_oauth_next");
    cookies.delete("trakt_oauth_next", { path: "/" });

    const fallback = "/settings?tab=content";
    const nextBase = nextCookie ? decodeURIComponent(nextCookie) : fallback;

    if (oauthError) {
        throw redirect(
            303,
            `/settings?tab=content&trakt=error&message=${encodeURIComponent(oauthError)}`
        );
    }

    if (!code) {
        throw redirect(
            303,
            `/settings?tab=content&trakt=error&message=${encodeURIComponent("missing_code")}`
        );
    }

    const res = await providers.riven.GET("/api/v1/trakt/oauth/callback", {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        params: { query: { code } },
        fetch: fetchFn
    });

    if (res.error) {
        const detail =
            typeof res.error === "object" && res.error && "detail" in res.error
                ? String((res.error as { detail?: unknown }).detail)
                : "oauth_failed";
        throw redirect(
            303,
            `/settings?tab=content&trakt=error&message=${encodeURIComponent(detail)}`
        );
    }

    const dest = nextBase.includes("trakt=")
        ? nextBase
        : `${nextBase}${nextBase.includes("?") ? "&" : "?"}trakt=connected`;
    throw redirect(303, dest);
};
