/**
 * Comprehensive Unit Test Suite for Ratings Matcher: Jaro Similarity, Title Distance,
 * Release Year Penalties, Best RT Match Ranking, and Badge Formatters.
 *
 * Conforms to the CineFlow frontend test harness pattern.
 */

import assert from "node:assert/strict";
import {
    jaroSimilarity,
    titleSimilarity,
    getTitleScore,
    getYearScore,
    getExtraScore,
    calculateScore,
    findBestRTMatch,
    formatRTCriticsScore,
    formatRTAudienceScore,
    formatImdbScore,
    formatTmdbScore,
    INEXACT_TITLE_FACTOR,
    ALTERNATE_TITLE_FACTOR,
    PER_YEAR_PENALTY,
    MINIMUM_SCORE,
    type RTAlgoliaHit
} from "./ratings-matcher";

console.log("Running Ratings Matcher & Jaro-Winkler Heuristics Unit Tests...");

// =========================================================================
// 1. Jaro Similarity Metric & Constant Exports
// =========================================================================
{
    // Constant invariants
    assert.equal(INEXACT_TITLE_FACTOR, 0.25, "Inexact title factor must be 0.25");
    assert.equal(ALTERNATE_TITLE_FACTOR, 0.8, "Alternate title factor must be 0.8");
    assert.equal(PER_YEAR_PENALTY, 0.4, "Per year penalty must be 0.4");
    assert.equal(MINIMUM_SCORE, 0.175, "Minimum acceptance threshold must be 0.175");

    // Identical strings
    assert.equal(jaroSimilarity("interstellar", "interstellar"), 1, "Identical strings return 1.0");
    assert.equal(jaroSimilarity("", ""), 1, "Both empty strings return 1.0");

    // Empty vs non-empty
    assert.equal(jaroSimilarity("oppenheimer", ""), 0, "Empty second string returns 0.0");
    assert.equal(jaroSimilarity("", "oppenheimer"), 0, "Empty first string returns 0.0");

    // Completely disjoint
    assert.equal(jaroSimilarity("abc", "xyz"), 0, "Disjoint characters return 0.0");

    // Symmetry
    const s1 = "martha";
    const s2 = "marhta";
    const diff = Math.abs(jaroSimilarity(s1, s2) - jaroSimilarity(s2, s1));
    assert.ok(diff < 1e-6, "Jaro similarity must be symmetric");

    // Transpositions
    const transpositionScore = jaroSimilarity("martha", "marhta");
    const expected = 17 / 18; // ~0.9444
    assert.ok(
        Math.abs(transpositionScore - expected) < 1e-4,
        `Expected ~0.9444 for martha vs marhta, got ${transpositionScore}`
    );

    // Multi-word titles
    const jaroMulti = jaroSimilarity("the dark knight", "dark knight");
    assert.ok(jaroMulti > 0.7 && jaroMulti < 1.0, "Multi-word Jaro in expected range");

    // Unicode titles
    assert.equal(
        jaroSimilarity("千と千尋の神隠し", "千と千尋の神隠し"),
        1,
        "Unicode exact match returns 1.0"
    );
}

// =========================================================================
// 2. Title Similarity & Multi-Variant Title Scoring
// =========================================================================
{
    // Exact match
    assert.equal(titleSimilarity("inception", "inception"), 1, "Exact title similarity is 1.0");

    // Inexact penalty
    const jaro = jaroSimilarity("inception", "inceptions");
    const similarity = titleSimilarity("inception", "inceptions");
    assert.ok(
        Math.abs(similarity - jaro * INEXACT_TITLE_FACTOR) < 1e-6,
        "Inexact title similarity applies INEXACT_TITLE_FACTOR (0.25)"
    );

    // Primary title vs aliases
    const hit: RTAlgoliaHit = {
        title: "Blade Runner 2049",
        aka: ["BR 2049", "Blade Runner 2"],
        titles: ["Blade Runner 2049 (IMAX)"],
        releaseYear: 2017,
        vanity: "blade_runner_2049"
    };

    assert.equal(
        getTitleScore(hit, "Blade Runner 2049"),
        1.0,
        "Primary exact match gets score 1.0"
    );

    const aliasHit: RTAlgoliaHit = {
        title: "Original Title",
        aka: ["Blade Runner 2049"],
        releaseYear: 2017,
        vanity: "original_title"
    };
    assert.equal(
        getTitleScore(aliasHit, "Blade Runner 2049"),
        1.0 * ALTERNATE_TITLE_FACTOR,
        "Alias exact match gets ALTERNATE_TITLE_FACTOR (0.8)"
    );
}

