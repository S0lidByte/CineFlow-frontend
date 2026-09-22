/**
 * Comprehensive Unit Test Suite for Franchise Collection Sheet,
 * Statistics, Year Spans, Bulk Request Formatter, and Outcome Parsers.
 *
 * Run: corepack pnpm test (or vitest)
 */

import assert from "node:assert/strict";
import {
    getCollectionYearSpan,
    formatCollectionSummary,
    getUncollectedMovieIds,
    calculateCollectionStats,
    formatRequestButtonLabel,
    parseCollectionRequestOutcome
} from "./collection-details";
import type { CollectionMovie } from "$lib/providers/parser";
import type { AddItemsParsedResult } from "./riven/item-request-parser";

console.log("Running Franchise Collection Details & Bulk Request Unit Tests...");

// =========================================================================
// 1. Release Year Span & Summary Formatter
// =========================================================================
{
    // Empty / null / undefined parts
    assert.deepEqual(
        getCollectionYearSpan(null),
        { min: null, max: null, formatted: "" },
        "null parts returns empty span"
    );
    assert.deepEqual(
        getCollectionYearSpan([]),
        { min: null, max: null, formatted: "" },
        "empty parts returns empty span"
    );

    // Single movie
    const singlePart: CollectionMovie[] = [
        {
            id: 101,
            title: "Movie One",
            original_title: "Movie One",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2010-05-01",
            year: 2010,
            vote_average: 8.2,
            vote_count: 500
        }
    ];
    assert.deepEqual(
        getCollectionYearSpan(singlePart),
        { min: 2010, max: 2010, formatted: "2010" },
        "Single movie returns single year formatted"
    );
    assert.equal(
        formatCollectionSummary(singlePart.length, getCollectionYearSpan(singlePart).formatted),
        "1 Movie • 2010",
        "Single movie formats as '1 Movie • 2010'"
    );

    // Multiple movies across years
    const multiParts: CollectionMovie[] = [
        {
            id: 101,
            title: "Movie One",
            original_title: "Movie One",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2008-05-02",
            year: 2008,
            vote_average: 8.5,
            vote_count: 1000
        },
        {
            id: 102,
            title: "Movie Two",
            original_title: "Movie Two",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2010-05-07",
            year: 2010,
            vote_average: 7.9,
            vote_count: 800
        },
        {
            id: 103,
            title: "Movie Three",
            original_title: "Movie Three",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2012-05-04",
            year: 2012,
            vote_average: 8.8,
            vote_count: 1200
        }
    ];
    assert.deepEqual(
        getCollectionYearSpan(multiParts),
        { min: 2008, max: 2012, formatted: "2008–2012" },
        "Multi-movie list computes min-max span correctly"
    );
    assert.equal(
        formatCollectionSummary(multiParts.length, getCollectionYearSpan(multiParts).formatted),
        "3 Movies • 2008–2012",
        "Multi-movie list formats as '3 Movies • 2008–2012'"
    );

    // Movies with null/invalid years
    const invalidYearParts: CollectionMovie[] = [
        {
            id: 201,
            title: "Unreleased Movie",
            original_title: "Unreleased Movie",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: null,
            year: null,
            vote_average: null,
            vote_count: null
        }
    ];
    assert.deepEqual(
        getCollectionYearSpan(invalidYearParts),
        { min: null, max: null, formatted: "" },
        "Movie with null year returns empty span"
    );
    assert.equal(
        formatCollectionSummary(
            invalidYearParts.length,
            getCollectionYearSpan(invalidYearParts).formatted
        ),
        "1 Movie",
        "Format collection summary handles empty year span without trailing bullets"
    );
}

