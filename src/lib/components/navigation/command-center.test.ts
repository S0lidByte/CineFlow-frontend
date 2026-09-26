/**
 * Comprehensive Unit Test Suite for CineFlow Universal Command Center (VIS-003).
 * Tests navigation catalogs, diagnostic actions, fuzzy scoring heuristics,
 * action filtering, badge formatters, and mock async API fetchers.
 */

import assert from "node:assert/strict";
import {
    getStaticNavigationItems,
    getDiagnosticActions,
    scoreMatch,
    filterActions,
    getStateBadgeVariant,
    formatItemDetails,
    formatTmdbDetails,
    formatOperationDetails,
    resolveItemHref,
    searchLibraryItems,
    searchTmdbCatalog,
    filterByCategory,
    type CommandActionItem,
    type CommandLibraryItem,
    type CommandTmdbItem,
    type UnifiedCommandItem
} from "./command-center";

console.log("Running Universal Command Center (VIS-003) Unit Tests...");

// =========================================================================
// 1. Static Navigation Catalog
// =========================================================================
{
    const navItems = getStaticNavigationItems();
    assert.ok(navItems.length >= 7, "Navigation catalog must have at least 7 primary routes");

    const ids = navItems.map((n) => n.id);
    assert.ok(ids.includes("nav-dashboard"), "Dashboard navigation must exist");
    assert.ok(ids.includes("nav-explore"), "Explore navigation must exist");
    assert.ok(ids.includes("nav-library"), "Library navigation must exist");
    assert.ok(ids.includes("nav-streams"), "Stream Monitor navigation must exist");
    assert.ok(ids.includes("nav-activity"), "Activity Timeline navigation must exist");
    assert.ok(ids.includes("nav-settings"), "Settings navigation must exist");
    assert.ok(ids.includes("nav-logs"), "System Logs navigation must exist");

    for (const item of navItems) {
        assert.equal(item.category, "navigation", "Item category must be navigation");
        assert.ok(item.title.length > 0, "Item must have a non-empty title");
        assert.ok(item.href?.startsWith("/"), "Item href must be a valid root-relative path");
        assert.ok(item.icon.length > 0, "Item must have an icon reference");
    }
}

// =========================================================================
// 2. Diagnostic Actions Catalog
// =========================================================================
{
    const diagActions = getDiagnosticActions();
    assert.ok(diagActions.length >= 6, "Diagnostic catalog must have at least 6 actions");

    const ids = diagActions.map((d) => d.id);
    assert.ok(ids.includes("diag-failed-outbox"), "Failed outbox diagnostic must exist");
    assert.ok(ids.includes("diag-processing-outbox"), "Processing outbox diagnostic must exist");
    assert.ok(ids.includes("diag-pending-outbox"), "Pending outbox diagnostic must exist");
    assert.ok(ids.includes("diag-streams"), "Stream telemetry shortcut must exist");
    assert.ok(ids.includes("diag-settings-ranking"), "Ranking Studio shortcut must exist");

    for (const item of diagActions) {
        assert.equal(item.category, "diagnostics", "Category must be diagnostics");
        assert.ok(item.title.length > 0, "Title must be non-empty");
        assert.ok(item.href?.startsWith("/"), "Href must be root-relative");
    }
}

// =========================================================================
// 3. Normalized Fuzzy Scoring (scoreMatch)
// =========================================================================
{
    // Exact match
    assert.equal(scoreMatch("Dashboard", "Dashboard"), 1.0, "Exact match score must be 1.0");
    assert.equal(
        scoreMatch("dashboard", "DASHBOARD"),
        1.0,
        "Case-insensitive exact match must be 1.0"
    );

    // Starts with
    assert.equal(scoreMatch("Dashboard", "dash"), 0.9, "Prefix match score must be 0.9");

    // Word boundary start
    assert.equal(scoreMatch("Stream Monitor", "monitor"), 0.8, "Word boundary start must be 0.8");
    assert.equal(
        scoreMatch("Activity & Outbox Timeline", "outbox"),
        0.8,
        "Word boundary start must be 0.8"
    );

    // Substring contains
    assert.equal(scoreMatch("Dashboard", "shboa"), 0.6, "Substring match score must be 0.6");

    // Acronym / subsequence match
    const smScore = scoreMatch("Stream Monitor", "sm");
    assert.ok(smScore >= 0.5, "Acronym 'sm' for 'Stream Monitor' must score >= 0.5");

    // Empty query returns 1.0
    assert.equal(scoreMatch("Any Target", ""), 1.0, "Empty query matches all");

    // Completely disjoint
    assert.equal(scoreMatch("Dashboard", "xyz123"), 0.0, "Disjoint query must return 0.0");
}