// =========================================================================
// 3. Year Distance Penalties & Extra Score
// =========================================================================
{
    const mockHit = (year: number, hasRT = true): RTAlgoliaHit => ({
        title: "Dune",
        releaseYear: year,
        vanity: "dune",
        ...(hasRT
            ? {
                  rottenTomatoes: {
                      criticsScore: 83,
                      certifiedFresh: true,
                      audienceScore: 90
                  }
              }
            : {})
    });

    // Exact year
    assert.equal(getYearScore(mockHit(2021), 2021), 1.0, "Exact year delta 0 is 1.0");

    // Delta = 1 year -> 0.6
    assert.ok(Math.abs(getYearScore(mockHit(2020), 2021) - 0.6) < 1e-4, "Delta 1 is 0.6");
    assert.ok(Math.abs(getYearScore(mockHit(2022), 2021) - 0.6) < 1e-4, "Delta 1 is 0.6");

    // Delta = 2 years -> 0.2
    assert.ok(Math.abs(getYearScore(mockHit(2019), 2021) - 0.2) < 1e-4, "Delta 2 is 0.2");

    // Delta >= 3 years -> 0.0
    assert.equal(getYearScore(mockHit(1984), 2021), 0.0, "Delta >= 3 years is 0.0");

    // Missing year fallback
    assert.equal(getYearScore(mockHit(2021), undefined), 1.0, "Undefined target year returns 1.0");
    assert.equal(
        getYearScore({ ...mockHit(2021), releaseYear: NaN }, 2021),
        1.0,
        "NaN releaseYear returns 1.0"
    );

    // Extra score (with vs without RT object)
    assert.equal(getExtraScore(mockHit(2021, true)), 1.0, "With RT score is 1.0");
    assert.equal(getExtraScore(mockHit(2021, false)), 0.5, "Without RT score is 0.5");

    // Composite calculation
    const compScore = calculateScore(mockHit(2021, true), "Dune", 2021);
    assert.equal(compScore, 1.0, "Perfect candidate gets 1.0");
}

// =========================================================================
// 4. Best Match Selection & Threshold Verification
// =========================================================================
{
    // Remake vs original disambiguation
    const dune1984: RTAlgoliaHit = {
        title: "Dune",
        releaseYear: 1984,
        vanity: "dune_1984",
        rottenTomatoes: { criticsScore: 44, certifiedFresh: false, audienceScore: 65 }
    };

    const dune2021: RTAlgoliaHit = {
        title: "Dune",
        releaseYear: 2021,
        vanity: "dune_2021",
        rottenTomatoes: { criticsScore: 83, certifiedFresh: true, audienceScore: 90 }
    };

    const match2021 = findBestRTMatch([dune1984, dune2021], "Dune", 2021);
    assert.equal(match2021?.vanity, "dune_2021", "2021 target year correctly matches 2021 remake");

    const match1984 = findBestRTMatch([dune1984, dune2021], "Dune", 1984);
    assert.equal(match1984?.vanity, "dune_1984", "1984 target year correctly matches 1984 classic");

    // Threshold rejection (< 0.175)
    const irrelevantHit: RTAlgoliaHit = {
        title: "Completely Different Title",
        releaseYear: 1990,
        vanity: "diff",
        rottenTomatoes: { criticsScore: 50, certifiedFresh: false, audienceScore: 50 }
    };
    assert.equal(
        findBestRTMatch([irrelevantHit], "Interstellar", 2014),
        null,
        "Irrelevant candidate is rejected by MINIMUM_SCORE"
    );

    // Acceptance above threshold: Exact title (1.0) * 2 yr delta (0.2) * extra (1.0) = 0.200 > 0.175
    const acceptedHit: RTAlgoliaHit = {
        title: "Sample Movie",
        releaseYear: 2019,
        vanity: "sample_accepted",
        rottenTomatoes: { criticsScore: 80, certifiedFresh: false, audienceScore: 80 }
    };
    const match = findBestRTMatch([acceptedHit], "Sample Movie", 2021);
    assert.equal(match?.vanity, "sample_accepted", "Score > 0.175 is accepted");

    // Empty array
    assert.equal(findBestRTMatch([], "The Matrix", 1999), null, "Empty array returns null");
}

