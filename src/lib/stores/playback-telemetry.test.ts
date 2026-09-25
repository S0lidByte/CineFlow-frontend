import assert from "node:assert/strict";
import {
    PlaybackTelemetryStore,
    type StreamSessionMetric,
    type PlaybackTelemetrySnapshot
} from "./playback-telemetry.svelte";

console.log("Running PlaybackTelemetryStore & Stream Monitor MVP Unit Tests...");

function makeMockStream(overrides: Partial<StreamSessionMetric> = {}): StreamSessionMetric {
    return {
        stream_id: "stream-session-1",
        title: "Dune: Part Two (2024)",
        bytes_transferred: 104857600, // 100 MB
        bytes_from_cache: 52428800, // 50 MB
        cache_hit_rate_pct: 50.0,
        current_throughput_mbps: 24.5,
        started_at: "2026-09-25T12:00:00Z",
        last_read_at: "2026-09-25T12:05:00Z",
        is_active: true,
        provider: "realdebrid",
        cdn_url_refreshed: false,
        user_name: "Alice",
        player_device: "Living Room Shield",
        playback_state: "playing",
        decision: "direct_play",
        quality_profile: "4K",
        ...overrides
    };
}

function makeMockSnapshot(
    streams: StreamSessionMetric[] = [],
    timestamp = "2026-09-25T12:00:00Z"
): PlaybackTelemetrySnapshot {
    return {
        timestamp,
        active_streams: streams,
        recent_events: [],
        aggregate: {
            active_streams_count: streams.length,
            total_streams_count: streams.length,
            total_bytes_transferred: streams.reduce(
                (acc, s) => acc + (s.bytes_transferred || 0),
                0
            ),
            aggregate_cache_hit_rate_pct: streams.length > 0 ? 50.0 : 0.0,
            current_total_throughput_mbps: streams.reduce(
                (acc, s) => acc + (s.current_throughput_mbps || 0),
                0
            ),
            active_pool_connections: streams.length,
            cached_chunks_in_memory: 100,
            cached_chunks_on_disk: 200,
            total_chunk_requests: 300,
            total_cache_hits: 150,
            total_cache_misses: 150,
            cdn_refresh_count: 0,
            stream_error_count: 0
        }
    };
}

// 1. Empty State
{
    const store = new PlaybackTelemetryStore();
    store.updateSnapshot(makeMockSnapshot([], "2026-09-25T12:00:00Z"));

    assert.strictEqual(store.activeStreams.length, 0, "Initial active streams should be empty");
    assert.strictEqual(
        store.aggregate?.active_streams_count,
        0,
        "Aggregate active streams should be 0"
    );
    assert.strictEqual(
        store.aggregate?.current_total_throughput_mbps,
        0,
        "Aggregate throughput should be 0"
    );
}

// 2. Single Active Stream with Full Attribution
{
    const store = new PlaybackTelemetryStore();
    const aliceStream = makeMockStream({
        stream_id: "stream-alice",
        user_name: "Alice",
        player_device: "Living Room Shield",
        title: "Dune: Part Two",
        quality_profile: "4K",
        decision: "direct_play",
        playback_state: "playing",
        current_throughput_mbps: 24.5
    });

    store.updateSnapshot(makeMockSnapshot([aliceStream], "2026-09-25T12:01:00Z"));

    assert.strictEqual(store.activeStreams.length, 1);
    const s = store.activeStreams[0];
    assert.strictEqual(s.stream_id, "stream-alice");
    assert.strictEqual(s.user_name, "Alice");
    assert.strictEqual(s.player_device, "Living Room Shield");
    assert.strictEqual(s.title, "Dune: Part Two");
    assert.strictEqual(s.quality_profile, "4K");
    assert.strictEqual(s.decision, "direct_play");
    assert.strictEqual(s.playback_state, "playing");
    assert.strictEqual(s.current_throughput_mbps, 24.5);
}

// 3. Multi-Session Isolation (Alice & Bob Simultaneous Streams)
{
    const store = new PlaybackTelemetryStore();
    const aliceStream = makeMockStream({
        stream_id: "stream-alice",
        user_name: "Alice",
        player_device: "Living Room Shield",
        title: "Dune: Part Two",
        quality_profile: "4K",
        decision: "direct_play",
        playback_state: "playing",
        current_throughput_mbps: 24.5
    });
    const bobStream = makeMockStream({
        stream_id: "stream-bob",
        user_name: "Bob",
        player_device: "Apple TV 4K",
        title: "Shogun S01E01",
        quality_profile: "1080p",
        decision: "transcode",
        playback_state: "playing",
        current_throughput_mbps: 12.0
    });

    store.updateSnapshot(makeMockSnapshot([aliceStream, bobStream], "2026-09-25T12:02:00Z"));

    assert.strictEqual(store.activeStreams.length, 2, "Both streams must be present");
    const alice = store.activeStreams.find((s) => s.stream_id === "stream-alice")!;
    const bob = store.activeStreams.find((s) => s.stream_id === "stream-bob")!;

    assert.ok(alice, "Alice stream must exist");
    assert.ok(bob, "Bob stream must exist");

    assert.strictEqual(alice.user_name, "Alice");
    assert.strictEqual(alice.quality_profile, "4K");
    assert.strictEqual(alice.decision, "direct_play");

    assert.strictEqual(bob.user_name, "Bob");
    assert.strictEqual(bob.quality_profile, "1080p");
    assert.strictEqual(bob.decision, "transcode");
}

