import { browser } from "$app/environment";
import { env } from "$lib/env-public";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("perf");

/**
 * Flag indicating whether performance metrics collection is active.
 */
export const PERF_METRICS_ENABLED = env.PUBLIC_PERF_METRICS === "true";

/**
 * Performance mark recording the name, start timestamp, and associated metadata.
 */
export interface PerfMark {
    /** Name identifier for the performance mark. */
    name: string;
    /** High-resolution start time in milliseconds. */
    start: number;
    /** Optional key-value metadata attached to the mark. */
    meta?: Record<string, unknown>;
}

/**
 * Retrieves the current timestamp with sub-millisecond precision where available.
 */
function nowMs(): number {
    if (browser && typeof performance !== "undefined") {
        return performance.now();
    }

    return Date.now();
}

/**
 * Starts a performance timer mark if performance metrics are enabled.
 *
 * @param name - The identifier for the operation being measured.
 * @param meta - Optional initial metadata for the measurement.
 * @returns A new `PerfMark` instance or `null` if metrics are disabled.
 */
export function startPerfMark(name: string, meta?: Record<string, unknown>): PerfMark | null {
    if (!PERF_METRICS_ENABLED) return null;

    return {
        name,
        start: nowMs(),
        meta
    };
}

/**
 * Ends a performance timer mark and logs the duration in milliseconds.
 *
 * @param mark - The performance mark returned from `startPerfMark`.
 * @param meta - Additional metadata to log upon completion.
 * @returns The elapsed time in milliseconds, or 0 if disabled or mark is null.
 */
export function endPerfMark(mark: PerfMark | null, meta?: Record<string, unknown>): number {
    if (!PERF_METRICS_ENABLED || !mark) return 0;

    const durationMs = Math.max(0, nowMs() - mark.start);
    logger.info(`[perf] ${mark.name}`, {
        durationMs: Number(durationMs.toFixed(2)),
        ...(mark.meta ?? {}),
        ...(meta ?? {})
    });

    return durationMs;
}

/**
 * Increments or records a performance counter metric.
 *
 * @param name - The counter metric name.
 * @param value - The value to increment or record (defaults to 1).
 * @param meta - Optional metadata attributes for the counter.
 */
export function perfCount(name: string, value = 1, meta?: Record<string, unknown>): void {
    if (!PERF_METRICS_ENABLED) return;
    logger.info(`[perf:count] ${name}`, { value, ...(meta ?? {}) });
}
