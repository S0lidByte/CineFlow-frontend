import assert from "node:assert/strict";
import {
    PlaybackTelemetryStore,
    type StreamSessionMetric,
    type PlaybackTelemetrySnapshot
} from "$lib/stores/playback-telemetry.svelte";

console.log("Running Stream Monitor MVP Route & Component Unit Tests...");

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

// 1. Initial Empty State
{
    const store = new PlaybackTelemetryStore();
    store.updateSnapshot(makeMockSnapshot([]));

    assert.strictEqual(store.activeStreams.length, 0, "No active streams in empty state");
    assert.strictEqual(store.aggregate?.active_streams_count, 0);
    assert.strictEqual(store.aggregate?.current_total_throughput_mbps, 0);
    assert.strictEqual(store.aggregate?.total_bytes_transferred, 0);
}

// 2. Stream Attribution Verification (Alice, 4K Direct Play)
{
    const store = new PlaybackTelemetryStore();
    const alice = makeMockStream({
        stream_id: "stream-alice",
        user_name: "Alice",
        player_device: "Living Room Shield",
        title: "Dune: Part Two (2024)",
        quality_profile: "4K",
        decision: "direct_play",
        playback_state: "playing",
        provider: "realdebrid",
        current_throughput_mbps: 24.5
    });

    store.updateSnapshot(makeMockSnapshot([alice]));
    assert.strictEqual(store.activeStreams.length, 1);
    const active = store.activeStreams[0];
    assert.strictEqual(active.user_name, "Alice");
    assert.strictEqual(active.player_device, "Living Room Shield");
    assert.strictEqual(active.decision, "direct_play");
    assert.strictEqual(active.quality_profile, "4K");
    assert.strictEqual(active.playback_state, "playing");
}

// 3. Multi-Session Isolation (Alice + Bob)
{
    const store = new PlaybackTelemetryStore();
    const alice = makeMockStream({
        stream_id: "stream-alice",
        user_name: "Alice",
        player_device: "Living Room Shield",
        title: "Dune: Part Two (2024)",
        quality_profile: "4K",
        decision: "direct_play",
        playback_state: "playing",
        current_throughput_mbps: 24.5
    });
    const bob = makeMockStream({
        stream_id: "stream-bob",
        user_name: "Bob",
        player_device: "Apple TV 4K",
        title: "Shogun S01E01",
        quality_profile: "1080p",
        decision: "transcode",
        playback_state: "playing",
        current_throughput_mbps: 12.0
    });

    store.updateSnapshot(makeMockSnapshot([alice, bob]));
    assert.strictEqual(store.activeStreams.length, 2, "Both streams tracked distinctly");

    const aliceFound = store.activeStreams.find((s) => s.stream_id === "stream-alice");
    const bobFound = store.activeStreams.find((s) => s.stream_id === "stream-bob");

    assert.ok(aliceFound, "Alice session must be isolated");
    assert.ok(bobFound, "Bob session must be isolated");
    assert.strictEqual(aliceFound?.decision, "direct_play");
    assert.strictEqual(bobFound?.decision, "transcode");
    assert.strictEqual(store.aggregate?.current_total_throughput_mbps, 36.5);
}

// 4. Playback State Life Cycle: Playing -> Paused -> Resumed
{
    const store = new PlaybackTelemetryStore();
    const stream = makeMockStream({ stream_id: "test-stream", playback_state: "playing" });

    store.updateSnapshot(makeMockSnapshot([stream], "2026-09-25T12:00:00Z"));
    assert.strictEqual(store.activeStreams[0].playback_state, "playing");

    const pausedStream = makeMockStream({ stream_id: "test-stream", playback_state: "paused" });
    store.updateSnapshot(makeMockSnapshot([pausedStream], "2026-09-25T12:01:00Z"));
    assert.strictEqual(store.activeStreams[0].playback_state, "paused");

    const resumedStream = makeMockStream({ stream_id: "test-stream", playback_state: "playing" });
    store.updateSnapshot(makeMockSnapshot([resumedStream], "2026-09-25T12:02:00Z"));
    assert.strictEqual(store.activeStreams[0].playback_state, "playing");
}

// 5. Graceful Fallback on Missing Attribution
{
    const store = new PlaybackTelemetryStore();
    const anonymousStream: StreamSessionMetric = {
        stream_id: "stream-anon-001",
        title: "Raw Torrent Stream.mkv",
        bytes_transferred: 2048,
        bytes_from_cache: 0,
        cache_hit_rate_pct: 0.0,
        current_throughput_mbps: 3.5,
        started_at: "2026-09-25T12:00:00Z",
        last_read_at: "2026-09-25T12:00:05Z",
        is_active: true,
        provider: null,
        cdn_url_refreshed: false,
        user_name: null,
        player_device: null,
        playback_state: "playing",
        decision: null,
        quality_profile: null
    };

    store.updateSnapshot(makeMockSnapshot([anonymousStream]));
    assert.strictEqual(store.activeStreams.length, 1);
    assert.strictEqual(store.activeStreams[0].user_name, null);
    assert.strictEqual(store.activeStreams[0].player_device, null);
    assert.strictEqual(store.activeStreams[0].decision, null);
    assert.strictEqual(store.activeStreams[0].quality_profile, null);
}

