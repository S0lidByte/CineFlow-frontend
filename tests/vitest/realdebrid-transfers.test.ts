import { expect, test } from "vitest";
import { render } from "svelte/server";
import RealDebridTransfersPanel from "../../src/lib/components/activity/realdebrid-transfers-panel.svelte";
import {
    realDebridTransfersStore,
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
        is_attached: false,
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
        is_attached: false,
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

test("StreamItem renders Uncached badge and Cache on Real-Debrid action when stream is not cached", async () => {
    const StreamItemModule =
        await import("../../src/lib/components/media/riven/stream-item.svelte");
    const StreamItem = StreamItemModule.default;

    const uncachedStream = {
        raw_title: "Test.Movie.2024.1080p.Uncached.mkv",
        parsed_title: "Test Movie",
        rank: 500,
        lev_ratio: 1.0,
        is_cached: false,
        magnet: "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567",
        size: 1048576000,
        parsed_data: {
            resolution: "1080p",
            quality: "WEBRip"
        }
    };

    const { body } = render(StreamItem, {
        props: {
            stream: uncachedStream,
            magnet: "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567",
            isSelected: false,
            onSelect: () => {},
            onScrape: () => {},
            onCacheOnDebrid: () => {}
        }
    });

    expect(body).toContain("Uncached");
    expect(body).toContain("Cache on Real-Debrid");
    expect(body).not.toContain('bg-chart-1 text-primary-foreground">Cached<');
});

test("RealDebridTransfersPanel renders Attach action and Attached badge correctly", () => {
    const attachedItem: RealDebridTransferItem = {
        id: "rd-att-1",
        filename: "External.Movie.2024.mkv",
        hash: "hash-att-1",
        bytes: 5000000000,
        progress: 100.0,
        status: "downloaded",
        added: "2026-11-08T01:00:00Z",
        links: [],
        is_cineflow_managed: false,
        is_attached: true,
        media_item_id: 101,
        media_title: "External Movie",
        media_type: "movie",
        media_state: "Symlinked",
        media_external_id: "tmdb-101",
        ready_in_cineflow: false,
        can_cancel: false,
        can_retry: false
    };

    realDebridTransfersStore.setTransfers([attachedItem]);
    const { body } = render(RealDebridTransfersPanel);

    expect(body).toContain("Attached");
    expect(body).toContain("Attach");
    expect(body).toContain("External.Movie.2024.mkv");
    expect(body).toContain('href="/details/media/tmdb-101/movie"');
});

test("RealDebridTransfersPanel does not link to external-ID route when media_external_id is missing", () => {
    const noExtIdItem: RealDebridTransferItem = {
        id: "rd-noext-1",
        filename: "NoExtId.Movie.2024.mkv",
        hash: "hash-noext-1",
        bytes: 5000000000,
        progress: 100.0,
        status: "downloaded",
        added: "2026-11-08T01:00:00Z",
        links: [],
        is_cineflow_managed: false,
        is_attached: true,
        media_item_id: 81,
        media_title: "Night of the Living Dead",
        media_type: "movie",
        media_state: "Scraped",
        media_external_id: null,
        ready_in_cineflow: false,
        can_cancel: false,
        can_retry: false
    };

    realDebridTransfersStore.setTransfers([noExtIdItem]);
    const { body } = render(RealDebridTransfersPanel);

    expect(body).toContain("Night of the Living Dead");
    // Verify it NEVER falls back to /details/media/81/movie
    expect(body).not.toContain('href="/details/media/81/movie"');
});
