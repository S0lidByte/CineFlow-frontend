/**
 * Unit tests for AniList trending client, outage detection, and fallback structures.
 * Run: pnpm exec tsx src/lib/providers/anilist.test.ts
 */

import assert from "node:assert/strict";
import { getTrending, getTrendingWithStatus, type AnilistTrendingResponse } from "./anilist";
import { transformTMDBList } from "./parser";

async function runTests() {
    console.log("Starting AniList & Trending Anime Fallback Tests...");

    // Test 1: Successful AniList response returns data with success: true
    {
        const mockSuccessResponse: AnilistTrendingResponse = {
            data: {
                Page: {
                    media: [
                        {
                            id: 16498,
                            title: {
                                romaji: "Shingeki no Kyojin",
                                english: "Attack on Titan",
                                native: "進撃の巨人"
                            },
                            coverImage: {
                                large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498.jpg"
                            },
                            seasonYear: 2013,
                            format: "TV"
                        }
                    ]
                }
            }
        };

        const mockFetch = async () =>
            new Response(JSON.stringify(mockSuccessResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });

        const statusRes = await getTrendingWithStatus(mockFetch, 1);
        assert.equal(statusRes.success, true);
        if (statusRes.success) {
            assert.equal(statusRes.data.data.Page.media.length, 1);
            assert.equal(statusRes.data.data.Page.media[0].id, 16498);
        }

        const legacyRes = await getTrending(mockFetch, 1);
        assert.notEqual(legacyRes, null);
        assert.equal(legacyRes?.data.Page.media[0].id, 16498);
    }

    // Test 2: AniList 403 Outage error is detected as isOutage: true
    {
        const mockOutageResponse = {
            errors: [
                {
                    message:
                        "The AniList API has been temporarily disabled due to severe stability issues.",
                    status: 403
                }
            ]
        };

        const mockFetch = async () =>
            new Response(JSON.stringify(mockOutageResponse), {
                status: 403,
                headers: { "Content-Type": "application/json" }
            });

        const statusRes = await getTrendingWithStatus(mockFetch, 1);
        assert.equal(statusRes.success, false);
        if (!statusRes.success) {
            assert.equal(statusRes.isOutage, true);
            assert.equal(statusRes.status, 403);
            assert.match(statusRes.error, /temporarily disabled/i);
        }

        const legacyRes = await getTrending(mockFetch, 1);
        assert.equal(legacyRes, null);
    }

    // Test 3: AniList 503 Service Unavailable is detected as isOutage: true
    {
        const mockFetch = async () =>
            new Response("Service Unavailable", {
                status: 503,
                statusText: "Service Unavailable"
            });

        const statusRes = await getTrendingWithStatus(mockFetch, 1);
        assert.equal(statusRes.success, false);
        if (!statusRes.success) {
            assert.equal(statusRes.isOutage, true);
            assert.equal(statusRes.status, 503);
        }
    }

    // Test 4: AniList 200 with GraphQL stability error messages is detected as isOutage: true
    {
        const mockGraphQLError = {
            errors: [
                {
                    message:
                        "The AniList API has been temporarily disabled due to severe stability issues."
                }
            ]
        };

        const mockFetch = async () =>
            new Response(JSON.stringify(mockGraphQLError), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });

        const statusRes = await getTrendingWithStatus(mockFetch, 1);
        assert.equal(statusRes.success, false);
        if (!statusRes.success) {
            assert.equal(statusRes.isOutage, true);
            assert.match(statusRes.error, /stability issues/i);
        }
    }

    // Test 5: Network / fetch exception handling
    {
        const mockFetch = async () => {
            throw new Error("Network connection reset");
        };

        const statusRes = await getTrendingWithStatus(mockFetch, 1);
        assert.equal(statusRes.success, false);
        if (!statusRes.success) {
            assert.equal(statusRes.isOutage, false);
            assert.match(statusRes.error, /Network connection reset/i);
        }
    }

    // Test 6: TMDB fallback transformation produces valid list items for frontend store
    {
        const mockTMDBRawResults = [
            {
                id: 85937,
                name: "Demon Slayer: Kimetsu no Yaiba",
                original_name: "鬼滅の刃",
                poster_path: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
                backdrop_path: "/nTvM4mhqZlHIvUkI1gVnWumQU4P.jpg",
                first_air_date: "2019-04-06",
                vote_average: 8.7,
                vote_count: 6200,
                popularity: 145.2,
                overview: "It is the Taisho Period in Japan...",
                original_language: "ja",
                genre_ids: [16, 10759, 10765]
            }
        ];

        const transformed = transformTMDBList(mockTMDBRawResults, "tv");
        assert.equal(transformed.length, 1);
        const item = transformed[0];
        assert.equal(item.id, 85937);
        assert.equal(item.title, "Demon Slayer: Kimetsu no Yaiba");
        assert.equal(item.media_type, "tv");
        assert.equal(item.indexer, "tmdb");
        assert.equal(item.year, 2019);
        assert.match(item.poster_path || "", /image\.tmdb\.org/);
    }

    console.log("All AniList & Trending Anime Fallback Tests passed successfully!");
}

runTests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
