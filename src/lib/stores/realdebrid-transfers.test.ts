import assert from "node:assert/strict";
import {
    RealDebridTransfersStore,
    type RealDebridTransferItem,
    type RealDebridTransferStats
} from "./realdebrid-transfers.svelte";

console.log("Running RealDebridTransfersStore & Monitoring Invariants Unit Tests...");

function makeMockTransfer(overrides: Partial<RealDebridTransferItem> = {}): RealDebridTransferItem {
    return {
        id: "rd-1234",
        filename: "Dune.Part.Two.2024.2160p.mkv",
        hash: "abcdef0123456789abcdef0123456789abcdef01",
        bytes: 14500000000,
        progress: 100.0,
        status: "downloaded",
        added: "2026-11-07T12:00:00Z",
        ended: "2026-11-07T12:20:00Z",
        speed: null,
        seeders: null,
        links: ["https://real-debrid.com/d/xyz"],
        is_cineflow_managed: true,
        is_attached: false,
        media_item_id: 42,
        media_title: "Dune: Part Two",
        media_type: "movie",
        media_state: "Completed",
        ready_in_cineflow: true,
        operation_id: "op-uuid-1",
        can_cancel: false,
        can_retry: false,
        ...overrides
    };
}

// 1. Store state initialization and hydration
{
    const store = new RealDebridTransfersStore();
    assert.strictEqual(store.transfers.length, 0);
    assert.strictEqual(store.stats.total, 0);
    assert.strictEqual(store.stats.active, 0);
    assert.strictEqual(store.rdEnabled, true);
    assert.strictEqual(store.isLoading, false);
    assert.strictEqual(store.error, null);

    const items = [
        makeMockTransfer({ id: "t-1", filename: "File1.mkv" }),
        makeMockTransfer({ id: "t-2", filename: "File2.mkv" })
    ];
    const stats: RealDebridTransferStats = {
        total: 2,
        active: 0,
        queued: 0,
        downloaded: 2,
        failed: 0,
        active_slots_used: 0,
        active_slots_limit: 20
    };

    store.setTransfers(items);
    store.setStats(stats);

    assert.strictEqual(store.transfers.length, 2);
    assert.strictEqual(store.stats.total, 2);
    assert.strictEqual(store.stats.downloaded, 2);
}

// 2. Distinction between RD Downloaded and Ready in CineFlow
{
    const store = new RealDebridTransfersStore();

    // Item A: Downloaded on RD and fully ingested into CineFlow (Completed/Symlinked)
    const itemReady = makeMockTransfer({
        id: "rd-ready",
        status: "downloaded",
        ready_in_cineflow: true,
        is_cineflow_managed: true,
        media_state: "Completed"
    });

    // Item B: Downloaded on RD, but CineFlow is still processing / awaiting VFS ingestion
    const itemAwaiting = makeMockTransfer({
        id: "rd-awaiting",
        status: "downloaded",
        ready_in_cineflow: false,
        is_cineflow_managed: true,
        media_state: "Scraped"
    });

    // Item C: Downloaded on RD outside CineFlow (External account transfer)
    const itemExternal = makeMockTransfer({
        id: "rd-external",
        status: "downloaded",
        ready_in_cineflow: false,
        is_cineflow_managed: false,
        media_item_id: null,
        media_title: null
    });

    store.setTransfers([itemReady, itemAwaiting, itemExternal]);

    assert.strictEqual(store.transfers[0].ready_in_cineflow, true);
    assert.strictEqual(store.transfers[1].ready_in_cineflow, false);
    assert.strictEqual(store.transfers[2].ready_in_cineflow, false);
    assert.strictEqual(store.transfers[2].is_cineflow_managed, false);
}

// 3. Resilience to missing metrics (speed, seeders, ended)
{
    const store = new RealDebridTransfersStore();
    const sparseItem = makeMockTransfer({
        id: "sparse-1",
        speed: null,
        seeders: null,
        ended: null
    });

    store.setTransfers([sparseItem]);
    assert.strictEqual(store.transfers[0].speed, null);
    assert.strictEqual(store.transfers[0].seeders, null);
    assert.strictEqual(store.transfers[0].ended, null);
}

// 4. Safe control invariants: Cancellation and Retry permissions
{
    // Active CineFlow-managed transfer: can cancel, cannot retry
    const activeManaged = makeMockTransfer({
        id: "active-1",
        status: "downloading",
        is_cineflow_managed: true,
        can_cancel: true,
        can_retry: false
    });
    assert.strictEqual(activeManaged.can_cancel, true);
    assert.strictEqual(activeManaged.can_retry, false);

    // Completed transfer: cannot cancel (prohibits auto-deletion of completed torrents)
    const completedManaged = makeMockTransfer({
        id: "comp-1",
        status: "downloaded",
        is_cineflow_managed: true,
        can_cancel: false,
        can_retry: false
    });
    assert.strictEqual(completedManaged.can_cancel, false);
    assert.strictEqual(completedManaged.can_retry, false);

    // External transfer: read-only (no cancel, no retry)
    const externalActive = makeMockTransfer({
        id: "ext-1",
        status: "downloading",
        is_cineflow_managed: false,
        can_cancel: false,
        can_retry: false
    });
    assert.strictEqual(externalActive.can_cancel, false);
    assert.strictEqual(externalActive.can_retry, false);

    // Failed CineFlow-managed transfer: can retry, cannot cancel
    const failedManaged = makeMockTransfer({
        id: "fail-1",
        status: "error",
        is_cineflow_managed: true,
        can_cancel: false,
        can_retry: true
    });
    assert.strictEqual(failedManaged.can_cancel, false);
    assert.strictEqual(failedManaged.can_retry, true);
}

// 5. Store reset functionality
{
    const store = new RealDebridTransfersStore();
    store.setTransfers([makeMockTransfer()]);
    store.selectedStatus = "active";
    store.searchQuery = "test";

    store.reset();
    assert.strictEqual(store.transfers.length, 0);
    assert.strictEqual(store.selectedStatus, null);
    assert.strictEqual(store.searchQuery, "");
}

console.log("All RealDebridTransfersStore unit tests passed successfully.");
