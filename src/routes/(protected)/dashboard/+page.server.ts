import type { PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { error } from "@sveltejs/kit";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("dashboard");

export const load = (async ({ fetch, locals }) => {
    const [statistics, svc, downloaderInfo] = await Promise.all([
        providers.riven.GET("/api/v1/stats", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        }),

        providers.riven.GET("/api/v1/services", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        }),
        providers.riven.GET("/api/v1/downloader_user_info", {
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        })
    ]);

    if (statistics.error) {
        logger.error("Statistics fetch error:", statistics.error);
        error(500, "Unable to fetch stats data");
    }

    if (svc.error) {
        logger.error("Services fetch error:", svc.error);
        // Soft-fail: keep KPIs and debrid cards usable
    }

    if (downloaderInfo.error) {
        logger.error("Downloader info fetch error:", downloaderInfo.error);
        // Do not fail the whole dashboard; return empty downloader list so the rest of the page loads
    }

    return {
        statistics: statistics.data,
        services: svc.error ? {} : svc.data || {},
        downloaderInfo: downloaderInfo.error ? { services: [] } : downloaderInfo.data
    };
}) satisfies PageServerLoad;
