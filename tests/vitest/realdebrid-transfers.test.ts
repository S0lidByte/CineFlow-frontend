import { expect, test } from "vitest";
import { render } from "svelte/server";
import RealDebridTransfersPanel from "../../src/lib/components/activity/realdebrid-transfers-panel.svelte";
import {
    RealDebridTransfersStore,
    type RealDebridTransferItem
} from "../../src/lib/stores/realdebrid-transfers.svelte";

test("RealDebridTransfersPanel renders summary stats and accessible tabs", () => {
    const { body } = render(RealDebridTransfersPanel);

    // Verify summary statistics cards
    expect(body).toContain("Active Downloads");
    expect(body).toContain("Queued");
    expect(body).toContain("RD Completed");
    expect(body).toContain("Failed");
    expect(body).toContain("Active Slot Usage");

    // Verify accessible tablist and status filters
    expect(body).toContain('role="tablist"');
    expect(body).toContain("rd-status-tab-all");
    expect(body).toContain("rd-status-tab-active");
    expect(body).toContain("rd-status-tab-queued");
    expect(body).toContain("rd-status-tab-downloaded");
    expect(body).toContain("rd-status-tab-failed");

    // Verify search and refresh controls
    expect(body).toContain('placeholder="Search by filename, hash, or title..."');
    expect(body).toContain("Refresh");

    // Verify NO unsupported Pause/Resume controls exist
    expect(body).not.toContain("Pause");
    expect(body).not.toContain("Resume");
});

test("RealDebridTransfersStore correctly distinguishes RD Downloaded from Ready in CineFlow", () => {
    const store = new RealDebridTransfersStore();

    const readyItem: RealDebridTransferItem = {
        id: "rd-1",
        filename: "Movie.Ready.2024.mkv",
        hash: "hash1",
        bytes: 1000,
        progress: 100.0,
        status: "downloaded",
        added: "2026-11-07T12:00:00Z",
        links: [],
        is_cineflow_managed: true,
        media_item_id: 1,
        media_title: "Ready Movie",
        media_state: "Completed",
        ready_in_cineflow: true,
        can_cancel: false,
        can_retry: false
    };

    const notReadyItem: RealDebridTransferItem = {
        id: "rd-2",
        filename: "Movie.Pending.2024.mkv",
        hash: "hash2",
        bytes: 1000,
        progress: 100.0,
        status: "downloaded",
        added: "2026-11-07T12:00:00Z",
        links: [],
        is_cineflow_managed: true,
        media_item_id: 2,
        media_title: "Pending Movie",
        media_state: "Scraped",
        ready_in_cineflow: false,
        can_cancel: false,
        can_retry: false
    };

    store.setTransfers([readyItem, notReadyItem]);
    expect(store.transfers[0].ready_in_cineflow).toBe(true);
    expect(store.transfers[1].ready_in_cineflow).toBe(false);
});
