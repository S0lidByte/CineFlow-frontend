/**
 * Comprehensive Unit Test Suite for CineFlow Calendar Service (CAL-001).
 * Conforms to node:assert runner pattern in scripts/run_tests.ts.
 */

import assert from "node:assert/strict";
import { CalendarDate } from "@internationalized/date";
import {
    getAirDateCountdown,
    getLibraryStatusBadge,
    executeQuickRequest,
    type CalendarMediaCandidate
} from "./calendar";
import providers from "$lib/providers";

console.log("Running Calendar Service & Release Tracking Unit Tests (CAL-001)...");

// =========================================================================
// 1. Air Date Countdown Heuristics
// =========================================================================
{
    const today = new CalendarDate(2025, 6, 15);

    // Today
    const resToday = getAirDateCountdown(new CalendarDate(2025, 6, 15), today);
    assert.equal(resToday.label, "Today");
    assert.equal(resToday.urgency, "today");
    assert.equal(resToday.diffDays, 0);

    // Tomorrow
    const resTomorrow = getAirDateCountdown(new CalendarDate(2025, 6, 16), today);
    assert.equal(resTomorrow.label, "Tomorrow");
    assert.equal(resTomorrow.urgency, "tomorrow");
    assert.equal(resTomorrow.diffDays, 1);

    // Future
    const resFuture = getAirDateCountdown(new CalendarDate(2025, 6, 25), today);
    assert.equal(resFuture.label, "In 10d");
    assert.equal(resFuture.urgency, "upcoming");
    assert.equal(resFuture.diffDays, 10);

    // Yesterday
    const resYesterday = getAirDateCountdown(new CalendarDate(2025, 6, 14), today);
    assert.equal(resYesterday.label, "Yesterday");
    assert.equal(resYesterday.urgency, "past");
    assert.equal(resYesterday.diffDays, -1);

    // Past
    const resPast = getAirDateCountdown(new CalendarDate(2025, 6, 5), today);
    assert.equal(resPast.label, "10d ago");
    assert.equal(resPast.urgency, "past");
    assert.equal(resPast.diffDays, -10);
}

// =========================================================================
// 2. Declarative State & Library Presence Mapping
// =========================================================================
{
    // Completed
    const bCompleted = getLibraryStatusBadge("Completed");
    assert.equal(bCompleted.label, "In Library");
    assert.equal(bCompleted.variant, "success");
    assert.equal(bCompleted.inLibrary, true);
    assert.equal(bCompleted.canRequest, false);

    // Downloaded / Symlinked
    const bDownloaded = getLibraryStatusBadge("Downloaded");
    assert.equal(bDownloaded.label, "Downloaded");
    assert.equal(bDownloaded.variant, "success");
    assert.equal(bDownloaded.inLibrary, true);

    const bSymlinked = getLibraryStatusBadge("Symlinked");
    assert.equal(bSymlinked.label, "Downloaded");
    assert.equal(bSymlinked.inLibrary, true);

    // PartiallyCompleted
    const bPartial = getLibraryStatusBadge("PartiallyCompleted");
    assert.equal(bPartial.label, "Partial");
    assert.equal(bPartial.variant, "warning");
    assert.equal(bPartial.inLibrary, true);
    assert.equal(bPartial.canRequest, true);

    // In-flight pipeline (Scraped, Indexed)
    const bScraped = getLibraryStatusBadge("Scraped");
    assert.equal(bScraped.label, "Processing");
    assert.equal(bScraped.variant, "info");
    assert.equal(bScraped.inLibrary, false);
    assert.equal(bScraped.canRequest, false);

    // Queued (Requested, Ongoing)
    const bRequested = getLibraryStatusBadge("Requested");
    assert.equal(bRequested.label, "Queued");
    assert.equal(bRequested.variant, "warning");
    assert.equal(bRequested.inLibrary, false);

    // Failed
    const bFailed = getLibraryStatusBadge("Failed");
    assert.equal(bFailed.label, "Failed");
    assert.equal(bFailed.variant, "destructive");
    assert.equal(bFailed.inLibrary, false);
    assert.equal(bFailed.canRequest, true);

    // Unreleased
    const bUnreleased = getLibraryStatusBadge("Unreleased");
    assert.equal(bUnreleased.label, "Unreleased");
    assert.equal(bUnreleased.variant, "neutral");
    assert.equal(bUnreleased.canRequest, true);

    // Fallbacks
    const bFallback = getLibraryStatusBadge(null);
    assert.equal(bFallback.label, "Not in Library");
    assert.equal(bFallback.variant, "neutral");
    assert.equal(bFallback.inLibrary, false);
    assert.equal(bFallback.canRequest, true);
}

// =========================================================================
// 3. Quick Request Dispatcher
// =========================================================================
{
    const originalPost = providers.riven.POST;

    try {
        // Success case
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (providers.riven as any).POST = async (url: string, opts: any) => {
            assert.equal(url, "/api/v1/items/add");
            assert.equal(opts.body.media_type, "movie");
            assert.deepEqual(opts.body.tmdb_ids, ["550"]);
            return {
                data: { message: "Added 1 new item(s)" },
                error: undefined,
                response: new Response()
            };
        };

        const candidate: CalendarMediaCandidate = {
            item_id: 101,
            tmdb_id: 550,
            item_type: "movie",
            show_title: "Fight Club"
        };

        const result = await executeQuickRequest(candidate);
        assert.equal(result.success, true);
        assert.equal(result.addedCount, 1);
        assert.ok(result.toastMessage.includes("Media item requested successfully"));

        // Error handling case
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (providers.riven as any).POST = async () => {
            throw new Error("Network timeout");
        };

        const errResult = await executeQuickRequest(candidate);
        assert.equal(errResult.success, false);
        assert.ok(errResult.toastMessage.includes("Network timeout"));
    } finally {
        providers.riven.POST = originalPost;
    }
}

console.log("All Calendar Service & Release Tracking Unit Tests Passed Successfully!");
