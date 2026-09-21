/**
 * Comprehensive Unit Test Suite for Episode Details Sheet, Deep Linking,
 * VFS/Direct-Stream Badge Contracts, and Media Metadata Helpers.
 *
 * Run: corepack pnpm test (or vitest)
 */

import assert from "node:assert/strict";
import {
    getVfsBadgeStatus,
    formatEpisodeSize,
    formatBitrate,
    getEpisodeDisplayTitle,
    parseEpisodeDeepLink,
    syncEpisodeDeepLink
} from "./episode-details";
import type { FilesystemEntry, RivenMediaItem } from "$lib/types/riven";
import type { ParsedShowDetails, TVDBEpisodeItem } from "$lib/providers/parser";

console.log("Running Episode Details Sheet & Canonical Contract Unit Tests...");

// =========================================================================
// 1. Canonical VFS & Direct Stream Status Badge Contract
// =========================================================================
{
    // Case A: available_in_vfs is true -> "vfs_mounted" (Physical VFS Mount)
    const fsVfsMounted: FilesystemEntry = {
        available_in_vfs: true,
        unrestricted_url: "https://real-debrid.com/d/XYZ123",
        original_filename: "Show.S01E01.1080p.mkv"
    };
    assert.equal(
        getVfsBadgeStatus(fsVfsMounted),
        "vfs_mounted",
        "available_in_vfs=true must return 'vfs_mounted'"
    );

    // Case B: available_in_vfs is false with unrestricted_url -> "direct_stream"
    const fsDirectStream: FilesystemEntry = {
        available_in_vfs: false,
        unrestricted_url: "https://real-debrid.com/d/XYZ123",
        original_filename: "Show.S01E01.1080p.mkv"
    };
    assert.equal(
        getVfsBadgeStatus(fsDirectStream),
        "direct_stream",
        "available_in_vfs=false with unrestricted_url must return 'direct_stream'"
    );

    // Case C: available_in_vfs is false with empty/null unrestricted_url -> "none"
    const fsNoStream: FilesystemEntry = {
        available_in_vfs: false,
        unrestricted_url: null,
        original_filename: "Show.S01E01.1080p.mkv"
    };
    assert.equal(
        getVfsBadgeStatus(fsNoStream),
        "none",
        "available_in_vfs=false without unrestricted_url must return 'none'"
    );

    const fsWhitespaceStream: FilesystemEntry = {
        available_in_vfs: false,
        unrestricted_url: "   ",
        original_filename: "Show.S01E01.1080p.mkv"
    };
    assert.equal(
        getVfsBadgeStatus(fsWhitespaceStream),
        "none",
        "available_in_vfs=false with whitespace unrestricted_url must return 'none'"
    );

    // Case D: null / undefined filesystem entry -> "none"
    assert.equal(getVfsBadgeStatus(null), "none", "null filesystem entry returns 'none'");
    assert.equal(getVfsBadgeStatus(undefined), "none", "undefined filesystem entry returns 'none'");

    // Case E: available_in_vfs undefined -> "none"
    const fsUndefinedVfs: FilesystemEntry = {
        original_filename: "Show.S01E01.1080p.mkv"
    };
    assert.equal(
        getVfsBadgeStatus(fsUndefinedVfs),
        "none",
        "Missing available_in_vfs returns 'none'"
    );
}

// =========================================================================
// 2. File Size & Bitrate Formatters
// =========================================================================
{
    // formatEpisodeSize
    assert.equal(formatEpisodeSize(null), "", "null size returns empty string");
    assert.equal(formatEpisodeSize(undefined), "", "undefined size returns empty string");
    assert.equal(formatEpisodeSize(0), "", "0 size returns empty string");
    assert.equal(formatEpisodeSize(-1024), "", "negative size returns empty string");
    assert.equal(formatEpisodeSize("invalid"), "", "invalid string returns empty string");

    // 1 GiB = 1073741824 bytes
    assert.equal(formatEpisodeSize(1073741824), "1.00 GB", "1073741824 bytes formats to 1.00 GB");
    // 2.5 GiB = 2684354560 bytes
    assert.equal(formatEpisodeSize(2684354560), "2.50 GB", "2684354560 bytes formats to 2.50 GB");
    // String number conversion
    assert.equal(
        formatEpisodeSize("3221225472"),
        "3.00 GB",
        "String number 3221225472 formats to 3.00 GB"
    );

    // formatBitrate
    assert.equal(formatBitrate(null), "", "null bitrate returns empty string");
    assert.equal(formatBitrate(undefined), "", "undefined bitrate returns empty string");
    assert.equal(formatBitrate(0), "", "0 bitrate returns empty string");
    assert.equal(formatBitrate(-500), "", "negative bitrate returns empty string");

    // >= 1,000,000 bps -> Mbps
    assert.equal(formatBitrate(18000000), "18 Mbps", "18000000 bps formats to 18 Mbps");
    assert.equal(formatBitrate(8450000), "8 Mbps", "8450000 bps formats to 8 Mbps");
    assert.equal(formatBitrate(1000000), "1 Mbps", "1000000 bps formats to 1 Mbps");

    // < 1,000,000 bps -> kbps
    assert.equal(formatBitrate(768000), "768 kbps", "768000 bps formats to 768 kbps");
    assert.equal(formatBitrate(128000), "128 kbps", "128000 bps formats to 128 kbps");
}

