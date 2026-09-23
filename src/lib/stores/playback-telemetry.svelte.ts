import { source } from "sveltekit-sse";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";
import type { components } from "$lib/providers/riven";

const logger = createScopedLogger("playback-telemetry-store");

export type StreamSessionMetric = components["schemas"]["StreamSessionMetric"];
export type AggregatePlaybackMetrics = components["schemas"]["AggregatePlaybackMetrics"];
export type PlaybackTelemetryEvent = components["schemas"]["PlaybackTelemetryEvent"];
export type PlaybackTelemetrySnapshot = components["schemas"]["PlaybackTelemetrySnapshot"];

export class PlaybackTelemetryStore {
    #snapshot = $state<PlaybackTelemetrySnapshot | null>(null);
    #isLoading = $state<boolean>(false);
    #error = $state<string | null>(null);
    #connectionStatus = $state<"connecting" | "connected" | "disconnected" | "error">(
        "disconnected"
    );
    #connection: ReturnType<typeof source> | null = null;
    #unsubscribe: (() => void) | null = null;

    get snapshot() {
        return this.#snapshot;
    }

    get aggregate(): AggregatePlaybackMetrics | null {
        return this.#snapshot?.aggregate ?? null;
    }

    get activeStreams(): StreamSessionMetric[] {
        return this.#snapshot?.active_streams ?? [];
    }

    get recentEvents(): PlaybackTelemetryEvent[] {
        return this.#snapshot?.recent_events ?? [];
    }

    get isLoading() {
        return this.#isLoading;
    }

    get error() {
        return this.#error;
    }

    get connectionStatus() {
        return this.#connectionStatus;
    }

    async fetchSnapshot() {
        try {
            this.#isLoading = true;
            this.#error = null;

            const response = await providers.riven.GET("/api/v1/telemetry/playback/metrics");

            if (response.error) {
                const err =
                    typeof response.error === "object" &&
                    response.error !== null &&
                    "message" in response.error
                        ? String((response.error as { message: string }).message)
                        : JSON.stringify(response.error);
                throw new Error(err);
            }

            if (response.data) {
                this.updateSnapshot(response.data as PlaybackTelemetrySnapshot);
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            logger.error("Failed to fetch playback telemetry snapshot:", e);
            this.#error = `Failed to fetch telemetry: ${message}`;
        } finally {
            this.#isLoading = false;
        }
    }

    updateSnapshot(newSnapshot: PlaybackTelemetrySnapshot | null) {
        if (!newSnapshot || !newSnapshot.timestamp) {
            return;
        }

        // Ignore stale snapshot if we already have a newer sample
        if (this.#snapshot?.timestamp) {
            const currentTs = Date.parse(this.#snapshot.timestamp);
            const newTs = Date.parse(newSnapshot.timestamp);
            if (!isNaN(currentTs) && !isNaN(newTs) && newTs < currentTs) {
                return;
            }
        }

        this.#snapshot = newSnapshot;
        this.#error = null;
    }

    connect() {
        if (this.#connection) {
            return;
        }

        if (typeof window === "undefined") {
            return;
        }

        try {
            this.#connectionStatus = "connecting";
            this.#error = null;

            this.#connection = source("/api/telemetry/playback/stream", {
                headers: {
                    Origin: window.location.origin
                },
                onopen: () => {
                    this.#connectionStatus = "connected";
                },
                onclose: ({ connect }) => {
                    if (this.#connectionStatus !== "disconnected") {
                        this.#connectionStatus = "error";
                        setTimeout(() => {
                            if (this.#connectionStatus !== "disconnected") {
                                void connect();
                            }
                        }, 1500);
                    }
                },
                onerror: ({ error, connect }) => {
                    logger.error("Playback telemetry stream error:", error);
                    this.#error = "Live playback telemetry connection error";
                    this.#connectionStatus = "error";
                    setTimeout(() => {
                        if (this.#connectionStatus !== "disconnected") {
                            this.#connectionStatus = "connecting";
                            void connect();
                        }
                    }, 1500);
                }
            });

            const telemetryStream = this.#connection
                .select("telemetry")
                .json<PlaybackTelemetrySnapshot>(({ error, raw, previous }) => {
                    if (raw.trim()) {
                        logger.warn("Failed to parse playback telemetry event:", error);
                    }
                    return previous;
                });

            this.#unsubscribe = telemetryStream.subscribe((newSnapshot) => {
                if (newSnapshot) {
                    this.updateSnapshot(newSnapshot);
                    this.#connectionStatus = "connected";
                }
            });
        } catch (e: unknown) {
            logger.error("Failed to initialize playback telemetry SSE source:", e);
            this.#connectionStatus = "error";
        }
    }

    disconnect() {
        if (this.#unsubscribe) {
            this.#unsubscribe();
            this.#unsubscribe = null;
        }
        if (this.#connection) {
            try {
                this.#connection.close();
            } catch (e) {
                logger.warn("Error closing telemetry connection:", e);
            }
            this.#connection = null;
        }
        this.#connectionStatus = "disconnected";
    }
}

export const playbackTelemetryStore = new PlaybackTelemetryStore();