// =========================================================================
// 5. Rating Badge Formatters & Classification
// =========================================================================
{
    // RT Critics: Certified Fresh for movies
    const topGunHit: RTAlgoliaHit = {
        title: "Top Gun: Maverick",
        releaseYear: 2022,
        vanity: "top_gun_maverick",
        rottenTomatoes: { criticsScore: 96, certifiedFresh: true, audienceScore: 99 }
    };
    assert.deepEqual(formatRTCriticsScore(topGunHit, "movie"), {
        name: "rt_tomatometer_certified_fresh",
        image: "rt_certified_fresh.svg",
        score: "96%",
        url: "https://www.rottentomatoes.com/m/top_gun_maverick"
    });

    // RT Critics: Regular Fresh (score >= 60, not certified)
    const freshHit: RTAlgoliaHit = {
        title: "Action Movie",
        releaseYear: 2023,
        vanity: "action_movie",
        rottenTomatoes: { criticsScore: 68, certifiedFresh: false, audienceScore: 72 }
    };
    assert.deepEqual(formatRTCriticsScore(freshHit, "movie"), {
        name: "rt_tomatometer_fresh",
        image: "rt_fresh.svg",
        score: "68%",
        url: "https://www.rottentomatoes.com/m/action_movie"
    });

    // RT Critics: TV series never certified fresh
    const tvHit: RTAlgoliaHit = {
        title: "Severance",
        releaseYear: 2022,
        vanity: "severance",
        rottenTomatoes: { criticsScore: 97, certifiedFresh: true, audienceScore: 93 }
    };
    const tvBadge = formatRTCriticsScore(tvHit, "tv");
    assert.equal(tvBadge?.name, "rt_tomatometer_fresh");
    assert.equal(tvBadge?.image, "rt_fresh.svg");
    assert.equal(tvBadge?.url, "https://www.rottentomatoes.com/tv/severance");

    // RT Critics: Rotten (< 60)
    const rottenHit: RTAlgoliaHit = {
        title: "Flop Movie",
        releaseYear: 2020,
        vanity: "flop_movie",
        rottenTomatoes: { criticsScore: 35, certifiedFresh: false, audienceScore: 40 }
    };
    assert.deepEqual(formatRTCriticsScore(rottenHit, "movie"), {
        name: "rt_tomatometer_rotten",
        image: "rt_rotten.svg",
        score: "35%",
        url: "https://www.rottentomatoes.com/m/flop_movie"
    });

    // RT Audience: Popcornmeter Fresh (>= 60) vs Stale (< 60)
    assert.deepEqual(formatRTAudienceScore(freshHit, "movie"), {
        name: "rt_popcornmeter_fresh",
        image: "rt_aud_fresh.svg",
        score: "72%",
        url: "https://www.rottentomatoes.com/m/action_movie"
    });

    assert.deepEqual(formatRTAudienceScore(rottenHit, "movie"), {
        name: "rt_popcornmeter_stale",
        image: "rt_aud_rotten.svg",
        score: "40%",
        url: "https://www.rottentomatoes.com/m/flop_movie"
    });

    // Zero / Missing scores return null
    const unratedHit: RTAlgoliaHit = {
        title: "Unrated",
        releaseYear: 2024,
        vanity: "unrated",
        rottenTomatoes: { criticsScore: 0, certifiedFresh: false, audienceScore: 0 }
    };
    assert.equal(formatRTCriticsScore(unratedHit, "movie"), null);
    assert.equal(formatRTAudienceScore(unratedHit, "movie"), null);

    // IMDb and TMDB badges
    assert.deepEqual(formatImdbScore("tt0816692", 8.7), {
        name: "imdb",
        image: "imdb.svg",
        score: 8.7,
        url: "https://www.imdb.com/title/tt0816692/"
    });
    assert.equal(formatImdbScore("tt0816692", 0), null);

    assert.deepEqual(formatTmdbScore(157336, "movie", 8.432), {
        name: "tmdb",
        image: "tmdb.svg",
        score: "84%",
        url: "https://www.themoviedb.org/movie/157336"
    });
    assert.equal(formatTmdbScore(157336, "movie", 0), null);
}

console.log("All Ratings Matcher & Jaro-Winkler Heuristics Unit Tests passed successfully!");