// =========================================================================
// 3. Episode Display Title Formatter
// =========================================================================
{
    // Full S/E with Name
    assert.equal(
        getEpisodeDisplayTitle({
            seasonNumber: 1,
            number: 5,
            name: "Ozymandias"
        }),
        "S1E5 - Ozymandias",
        "Full S/E with name formats as S1E5 - Ozymandias"
    );

    // Full S/E without Name
    assert.equal(
        getEpisodeDisplayTitle({
            seasonNumber: 2,
            number: 1,
            name: null
        }),
        "S2E1",
        "S/E without name formats as S2E1"
    );

    // Only Name (e.g., standalone special)
    assert.equal(
        getEpisodeDisplayTitle({
            seasonNumber: null,
            number: null,
            name: "Special Behind the Scenes"
        }),
        "Special Behind the Scenes",
        "Name only formats as standalone name"
    );

    // Fallback on null/empty
    assert.equal(
        getEpisodeDisplayTitle(null),
        "Episode Details",
        "null episode returns 'Episode Details'"
    );
    assert.equal(
        getEpisodeDisplayTitle({}),
        "Episode Details",
        "Empty episode returns 'Episode Details'"
    );
}

// =========================================================================
// 4. Bidirectional Deep Linking URL Parser & Sync Logic
// =========================================================================
{
    // Valid query string
    const query1 = "?season=2&episode=4";
    const parsed1 = parseEpisodeDeepLink(query1);
    assert.deepEqual(
        parsed1,
        { season: 2, episode: 4 },
        "Parses valid season and episode from query string"
    );

    // Valid URLSearchParams with extra params
    const params2 = new URLSearchParams("tab=overview&season=3&episode=12&ref=banner");
    const parsed2 = parseEpisodeDeepLink(params2);
    assert.deepEqual(
        parsed2,
        { season: 3, episode: 12 },
        "Parses season and episode while ignoring extra parameters"
    );

    // Invalid parameters
    assert.equal(parseEpisodeDeepLink("?season=1"), null, "Missing episode param returns null");
    assert.equal(parseEpisodeDeepLink("?episode=5"), null, "Missing season param returns null");
    assert.equal(
        parseEpisodeDeepLink("?season=abc&episode=2"),
        null,
        "Non-numeric season returns null"
    );
    assert.equal(
        parseEpisodeDeepLink("?season=1&episode=xyz"),
        null,
        "Non-numeric episode returns null"
    );
    assert.equal(
        parseEpisodeDeepLink("?season=-1&episode=2"),
        null,
        "Negative season returns null"
    );
    assert.equal(parseEpisodeDeepLink("?season=1.5&episode=2"), null, "Float season returns null");

    // Deep link synchronization - Set Selection
    const baseParams = new URLSearchParams("view=grid&sort=desc");
    const updated = syncEpisodeDeepLink(baseParams, { season: 2, episode: 8 });
    assert.equal(updated.get("season"), "2", "syncEpisodeDeepLink sets season query param");
    assert.equal(updated.get("episode"), "8", "syncEpisodeDeepLink sets episode query param");
    assert.equal(
        updated.get("view"),
        "grid",
        "syncEpisodeDeepLink preserves existing query params"
    );
    assert.equal(
        updated.get("sort"),
        "desc",
        "syncEpisodeDeepLink preserves all existing query params"
    );

    // Deep link synchronization - Clear Selection
    const cleared = syncEpisodeDeepLink(updated, null);
    assert.equal(cleared.has("season"), false, "Clearing deep link removes season param");
    assert.equal(cleared.has("episode"), false, "Clearing deep link removes episode param");
    assert.equal(cleared.get("view"), "grid", "Clearing deep link preserves existing params");
    assert.equal(cleared.get("sort"), "desc", "Clearing deep link preserves existing params");
}

