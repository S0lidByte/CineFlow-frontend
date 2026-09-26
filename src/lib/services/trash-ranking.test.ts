/**
 * Comprehensive Unit Test Suite for TRaSH Guides Ranking Service & Heuristics (TRASH-002).
 * Conforms to node:assert runner pattern in scripts/run_tests.ts.
 */

import assert from "node:assert/strict";
import {
    getCategoryLabel,
    getCategoryBadgeClass,
    getTrashCustomFormats,
    evaluateTrashRelease,
    testRankingWithTrash,
    getFunnelSummary,
    type TrashCustomFormatsResponse,
    type TrashEvaluateResponse,
    type RankingTestResponse,
    type FunnelSummaryResponse
} from "./trash-ranking";

console.log("Running TRaSH Guides Ranking Service & Heuristics Unit Tests (TRASH-002)...");

// =========================================================================
// 1. Badge & Category Helpers
// =========================================================================
{
    assert.equal(getCategoryLabel("hdr_dv"), "Dolby Vision & HDR");
    assert.equal(getCategoryLabel("audio_advanced"), "Advanced Audio & Codecs");
    assert.equal(getCategoryLabel("source_remux_tier"), "Remux Quality Tiers");
    assert.equal(getCategoryLabel("unwanted_lq"), "Low Quality & Unwanted Rips");
    assert.equal(getCategoryLabel("custom_category_name"), "Custom Category Name");

    assert.ok(getCategoryBadgeClass("hdr_dv").includes("text-purple-400"));
    assert.ok(getCategoryBadgeClass("unwanted_lq").includes("text-rose-400"));
    assert.ok(getCategoryBadgeClass("unknown").includes("text-slate-400"));
}

// =========================================================================
// 2. Mock Fetcher Contract Tests
// =========================================================================
{
    const originalFetch = globalThis.fetch;

    try {
        // Test getTrashCustomFormats
        const mockCatalog: TrashCustomFormatsResponse = {
            message: "TRaSH Formats",
            profiles: [
                {
                    profile_id: "trash_balanced",
                    name: "TRaSH Balanced",
                    description: "Balanced quality preset",
                    cutoff_score: 500,
                    min_score: 0,
                    reject_negative_scores: false
                }
            ],
            custom_formats: [
                {
                    trash_id: "truehd_atmos",
                    name: "TrueHD Atmos",
                    category: "audio_advanced",
                    description: "Dolby TrueHD Atmos audio",
                    default_score: 100,
                    score: 100,
                    enabled: true,
                    conditions: [
                        { name: "truehd", pattern: "truehd", negate: false, required: true }
                    ]
                }
            ]
        };

        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("/ranking/custom-formats")) {
                return new Response(JSON.stringify(mockCatalog), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            throw new Error(`Unexpected url: ${url}`);
        };

        const catalogRes = await getTrashCustomFormats();
        assert.equal(catalogRes.profiles.length, 1);
        assert.equal(catalogRes.profiles[0].profile_id, "trash_balanced");
        assert.equal(catalogRes.custom_formats.length, 1);
        assert.equal(catalogRes.custom_formats[0].name, "TrueHD Atmos");

        // Test evaluateTrashRelease
        const mockEval: TrashEvaluateResponse = {
            message: "Evaluated",
            summary: {
                total_score: 100,
                additive_score: 100,
                negative_score: 0,
                active_profile_id: "trash_balanced",
                cutoff_reached: false,
                matched_formats: [
                    {
                        trash_id: "truehd_atmos",
                        name: "TrueHD Atmos",
                        category: "audio_advanced",
                        score: 100,
                        matched: true
                    }
                ],
                rejected_by_lq: false,
                rejection_reason: null
            }
        };

        globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.includes("/ranking/custom-formats/evaluate")) {
                const body = JSON.parse(init?.body as string);
                assert.equal(body.raw_title, "Movie.2024.TrueHD.Atmos");
                assert.equal(body.profile_id, "trash_balanced");
                return new Response(JSON.stringify(mockEval), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            throw new Error(`Unexpected url: ${url}`);
        };

        const evalRes = await evaluateTrashRelease({
            raw_title: "Movie.2024.TrueHD.Atmos",
            profile_id: "trash_balanced",
            is_anime: false,
            reject_negative_scores: false,
            reject_unwanted_sources: true
        });
        assert.equal(evalRes.summary.total_score, 100);
        assert.equal(evalRes.summary.matched_formats?.length, 1);
        assert.equal(evalRes.summary.matched_formats?.[0].name, "TrueHD Atmos");
        assert.equal(evalRes.summary.rejected_by_lq, false);

        // Test testRankingWithTrash
        const mockRankTest: RankingTestResponse = {
            message: "Success",
            fetch: true,
            aliases_used: false,
            accepted: true,
            rank: 1500,
            lev_ratio: 1.0,
            trash_summary: mockEval.summary
        };

        globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = input.toString();
            if (url.includes("/ranking/test")) {
                const body = JSON.parse(init?.body as string);
                assert.equal(body.evaluate_trash, true);
                assert.equal(body.trash_profile, "trash_balanced");
                return new Response(JSON.stringify(mockRankTest), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            throw new Error(`Unexpected url: ${url}`);
        };

        const rankRes = await testRankingWithTrash({
            raw_title: "Test.Movie.2024.TrueHD.Atmos",
            evaluate_trash: true,
            trash_profile: "trash_balanced",
            remove_trash: true,
            for_anime: false
        });
        assert.equal(rankRes.accepted, true);
        assert.equal(rankRes.rank, 1500);
        assert.equal(rankRes.trash_summary?.total_score, 100);

        // Test getFunnelSummary
        const mockFunnel: FunnelSummaryResponse = {
            message: "Funnel data",
            found: true,
            item_id: 123,
            found_count: 50,
            ranked: 40,
            new: 10,
            already_known: 0,
            blacklisted: 2,
            rtn_rejected: 5,
            content_filtered: 3
        };

        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("/ranking/funnel/123")) {
                return new Response(JSON.stringify(mockFunnel), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
            throw new Error(`Unexpected url: ${url}`);
        };

        const funnelRes = await getFunnelSummary(123);
        assert.equal(funnelRes.item_id, 123);
        assert.equal(funnelRes.found_count, 50);
        assert.equal(funnelRes.ranked, 40);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

// =========================================================================
// 3. Error Handling Contract Tests
// =========================================================================
{
    const originalFetch = globalThis.fetch;

    try {
        globalThis.fetch = async () => {
            return new Response(JSON.stringify({ detail: "Profile not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
            });
        };

        let threw = false;
        try {
            await evaluateTrashRelease({
                raw_title: "Bad.Title",
                profile_id: "nonexistent",
                is_anime: false,
                reject_negative_scores: false,
                reject_unwanted_sources: true
            });
        } catch (err: unknown) {
            threw = true;
            const message = err instanceof Error ? err.message : String(err);
            assert.ok(message.includes("404") || message.includes("Profile not found"));
        }
        assert.ok(threw, "Expected error on 404 response");
    } finally {
        globalThis.fetch = originalFetch;
    }
}

console.log("All TRaSH Guides Ranking Service & Heuristics Unit Tests Passed Successfully!");