// =========================================================================
// 2. Uncollected Movie Filtering & Statistics
// =========================================================================
{
    const parts: CollectionMovie[] = [
        {
            id: 10,
            title: "Iron Man",
            original_title: "Iron Man",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2008-05-02",
            year: 2008,
            vote_average: 8.0,
            vote_count: 500
        },
        {
            id: 20,
            title: "Iron Man 2",
            original_title: "Iron Man 2",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2010-05-07",
            year: 2010,
            vote_average: 7.5,
            vote_count: 400
        },
        {
            id: 30,
            title: "Iron Man 3",
            original_title: "Iron Man 3",
            overview: null,
            poster_path: null,
            backdrop_path: null,
            release_date: "2013-05-03",
            year: 2013,
            vote_average: 7.8,
            vote_count: 600
        }
    ];

    // Case A: No existing items in library -> All uncollected
    const uncollectedNone = getUncollectedMovieIds(parts, null);
    assert.deepEqual(
        uncollectedNone,
        [10, 20, 30],
        "Null existing IDs returns all valid movie IDs"
    );

    const statsNone = calculateCollectionStats(parts, []);
    assert.deepEqual(
        statsNone,
        {
            totalCount: 3,
            collectedCount: 0,
            uncollectedCount: 3,
            percentage: 0
        },
        "0 collected movies returns 0% percentage"
    );

    // Case B: Partial items in library (e.g. ID 10 and ID 30 present as strings/numbers)
    const existingMixed = new Set(["10", 30]);
    const uncollectedPartial = getUncollectedMovieIds(parts, existingMixed);
    assert.deepEqual(uncollectedPartial, [20], "Only missing movie ID 20 is returned");

    const statsPartial = calculateCollectionStats(parts, existingMixed);
    assert.deepEqual(
        statsPartial,
        {
            totalCount: 3,
            collectedCount: 2,
            uncollectedCount: 1,
            percentage: 67
        },
        "2/3 collected movies returns 67% percentage"
    );

    // Case C: All items in library
    const existingAll = [10, "20", 30];
    const uncollectedAll = getUncollectedMovieIds(parts, existingAll);
    assert.deepEqual(uncollectedAll, [], "When all movies exist, uncollected list is empty");

    const statsAll = calculateCollectionStats(parts, existingAll);
    assert.deepEqual(
        statsAll,
        {
            totalCount: 3,
            collectedCount: 3,
            uncollectedCount: 0,
            percentage: 100
        },
        "All movies collected returns 100% percentage"
    );
}

// =========================================================================
// 3. Bulk Request Button Label Formatting
// =========================================================================
{
    // Loading state
    assert.equal(
        formatRequestButtonLabel(2, 3, true),
        "Requesting Movies...",
        "Loading state returns 'Requesting Movies...'"
    );

    // Empty collection
    assert.equal(
        formatRequestButtonLabel(0, 0, false),
        "No Movies in Collection",
        "0 total movies returns 'No Movies in Collection'"
    );

    // All collected
    assert.equal(
        formatRequestButtonLabel(0, 4, false),
        "All 4 Movies in Library",
        "0 uncollected returns 'All X Movies in Library'"
    );

    // None collected (Full bulk request)
    assert.equal(
        formatRequestButtonLabel(3, 3, false),
        "Request All (3 Movies)",
        "All uncollected returns 'Request All (3 Movies)'"
    );
    assert.equal(
        formatRequestButtonLabel(1, 1, false),
        "Request All (1 Movie)",
        "Single uncollected movie uses singular 'Movie'"
    );

    // Partial uncollected
    assert.equal(
        formatRequestButtonLabel(2, 5, false),
        "Request Uncollected (2 of 5 Movies)",
        "Partial uncollected returns 'Request Uncollected (2 of 5 Movies)'"
    );
}

// =========================================================================
// 4. Request Outcome Parsing
// =========================================================================
{
    // Case A: Successful addition of new items
    const parsedSuccess: AddItemsParsedResult = {
        success: true,
        addedCount: 3,
        requeuedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        message: "Added 3 new item(s)",
        toastMessage: "Media item requested successfully!"
    };
    const outcomeSuccess = parseCollectionRequestOutcome(parsedSuccess, 3);
    assert.equal(outcomeSuccess.success, true);
    assert.equal(outcomeSuccess.summary, "Added 3 item(s)");

    // Case B: Requeued existing items
    const parsedRequeued: AddItemsParsedResult = {
        success: true,
        addedCount: 0,
        requeuedCount: 2,
        skippedCount: 0,
        failedCount: 0,
        message: "Added 0 new item(s). requeued 2 existing item(s)",
        toastMessage: "Media item requeued!"
    };
    const outcomeRequeued = parseCollectionRequestOutcome(parsedRequeued, 2);
    assert.equal(outcomeRequeued.success, true);
    assert.equal(outcomeRequeued.summary, "Requeued 2 item(s)");

    // Case C: Mixed added and requeued
    const parsedMixed: AddItemsParsedResult = {
        success: true,
        addedCount: 2,
        requeuedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        message: "Added 2 new item(s). requeued 1 existing item(s)",
        toastMessage: "Media items processed (2 added, 1 requeued)!"
    };
    const outcomeMixed = parseCollectionRequestOutcome(parsedMixed, 3);
    assert.equal(outcomeMixed.success, true);
    assert.equal(outcomeMixed.summary, "Added 2, requeued 1");

    // Case D: Failure
    const parsedFailure: AddItemsParsedResult = {
        success: false,
        addedCount: 0,
        requeuedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        message: "1 TMDB ID(s) not found: 99999",
        toastMessage: "Failed to request media item."
    };
    const outcomeFailure = parseCollectionRequestOutcome(parsedFailure, 1);
    assert.equal(outcomeFailure.success, false);
}

console.log("All Franchise Collection Details Unit Tests Passed Successfully!");