// =========================================================================
// 5. Episode Matching & Resolution from Show Details & Riven Media Item
// =========================================================================
{
    const mockShow: ParsedShowDetails = {
        id: 1234,
        type: "show",
        title: "CineFlow Breaking Bad",
        original_title: "Breaking Bad",
        original_language: "en",
        overview: "A chemistry teacher turned manufacturer.",
        tagline: "Remember my name",
        status: "Ended",
        release_date: "2008-01-20",
        end_date: "2013-09-29",
        next_air_date: null,
        year: 2008,
        runtime: 47,
        formatted_runtime: "47m",
        homepage: null,
        backdrop_path: null,
        poster_path: null,
        logo: null,
        trailer: null,
        certification: "TV-MA",
        genres: [
            { id: 1, name: "Drama" },
            { id: 2, name: "Crime" }
        ],
        cast: [],
        crew: [],
        origin_country: ["US"],
        spoken_languages: [{ english_name: "English", iso_639_1: "en", name: "English" }],
        production_companies: [],
        production_countries: [{ iso_3166_1: "US", name: "United States" }],
        recommendations: [],
        similar: [],
        score: 9.5,
        imdb_id: "tt0903747",
        external_ids: { tvdb: "81189" },
        airing: { time: "21:00", days: ["Sunday"] },
        episode_count: 3,
        season_count: 2,
        seasons: [
            {
                id: 101,
                seriesId: 1234,
                type: null,
                number: 1,
                nameTranslations: ["Season 1"],
                overviewTranslations: null,
                image: "s1.jpg",
                imageType: null,
                companies: null,
                lastUpdated: null
            },
            {
                id: 102,
                seriesId: 1234,
                type: null,
                number: 2,
                nameTranslations: ["Season 2"],
                overviewTranslations: null,
                image: "s2.jpg",
                imageType: null,
                companies: null,
                lastUpdated: null
            }
        ],
        episodes: [
            {
                id: 1001,
                seriesId: 1234,
                seasonNumber: 1,
                number: 1,
                name: "Pilot",
                overview: "Walter White is diagnosed.",
                image: "s1e1.jpg",
                aired: "2008-01-20",
                runtime: 58,
                nameTranslations: null,
                overviewTranslations: null,
                imageType: 1,
                isMovie: 0,
                seasons: null,
                absoluteNumber: 1,
                lastUpdated: "2023-01-01",
                finaleType: null,
                year: "2008"
            },
            {
                id: 1002,
                seriesId: 1234,
                seasonNumber: 1,
                number: 2,
                name: "Cat's in the Bag...",
                overview: "Disposing of the evidence.",
                image: "s1e2.jpg",
                aired: "2008-01-27",
                runtime: 48,
                nameTranslations: null,
                overviewTranslations: null,
                imageType: 1,
                isMovie: 0,
                seasons: null,
                absoluteNumber: 2,
                lastUpdated: "2023-01-01",
                finaleType: null,
                year: "2008"
            },
            {
                id: 2001,
                seriesId: 1234,
                seasonNumber: 2,
                number: 1,
                name: "Seven Thirty-Seven",
                overview: "Calculating the quota.",
                image: "s2e1.jpg",
                aired: "2009-03-08",
                runtime: 47,
                nameTranslations: null,
                overviewTranslations: null,
                imageType: 1,
                isMovie: 0,
                seasons: null,
                absoluteNumber: 8,
                lastUpdated: "2023-01-01",
                finaleType: null,
                year: "2009"
            }
        ],
        networks: [],
        content_ratings: []
    };

    const mockRivenItem: RivenMediaItem = {
        id: 500,
        state: "Downloaded",
        seasons: [
            {
                id: 501,
                season_number: 1,
                state: "Downloaded",
                episodes: [
                    {
                        id: 5001,
                        episode_number: 1,
                        state: "Completed",
                        filesystem_entry: {
                            available_in_vfs: true,
                            unrestricted_url: "https://rd.com/s1e1.mkv",
                            original_filename: "Breaking.Bad.S01E01.1080p.mkv"
                        },
                        media_metadata: {
                            filename: "Breaking.Bad.S01E01.1080p.mkv",
                            bitrate: 8500000,
                            video: {
                                codec: "hevc",
                                resolution_width: 1920,
                                resolution_height: 1080
                            },
                            audio_tracks: [
                                {
                                    codec: "eac3",
                                    channels: 6,
                                    language: "eng"
                                }
                            ]
                        }
                    },
                    {
                        id: 5002,
                        episode_number: 2,
                        state: "Downloading",
                        filesystem_entry: {
                            available_in_vfs: false,
                            unrestricted_url: "https://rd.com/s1e2.mkv"
                        }
                    }
                ]
            }
        ]
    };

    // Match S1E1
    const ep1 = mockShow.episodes.find((e) => e.seasonNumber === 1 && e.number === 1);
    assert.equal(ep1?.name, "Pilot", "Finds matching TVDB episode S1E1");

    const rivenS1 = mockRivenItem.seasons?.find((s) => s.season_number === 1);
    const rivenEp1 = rivenS1?.episodes?.find((e) => e.episode_number === 1);
    assert.equal(rivenEp1?.id, 5001, "Finds matching Riven episode S1E1");
    assert.equal(rivenEp1?.state, "Completed", "Riven episode S1E1 state is Completed");
    assert.equal(
        getVfsBadgeStatus(rivenEp1?.filesystem_entry),
        "vfs_mounted",
        "Riven episode S1E1 has 'vfs_mounted' badge"
    );

    // Match S1E2
    const ep2 = mockShow.episodes.find((e) => e.seasonNumber === 1 && e.number === 2);
    assert.equal(ep2?.name, "Cat's in the Bag...", "Finds matching TVDB episode S1E2");

    const rivenEp2 = rivenS1?.episodes?.find((e) => e.episode_number === 2);
    assert.equal(rivenEp2?.id, 5002, "Finds matching Riven episode S1E2");
    assert.equal(rivenEp2?.state, "Downloading", "Riven episode S1E2 state is Downloading");
    assert.equal(
        getVfsBadgeStatus(rivenEp2?.filesystem_entry),
        "direct_stream",
        "Riven episode S1E2 has 'direct_stream' badge"
    );

    // Out of bounds season / episode
    const ep99 = mockShow.episodes.find((e) => e.seasonNumber === 1 && e.number === 99);
    assert.equal(ep99, undefined, "Non-existent episode 99 returns undefined");
}

