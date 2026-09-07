import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";

import { getTrendingWithStatus } from "$lib/providers/anilist";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import providers from "$lib/server/providers";
import { transformTMDBList } from "$lib/providers/parser";

const logger = createScopedLogger("anilist-trending");

let anilistOutageUntil = 0;
const OUTAGE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function _resetAniListCircuit(): void {
    anilistOutageUntil = 0;
}

export function _getAniListCircuitStatus(): { isOpen: boolean; outageUntil: number } {
    return {
        isOpen: Date.now() < anilistOutageUntil,
        outageUntil: anilistOutageUntil
    };
}

async function fetchTMDBFallback(fetchFn: typeof fetch, page: number) {
    logger.info(`Fetching trending anime fallback from TMDB discover (page ${page})`);
    const { data, error: tmdbError } = await providers.tmdb.GET("/3/discover/tv", {
        params: {
            query: {
                page,
                with_genres: "16",
                with_original_language: "ja",
                sort_by: "popularity.desc"
            }
        },
        fetch: fetchFn
    });

    if (data && Array.isArray(data.results)) {
        const results = transformTMDBList(data.results, "tv");
        return {
            results,
            page: data.page ?? page,
            total_pages: data.total_pages ?? 1,
            total_results: data.total_results ?? results.length,
            source: "tmdb_fallback"
        };
    }

    throw new Error(tmdbError ? JSON.stringify(tmdbError) : "TMDB discover returned no data");
}

export const GET: RequestHandler = async ({ fetch, locals, url }) => {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const customFetch = createCustomFetch(fetch);
    const now = Date.now();

    // Check if AniList circuit breaker is currently open
    if (now < anilistOutageUntil) {
        logger.info(
            `AniList circuit breaker active until ${new Date(anilistOutageUntil).toISOString()}. Using TMDB anime discovery directly.`
        );
        try {
            const fallbackData = await fetchTMDBFallback(customFetch, page);
            return json(fallbackData);
        } catch (tmdbErr) {
            logger.error(
                "TMDB anime fallback failed while AniList circuit breaker is open:",
                tmdbErr
            );
            return json({
                results: [],
                page,
                total_pages: 1,
                total_results: 0,
                error: "Upstream providers unavailable",
                source: "none"
            });
        }
    }

    try {
        const anilistResult = await getTrendingWithStatus(customFetch, page);

        if (anilistResult.success && anilistResult.data?.data?.Page?.media) {
            const media = anilistResult.data.data.Page.media.map((item) => ({
                id: item.id,
                title: item.title.english || item.title.romaji || item.title.native || "",
                poster_path: item.coverImage?.large || null,
                media_type: item.format || "TV",
                year: item.seasonYear ?? "N/A",
                indexer: "anilist" as const
            }));

            return json({
                data: {
                    Page: {
                        media
                    }
                },
                source: "anilist"
            });
        }

        // AniList failed or returned outage/error
        if (!anilistResult.success && anilistResult.isOutage) {
            anilistOutageUntil = Date.now() + OUTAGE_COOLDOWN_MS;
            logger.warn(
                `AniList outage detected (${anilistResult.error}). Cooldown activated for 5 minutes (until ${new Date(anilistOutageUntil).toISOString()}). Falling back to TMDB.`
            );
        } else {
            logger.warn(
                `AniList failed (${anilistResult.success ? "empty media" : anilistResult.error}). Falling back to TMDB.`
            );
        }

        const fallbackData = await fetchTMDBFallback(customFetch, page);
        return json(fallbackData);
    } catch (err) {
        logger.warn(
            "AniList primary request failed with exception, attempting TMDB fallback:",
            err
        );
        try {
            const fallbackData = await fetchTMDBFallback(customFetch, page);
            return json(fallbackData);
        } catch (tmdbErr) {
            logger.error("Both AniList and TMDB fallback failed:", tmdbErr);
            return json({
                results: [],
                page,
                total_pages: 1,
                total_results: 0,
                error: "Upstream providers unavailable",
                source: "none"
            });
        }
    }
};