// =========================================================================
// 4. Action Filtering (filterActions)
// =========================================================================
{
    const navItems = getStaticNavigationItems();

    // Filtering by exact/near keyword
    const streamResults = filterActions(navItems, "stream");
    assert.ok(streamResults.length > 0, "Should find results for 'stream'");
    assert.equal(
        streamResults[0].id,
        "nav-streams",
        "Top result for 'stream' must be Stream Monitor"
    );

    const outboxResults = filterActions(navItems, "outbox");
    assert.ok(outboxResults.length > 0, "Should find results for 'outbox'");
    assert.equal(
        outboxResults[0].id,
        "nav-activity",
        "Top result for 'outbox' must be Activity Timeline"
    );

    const settingsResults = filterActions(navItems, "config");
    assert.ok(settingsResults.length > 0, "Keyword 'config' should match Settings");
    assert.equal(settingsResults[0].id, "nav-settings", "Top result for 'config' must be Settings");

    // Empty query returns all actions
    assert.equal(
        filterActions(navItems, "").length,
        navItems.length,
        "Empty query must return all actions"
    );

    // Non-matching query returns empty array
    assert.equal(
        filterActions(navItems, "zzzqwx999").length,
        0,
        "Nonsense query must return 0 results"
    );
}

// =========================================================================
// 5. Badge Variants & Formatters
// =========================================================================
{
    // getStateBadgeVariant
    assert.equal(getStateBadgeVariant("Completed"), "default", "Completed state maps to default");
    assert.equal(getStateBadgeVariant("Symlinked"), "default", "Symlinked state maps to default");
    assert.equal(getStateBadgeVariant("Failed"), "destructive", "Failed state maps to destructive");
    assert.equal(getStateBadgeVariant("Error"), "destructive", "Error state maps to destructive");
    assert.equal(getStateBadgeVariant("Processing"), "outline", "Processing state maps to outline");
    assert.equal(getStateBadgeVariant("Scraping"), "outline", "Scraping state maps to outline");
    assert.equal(getStateBadgeVariant("Requested"), "secondary", "Other states map to secondary");
    assert.equal(getStateBadgeVariant(null), "secondary", "Null state maps to secondary");

    // formatItemDetails
    const libItem: CommandLibraryItem = {
        id: "157336",
        riven_id: 42,
        title: "Interstellar",
        year: 2014,
        media_type: "movie",
        indexer: "tmdb",
        state: "Completed",
        category: "library"
    };
    const libDetails = formatItemDetails(libItem);
    assert.ok(libDetails.includes("Movie"), "Details must include Movie");
    assert.ok(libDetails.includes("2014"), "Details must include 2014");
    assert.ok(libDetails.includes("Completed"), "Details must include Completed");

    // formatTmdbDetails
    const tmdbItem: CommandTmdbItem = {
        id: 1399,
        title: "Game of Thrones",
        year: 2011,
        media_type: "tv",
        vote_average: 8.4,
        category: "tmdb"
    };
    const tmdbDetails = formatTmdbDetails(tmdbItem);
    assert.ok(tmdbDetails.includes("TV Series"), "Details must include TV Series");
    assert.ok(tmdbDetails.includes("2011"), "Details must include 2011");
    assert.ok(tmdbDetails.includes("★ 8.4"), "Details must include rating");

    // formatOperationDetails
    const opItem = {
        id: "op-123",
        operation_type: "scrape_media",
        status: "processing",
        correlation_id: "corr-abcd-1234-5678",
        category: "operations" as const
    };
    const opDetails = formatOperationDetails(opItem);
    assert.ok(opDetails.includes("scrape_media"), "Details must include operation type");
    assert.ok(opDetails.includes("PROCESSING"), "Details must include uppercase status");
    assert.ok(opDetails.includes("corr-abc"), "Details must include correlation prefix");

    // resolveItemHref
    assert.equal(resolveItemHref(libItem), "/details/media/157336/movie");
    assert.equal(resolveItemHref(tmdbItem), "/details/media/1399/show");
}