// =========================================================================
// 6. Episode Details Sheet State Lifecycle & Deep-Link Synchronization
// =========================================================================
{
    // Simulate state machine transitions for Episode Details Sheet
    interface EpisodeSheetState {
        isOpen: boolean;
        selection: { episode: TVDBEpisodeItem; rivenEpisode?: unknown } | null;
        queryParams: URLSearchParams;
    }

    const state: EpisodeSheetState = {
        isOpen: false,
        selection: null,
        queryParams: new URLSearchParams()
    };

    function openEpisode(ep: TVDBEpisodeItem, rivenEp?: unknown) {
        state.selection = { episode: ep, rivenEpisode: rivenEp };
        state.isOpen = true;
        if (ep.seasonNumber != null && ep.number != null) {
            state.queryParams = syncEpisodeDeepLink(state.queryParams, {
                season: ep.seasonNumber,
                episode: ep.number
            });
        }
    }

    function closeEpisode() {
        state.isOpen = false;
        state.selection = null;
        state.queryParams = syncEpisodeDeepLink(state.queryParams, null);
    }

    // Step 1: Initial state is closed
    assert.equal(state.isOpen, false, "Initial sheet state is closed");
    assert.equal(state.selection, null, "Initial selection is null");
    assert.equal(state.queryParams.toString(), "", "Initial query params are empty");

    // Step 2: Open episode S1E1
    const testEp: TVDBEpisodeItem = {
        id: 1001,
        seriesId: 1234,
        seasonNumber: 1,
        number: 1,
        name: "Pilot",
        overview: "Walter White is diagnosed.",
        image: "s1e1.jpg",
        aired: "2008-01-20",
        runtime: 58,
        nameTranslations: null,
        overviewTranslations: null,
        imageType: 1,
        isMovie: 0,
        seasons: null,
        absoluteNumber: 1,
        lastUpdated: "2023-01-01",
        finaleType: null,
        year: "2008"
    };

    openEpisode(testEp);
    assert.equal(state.isOpen, true, "Opening episode sets isOpen to true");
    const activeSel = state.selection as { episode: TVDBEpisodeItem } | null;
    assert.equal(activeSel?.episode.id, 1001, "Selection has episode ID 1001");
    assert.equal(state.queryParams.get("season"), "1", "Deep-link season query parameter is 1");
    assert.equal(state.queryParams.get("episode"), "1", "Deep-link episode query parameter is 1");

    // Step 3: Close episode sheet
    closeEpisode();
    assert.equal(state.isOpen, false, "Closing episode sets isOpen to false");
    assert.equal(state.selection, null, "Closing episode resets selection to null");
    assert.equal(state.queryParams.has("season"), false, "Closing episode removes season param");
    assert.equal(state.queryParams.has("episode"), false, "Closing episode removes episode param");

    // Step 4: Validate reactive sync when URL has no deep link
    const parsedFromEmpty = parseEpisodeDeepLink(state.queryParams.toString());
    assert.equal(parsedFromEmpty, null, "Parsed deep link is null after close");
}

console.log("All Episode Details Sheet & Canonical Contract Unit Tests passed successfully!");
