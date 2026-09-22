import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import providers from "$lib/server/providers";
import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";
import { resolveId } from "$lib/services/resolver";
import * as dateUtils from "$lib/utils/date";
import {
    findBestRTMatch,
    formatRTCriticsScore,
    formatRTAudienceScore,
    formatImdbScore,
    formatTmdbScore,
    type RatingScore,
    type RatingsResponse,
    type RadarrImdbResponse,
    type RTAlgoliaSearchResponse
} from "$lib/services/ratings-matcher";

const logger = createScopedLogger("ratings");

// RT Algolia public search API credentials (public search-only key used by RT web client)
const RT_ALGOLIA_API_KEY = ["175588f6", "e5f8319b", "27702e4c", "c4013561"].join("");
const RT_ALGOLIA_APP_ID = "79FRDP12PN";
const RT_ALGOLIA_URL = "https://79frdp12pn-dsn.algolia.net/1/indexes/*/queries";

export const GET: RequestHandler = async ({ params, url, fetch, setHeaders }) => {
    const { tmdbId } = params;
    const mediaType = url.searchParams.get("type") as "movie" | "tv" | null;
    const customFetch = createCustomFetch(fetch);

    if (!mediaType || !["movie", "tv"].includes(mediaType)) {
        throw error(400, 'Invalid or missing media type. Must be "movie" or "tv"');
    }

    // Collect scores in separate variables to ensure consistent ordering
    let tmdbScore: RatingScore | null = null;
    let imdbScore: RatingScore | null = null;
    let rtCriticsScore: RatingScore | null = null;
    let rtAudienceScore: RatingScore | null = null;

    let imdbId: string | null = null;
    let title: string | null = null;
    let year: number | undefined;

    // SINGLE TMDB call with append_to_response
    try {
        const tmdbData =
            mediaType === "movie"
                ? await providers.tmdb.GET("/3/movie/{movie_id}", {
                      params: {
                          path: { movie_id: Number(tmdbId) },
                          query: { append_to_response: "external_ids" }
                      },
                      fetch: customFetch
                  })
                : await providers.tmdb.GET("/3/tv/{series_id}", {
                      params: {
                          path: { series_id: Number(tmdbId) },
                          query: { append_to_response: "external_ids" }
                      },
                      fetch: customFetch
                  });

        if (tmdbData.data) {
            const data = tmdbData.data as Record<string, unknown>;

            // Get title and year for RT search
            if (mediaType === "movie") {
                title = (data.title as string) || null;
                year = dateUtils.getYearFromISO(data.release_date as string) ?? undefined;
            } else {
                title = (data.name as string) || null;
                year = dateUtils.getYearFromISO(data.first_air_date as string) ?? undefined;
            }

            // Add TMDB rating
            const voteAverage = data.vote_average as number | undefined;
            if (voteAverage && voteAverage > 0) {
                tmdbScore = formatTmdbScore(Number(tmdbId), mediaType, voteAverage);
            }

            // Get IMDB ID using the consolidated resolver
            // Pass the already fetched data to avoid redundant API calls
            const resolvedImdb = await resolveId({
                from: "tmdb",
                to: "imdb",
                id: Number(tmdbId),
                mediaType,
                customFetch,
                data: data
            });

            if (resolvedImdb.resolved) {
                imdbId = String(resolvedImdb.id);
            }
        }
    } catch (e) {
        logger.error("[ratings] TMDB fetch failed:", e);
    }

    // Parallelize external fetches
    const fetchPromises: Promise<void>[] = [];

    // Fetch IMDB rating via Radarr's public proxy
    if (imdbId && mediaType === "movie") {
        fetchPromises.push(
            (async () => {
                try {
                    const radarrResponse = await customFetch(
                        `https://api.radarr.video/v1/movie/imdb/${imdbId}`,
                        {
                            headers: {
                                "Content-Type": "application/json",
                                Accept: "application/json"
                            },
                            signal: AbortSignal.timeout(5000)
                        }
                    );

                    if (radarrResponse.ok) {
                        const data: RadarrImdbResponse[] = await radarrResponse.json();
                        const movie = data.find((m) => m.ImdbId === imdbId);

                        if (movie?.MovieRatings?.Imdb?.Value) {
                            imdbScore = formatImdbScore(imdbId, movie.MovieRatings.Imdb.Value);
                        }
                    }
                } catch (e) {
                    if (e instanceof Error && e.name === "TimeoutError") {
                        logger.error("[ratings] Radarr IMDB proxy timed out");
                    } else {
                        logger.error("[ratings] Radarr IMDB proxy failed:", e);
                    }
                }
            })()
        );
    }

    // Fetch Rotten Tomatoes via Algolia
    if (title) {
        fetchPromises.push(
            (async () => {
                try {
                    const contentType = mediaType === "movie" ? "movie" : "tv";
                    const filters = encodeURIComponent(
                        `isEmsSearchable=1 AND type:"${contentType}"`
                    );
                    // Strip "the" from movie titles to improve search results (Jellyseerr approach)
                    const searchQuery =
                        mediaType === "movie" ? title!.replace(/\bthe\b ?/gi, "") : title!;

                    const rtResponse = await customFetch(RT_ALGOLIA_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            "x-algolia-agent": "Algolia for JavaScript (4.14.3); Browser (lite)",
                            "x-algolia-api-key": RT_ALGOLIA_API_KEY,
                            "x-algolia-application-id": RT_ALGOLIA_APP_ID
                        },
                        body: JSON.stringify({
                            requests: [
                                {
                                    indexName: "content_rt",
                                    query: searchQuery,
                                    params: `filters=${filters}&hitsPerPage=20`
                                }
                            ]
                        }),
                        signal: AbortSignal.timeout(5000)
                    });

                    if (rtResponse.ok) {
                        const data: RTAlgoliaSearchResponse = await rtResponse.json();
                        const contentResults = data.results.find((r) => r.index === "content_rt");
                        const match = findBestRTMatch(contentResults?.hits || [], title!, year);

                        if (match) {
                            rtCriticsScore = formatRTCriticsScore(match, mediaType);
                            rtAudienceScore = formatRTAudienceScore(match, mediaType);
                        }
                    }
                } catch (e) {
                    if (e instanceof Error && e.name === "TimeoutError") {
                        logger.error("[ratings] Rotten Tomatoes fetch timed out");
                    } else {
                        logger.error("[ratings] Rotten Tomatoes fetch failed:", e);
                    }
                }
            })()
        );
    }

    await Promise.all(fetchPromises);

    // Build scores array in consistent order: TMDB, IMDb, RT Critics, RT Audience
    const scores: RatingScore[] = [];
    if (tmdbScore) scores.push(tmdbScore);
    if (imdbScore) scores.push(imdbScore);
    if (rtCriticsScore) scores.push(rtCriticsScore);
    if (rtAudienceScore) scores.push(rtAudienceScore);

    const response: RatingsResponse = {
        scores,
        tmdbId: Number(tmdbId),
        mediaType,
        imdbId
    };

    setHeaders({ "Cache-Control": "public, max-age=3600" });

    return json(response);
};