// 6. Complete End-to-End Session Lifecycle & Transition Sequence
{
    const store = new PlaybackTelemetryStore();

    // Step 1: STREAM_START (initial un-attributed or basic stream)
    const initialStream = makeMockStream({
        stream_id: "lifecycle-stream-01",
        title: "Dune: Part Two (2024)",
        user_name: null,
        player_device: null,
        playback_state: "playing",
        decision: null,
        bytes_transferred: 1024 * 1024,
        current_throughput_mbps: 15.0
    });
    store.updateSnapshot(makeMockSnapshot([initialStream], "2026-09-25T12:00:00Z"));
    assert.strictEqual(store.activeStreams.length, 1);
    assert.strictEqual(store.activeStreams[0].user_name, null);

    // Step 2: Delayed Plex/Tautulli Attribution Arrives
    const attributedStream = makeMockStream({
        stream_id: "lifecycle-stream-01",
        title: "Dune: Part Two (2024)",
        user_name: "Alice",
        player_device: "Living Room Shield",
        playback_state: "playing",
        decision: "direct_play",
        quality_profile: "4K",
        bytes_transferred: 25 * 1024 * 1024,
        current_throughput_mbps: 28.0
    });
    store.updateSnapshot(makeMockSnapshot([attributedStream], "2026-09-25T12:00:05Z"));
    assert.strictEqual(store.activeStreams.length, 1);
    assert.strictEqual(store.activeStreams[0].user_name, "Alice");
    assert.strictEqual(store.activeStreams[0].decision, "direct_play");

    // Step 3: PAUSED state
    const pausedStream = makeMockStream({
        ...attributedStream,
        playback_state: "paused",
        current_throughput_mbps: 0.0
    });
    store.updateSnapshot(makeMockSnapshot([pausedStream], "2026-09-25T12:05:00Z"));
    assert.strictEqual(store.activeStreams[0].playback_state, "paused");
    assert.strictEqual(store.activeStreams[0].current_throughput_mbps, 0.0);

    // Step 4: Resumed (PLAYING)
    const resumedStream = makeMockStream({
        ...attributedStream,
        playback_state: "playing",
        current_throughput_mbps: 22.0
    });
    store.updateSnapshot(makeMockSnapshot([resumedStream], "2026-09-25T12:06:00Z"));
    assert.strictEqual(store.activeStreams[0].playback_state, "playing");

    // Step 5: STOP/COMPLETE (Stream removed from active streams)
    store.updateSnapshot(makeMockSnapshot([], "2026-09-25T12:10:00Z"));
    assert.strictEqual(store.activeStreams.length, 0, "Stream must disappear on completion");
}

// 7. Strict Multi-Session Isolation under Asymmetric Updates
{
    const store = new PlaybackTelemetryStore();

    const alice = makeMockStream({
        stream_id: "stream-alice",
        user_name: "Alice",
        player_device: "Living Room Shield",
        title: "Dune: Part Two (2024)",
        quality_profile: "4K",
        decision: "direct_play",
        playback_state: "playing",
        bytes_transferred: 50 * 1024 * 1024
    });

    const bob = makeMockStream({
        stream_id: "stream-bob",
        user_name: "Bob",
        player_device: "Apple TV 4K",
        title: "Shogun S01E01",
        quality_profile: "1080p",
        decision: "transcode",
        playback_state: "playing",
        bytes_transferred: 30 * 1024 * 1024
    });

    store.updateSnapshot(makeMockSnapshot([alice, bob], "2026-09-25T12:00:00Z"));

    // Mutate only Alice (Alice pauses and changes transfer rate)
    const alicePaused = makeMockStream({
        ...alice,
        playback_state: "paused",
        current_throughput_mbps: 0.0
    });
    store.updateSnapshot(makeMockSnapshot([alicePaused, bob], "2026-09-25T12:01:00Z"));

    const aliceCheck = store.activeStreams.find((s) => s.stream_id === "stream-alice")!;
    const bobCheck = store.activeStreams.find((s) => s.stream_id === "stream-bob")!;

    assert.strictEqual(aliceCheck.playback_state, "paused");
    assert.strictEqual(bobCheck.playback_state, "playing", "Bob must remain playing");
    assert.strictEqual(bobCheck.user_name, "Bob", "Bob's attribution must remain intact");
    assert.strictEqual(bobCheck.decision, "transcode", "Bob's decision must remain transcode");
}

// 8. Stale Snapshot Discard Protection
{
    const store = new PlaybackTelemetryStore();
    const latestStream = makeMockStream({
        stream_id: "stream-order-test",
        title: "Latest Stream Sample",
        playback_state: "playing"
    });

    store.updateSnapshot(makeMockSnapshot([latestStream], "2026-09-25T12:15:00Z"));
    assert.strictEqual(store.activeStreams[0].title, "Latest Stream Sample");

    // Out-of-order older packet arrives
    const staleStream = makeMockStream({
        stream_id: "stream-order-test",
        title: "Old Stale Stream Sample",
        playback_state: "paused"
    });
    store.updateSnapshot(makeMockSnapshot([staleStream], "2026-09-25T12:14:00Z"));

    // Verify older packet was discarded
    assert.strictEqual(store.activeStreams[0].title, "Latest Stream Sample");
    assert.strictEqual(store.activeStreams[0].playback_state, "playing");
}

console.log("Stream Monitor MVP Route & Component Unit Tests passed successfully.");