// 4. Playback State Transitions: Playing -> Paused -> Resume
{
    const store = new PlaybackTelemetryStore();
    const aliceStream = makeMockStream({ stream_id: "stream-alice", playback_state: "playing" });
    const bobStreamPlaying = makeMockStream({ stream_id: "stream-bob", playback_state: "playing" });

    // Step 1: Both playing
    store.updateSnapshot(makeMockSnapshot([aliceStream, bobStreamPlaying], "2026-09-25T12:03:00Z"));
    assert.strictEqual(
        store.activeStreams.find((s) => s.stream_id === "stream-bob")?.playback_state,
        "playing"
    );

    // Step 2: Bob pauses
    const bobStreamPaused = makeMockStream({ stream_id: "stream-bob", playback_state: "paused" });
    store.updateSnapshot(makeMockSnapshot([aliceStream, bobStreamPaused], "2026-09-25T12:04:00Z"));
    assert.strictEqual(
        store.activeStreams.find((s) => s.stream_id === "stream-bob")?.playback_state,
        "paused"
    );
    assert.strictEqual(
        store.activeStreams.find((s) => s.stream_id === "stream-alice")?.playback_state,
        "playing"
    );

    // Step 3: Bob resumes
    store.updateSnapshot(makeMockSnapshot([aliceStream, bobStreamPlaying], "2026-09-25T12:05:00Z"));
    assert.strictEqual(
        store.activeStreams.find((s) => s.stream_id === "stream-bob")?.playback_state,
        "playing"
    );
}

// 5. Stream Removal & Finalization (Alice Stops -> Bob Remains -> Bob Stops -> Empty)
{
    const store = new PlaybackTelemetryStore();
    const aliceStream = makeMockStream({ stream_id: "stream-alice" });
    const bobStream = makeMockStream({ stream_id: "stream-bob" });

    store.updateSnapshot(makeMockSnapshot([aliceStream, bobStream], "2026-09-25T12:06:00Z"));
    assert.strictEqual(store.activeStreams.length, 2);

    // Alice stops: only Bob remains
    store.updateSnapshot(makeMockSnapshot([bobStream], "2026-09-25T12:07:00Z"));
    assert.strictEqual(store.activeStreams.length, 1);
    assert.strictEqual(store.activeStreams[0].stream_id, "stream-bob");

    // Bob stops: stream list becomes empty
    store.updateSnapshot(makeMockSnapshot([], "2026-09-25T12:08:00Z"));
    assert.strictEqual(store.activeStreams.length, 0);
}

// 6. Graceful Degradation of Optional Attribution (No User / Device / Provider / Quality)
{
    const store = new PlaybackTelemetryStore();
    const rawStream: StreamSessionMetric = {
        stream_id: "stream-raw-vfs-123",
        title: "Unknown Media File.mkv",
        bytes_transferred: 1024,
        bytes_from_cache: 0,
        cache_hit_rate_pct: 0.0,
        current_throughput_mbps: 1.2,
        started_at: "2026-09-25T12:00:00Z",
        last_read_at: "2026-09-25T12:00:01Z",
        is_active: true,
        provider: null,
        cdn_url_refreshed: false,
        user_name: null,
        player_device: null,
        playback_state: "playing",
        decision: null,
        quality_profile: null
    };

    store.updateSnapshot(makeMockSnapshot([rawStream], "2026-09-25T12:09:00Z"));
    assert.strictEqual(store.activeStreams.length, 1);
    const s = store.activeStreams[0];
    assert.strictEqual(s.user_name, null);
    assert.strictEqual(s.player_device, null);
    assert.strictEqual(s.provider, null);
    assert.strictEqual(s.decision, null);
    assert.strictEqual(s.quality_profile, null);
}

// 7. Stale Snapshot Protection (Rejects older timestamp updates)
{
    const store = new PlaybackTelemetryStore();
    const newerStream = makeMockStream({ stream_id: "stream-newer" });
    const olderStream = makeMockStream({ stream_id: "stream-older" });

    store.updateSnapshot(makeMockSnapshot([newerStream], "2026-09-25T12:15:00Z"));
    assert.strictEqual(store.activeStreams[0].stream_id, "stream-newer");

    // Attempt to update with older timestamp (e.g. out-of-order network arrival)
    store.updateSnapshot(makeMockSnapshot([olderStream], "2026-09-25T12:10:00Z"));
    assert.strictEqual(
        store.activeStreams[0].stream_id,
        "stream-newer",
        "Store must reject out-of-order stale telemetry snapshots"
    );
}

console.log("All PlaybackTelemetryStore & Stream Monitor unit tests passed successfully!");
