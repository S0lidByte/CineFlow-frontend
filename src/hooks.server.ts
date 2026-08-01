import { auth } from "$lib/server/auth";
import { redirect, error, type Handle, type ServerInit } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { sequence } from "@sveltejs/kit/hooks";
import { env } from "$env/dynamic/private";
import providers from "$lib/providers";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "$lib/server/db";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("hooks");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tvdbTokenPromise: Promise<any> | null = null;

export const init: ServerInit = async () => {
    if (!env.BACKEND_URL) {
        throw new Error("BACKEND_URL environment variable is required");
    }
    if (!env.BACKEND_API_KEY) {
        throw new Error("BACKEND_API_KEY environment variable is required");
    }
    migrate(db, { migrationsFolder: "drizzle" });

    // @ts-expect-error ignore
    logger.box(`Riven Frontend v${__APP_VERSION__}`);
};

export const betterAuthHandler: Handle = async ({ event, resolve }) => {
    if (event.route.id?.startsWith("/(protected)")) {
        const session = await auth.api.getSession({
            headers: event.request.headers
        });

        if (session) {
            event.locals.session = session?.session;
            event.locals.user = session?.user;
            return svelteKitHandler({ event, resolve, auth, building });
        } else {
            if (event.url.pathname.startsWith("/api/")) {
                throw error(401, "Unauthorized");
            }
            throw redirect(307, "/auth/login");
        }
    } else {
        return svelteKitHandler({ event, resolve, auth, building });
    }
};

const configureLocals: Handle = async ({ event, resolve }) => {
    event.locals.backendUrl = env.BACKEND_URL ?? "";
    event.locals.apiKey = env.BACKEND_API_KEY ?? "";

    return resolve(event);
};

// In-process TVDB token cache — avoids hitting the external TVDB API on every
// request. The cookie is httpOnly so the browser sends it back correctly, but
// during the window between set() and the browser's first follow-up request the
// in-memory cache prevents a redundant round-trip.
let cachedTvdbToken: string | null = null;
let tvdbTokenExpiresAt = 0;
// 29 days — TVDB tokens are valid for 30 days, refresh a day early
const TVDB_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

const handleTVDBCookie: Handle = async ({ event, resolve }) => {
    // Skip for static assets and internal SvelteKit requests
    if (
        event.url.pathname.startsWith("/_app/") ||
        event.url.pathname.startsWith("/favicon.ico") ||
        event.url.pathname.includes(".")
    ) {
        return resolve(event);
    }

    // Fast path: browser already has the cookie — no work needed
    const tvdbCookie = event.cookies.get("tvdb_cookie");
    if (tvdbCookie) {
        return resolve(event);
    }

    // Fast path: we already have a valid in-memory token — set cookie and continue
    // without making an external network call
    if (cachedTvdbToken && Date.now() < tvdbTokenExpiresAt) {
        const isSecure =
            event.url.protocol === "https:" ||
            event.request.headers.get("x-forwarded-proto") === "https";
        event.cookies.set("tvdb_cookie", cachedTvdbToken, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: isSecure,
            maxAge: 60 * 60 * 24 * 30
        });
        return resolve(event);
    }

    // Slow path: fetch a fresh token from TVDB (coalesced via shared promise)
    if (!tvdbTokenPromise) {
        const customFetch = createCustomFetch(event.fetch);
        tvdbTokenPromise = (async () => {
            try {
                const res = await providers.tvdb.POST("/login", {
                    body: {
                        apikey: "6be85335-5c4f-4d8d-b945-d3ed0eb8cdce"
                    },
                    fetch: customFetch
                });
                return res;
            } finally {
                tvdbTokenPromise = null;
            }
        })();
    }

    const tvdbLogin = await tvdbTokenPromise;

    if (!tvdbLogin || tvdbLogin.error) {
        logger.error("Failed to login to TVDB", { error: tvdbLogin?.error });
        // FIX-25: Debounce retries for 5 minutes on failure to avoid hammering a
        // downed TVDB API with every incoming server-side request.
        tvdbTokenExpiresAt = Date.now() + 5 * 60 * 1000;
        // Don't block the whole request if TVDB is down
        return resolve(event);
    }

    const token = tvdbLogin.data?.data?.token || "";
    cachedTvdbToken = token;
    tvdbTokenExpiresAt = Date.now() + TVDB_TOKEN_TTL_MS;

    const isSecure =
        event.url.protocol === "https:" ||
        event.request.headers.get("x-forwarded-proto") === "https";

    event.cookies.set("tvdb_cookie", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        maxAge: 60 * 60 * 24 * 30
    });
    logger.info("Set TVDB cookie", { secure: isSecure });

    return resolve(event);
};

export const handle: Handle = sequence(configureLocals, betterAuthHandler, handleTVDBCookie);