// =========================================================================
// 6. Async Search Providers (Mocks)
// =========================================================================
{
    // Mock fetch for library search
    const mockLibraryFetch: typeof fetch = async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("search=interstellar")) {
            return new Response(
                JSON.stringify({
                    items: [
                        {
                            id: 101,
                            type: "movie",
                            title: "Interstellar",
                            tmdb_id: 157336,
                            aired_at: "2014-11-05",
                            state: "Completed",
                            poster_path:
                                "https://image.tmdb.org/t/p/w200/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                        },
                        {
                            id: 102,
                            type: "show",
                            title: "Interstellar Odyssey",
                            tvdb_id: 88990,
                            aired_at: "2020-01-01",
                            state: "Scraped"
                        }
                    ]
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    const results = await searchLibraryItems("interstellar", undefined, mockLibraryFetch);
    assert.equal(results.length, 2, "Should return 2 library results");
    assert.equal(results[0].title, "Interstellar");
    assert.equal(results[0].media_type, "movie");
    assert.equal(results[0].year, 2014);
    assert.equal(results[0].id, "157336");
    assert.equal(results[1].title, "Interstellar Odyssey");
    assert.equal(results[1].media_type, "show");
    assert.equal(results[1].id, "88990");

    // Mock fetch for TMDB search
    const mockTmdbFetch: typeof fetch = async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("/api/tmdb/search/movie")) {
            return new Response(
                JSON.stringify({
                    results: [
                        {
                            id: 157336,
                            title: "Interstellar",
                            release_date: "2014-11-05",
                            vote_average: 8.4,
                            poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                        }
                    ]
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (urlStr.includes("/api/tmdb/search/tv")) {
            return new Response(
                JSON.stringify({
                    results: [
                        {
                            id: 60625,
                            name: "Rick and Morty",
                            first_air_date: "2013-12-02",
                            vote_average: 8.7,
                            poster_path: "/cvhNj9eoRBe5SxjUQURQT5CuK5q.jpg"
                        }
                    ]
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        return new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    const tmdbResults = await searchTmdbCatalog("any", undefined, mockTmdbFetch);
    assert.equal(tmdbResults.length, 2, "Should return merged movie and tv results");
    assert.equal(tmdbResults[0].title, "Interstellar");
    assert.equal(tmdbResults[0].media_type, "movie");
    assert.equal(tmdbResults[1].title, "Rick and Morty");
    assert.equal(tmdbResults[1].media_type, "tv");
}

// =========================================================================
// 7. Category Filter (filterByCategory)
// =========================================================================
{
    const navAction: CommandActionItem = {
        id: "nav-1",
        title: "Home",
        category: "navigation",
        icon: "Home"
    };
    const diagAction: CommandActionItem = {
        id: "diag-1",
        title: "Check",
        category: "diagnostics",
        icon: "Check"
    };
    const libItem: CommandLibraryItem = {
        id: "lib-1",
        riven_id: 1,
        title: "Movie",
        year: 2024,
        media_type: "movie",
        indexer: "tmdb",
        category: "library"
    };
    const tmdbItem: CommandTmdbItem = {
        id: 99,
        title: "Discover Show",
        year: 2025,
        media_type: "tv",
        category: "tmdb"
    };

    const unified: UnifiedCommandItem[] = [
        { type: "action", data: navAction },
        { type: "action", data: diagAction },
        { type: "library", data: libItem },
        { type: "tmdb", data: tmdbItem }
    ];

    assert.equal(filterByCategory(unified, "all").length, 4, "All category retains all items");
    assert.equal(
        filterByCategory(unified, "navigation").length,
        1,
        "Navigation category retains only nav actions"
    );
    assert.equal(
        filterByCategory(unified, "diagnostics").length,
        1,
        "Diagnostics category retains only diag actions"
    );
    assert.equal(
        filterByCategory(unified, "library").length,
        1,
        "Library category retains only library items"
    );
    assert.equal(
        filterByCategory(unified, "tmdb").length,
        1,
        "TMDB category retains only tmdb items"
    );
}

console.log("All Universal Command Center (VIS-003) Unit Tests Passed Successfully!");
