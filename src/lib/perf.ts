import { browser } from "$app/environment";
import { env } from "$lib/env-public";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("perf");

export const PERF_METRICS_ENABLED = env.PUBLIC_PERF_METRICS === "true";

export interface PerfMark {
    name: string;
    start: number;
    meta?: Record<string, unknown>;
}

function nowMs(): number {
    if (browser && typeof performance !== "undefined") {
        return performance.now();
    }

    return Date.now();
}

export function startPerfMark(name: string, meta?: Record<string, unknown>): PerfMark | null {
    if (!PERF_METRICS_ENABLED) return null;

    return {
        name,
        start: nowMs(),
        meta
    };
}

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

export function perfCount(name: string, value = 1, meta?: Record<string, unknown>): void {
    if (!PERF_METRICS_ENABLED) return;
    logger.info(`[perf:count] ${name}`, { value, ...(meta ?? {}) });
}
