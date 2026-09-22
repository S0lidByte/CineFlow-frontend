import type { CollectionMovie } from "$lib/providers/parser";
import type { AddItemsParsedResult } from "./riven/item-request-parser";

/**
 * Collection Year Span metadata representation.
 */
export interface CollectionYearSpan {
    min: number | null;
    max: number | null;
    formatted: string;
}

/**
 * Collection Statistics representation.
 */
export interface CollectionStats {
    totalCount: number;
    collectedCount: number;
    uncollectedCount: number;
    percentage: number;
}

/**
 * Parses and computes the release year span of a collection's movies.
 */
export function getCollectionYearSpan(
    parts: CollectionMovie[] | null | undefined
): CollectionYearSpan {
    if (!parts || parts.length === 0) {
        return { min: null, max: null, formatted: "" };
    }

    const validYears = parts
        .map((part) => (typeof part.year === "number" && !isNaN(part.year) ? part.year : null))
        .filter((y): y is number => y !== null);

    if (validYears.length === 0) {
        return { min: null, max: null, formatted: "" };
    }

    const min = Math.min(...validYears);
    const max = Math.max(...validYears);

    if (min === max) {
        return { min, max, formatted: `${min}` };
    }

    return { min, max, formatted: `${min}–${max}` };
}

/**
 * Formats a clean human-readable summary subtitle for the collection.
 * Example: "3 Movies • 2008–2012" or "1 Movie • 2021" or "4 Movies"
 */
export function formatCollectionSummary(
    partsCount: number,
    yearSpanFormatted?: string | null
): string {
    const movieLabel = partsCount === 1 ? "1 Movie" : `${Math.max(0, partsCount)} Movies`;
    const cleanSpan = (yearSpanFormatted ?? "").trim();

    if (cleanSpan) {
        return `${movieLabel} • ${cleanSpan}`;
    }
    return movieLabel;
}

/**
 * Normalizes an ID to string for uniform comparison.
 */
function normalizeId(id: string | number | null | undefined): string {
    if (id === null || id === undefined) return "";
    return String(id).trim();
}

/**
 * Filters the list of collection movies to find which ones have not yet been requested or added.
 */
export function getUncollectedMovieIds(
    parts: CollectionMovie[] | null | undefined,
    existingIds?: Iterable<string | number> | null
): number[] {
    if (!parts || parts.length === 0) return [];

    if (!existingIds) {
        return parts.map((p) => p.id).filter((id) => typeof id === "number" && id > 0);
    }

    const existingSet = new Set<string>();
    for (const id of existingIds) {
        const norm = normalizeId(id);
        if (norm) existingSet.add(norm);
    }

    return parts
        .filter((part) => {
            if (!part.id || part.id <= 0) return false;
            return !existingSet.has(String(part.id));
        })
        .map((part) => part.id);
}

/**
 * Calculates collection statistics (total, collected, uncollected, percentage).
 */
export function calculateCollectionStats(
    parts: CollectionMovie[] | null | undefined,
    existingIds?: Iterable<string | number> | null
): CollectionStats {
    if (!parts || parts.length === 0) {
        return {
            totalCount: 0,
            collectedCount: 0,
            uncollectedCount: 0,
            percentage: 0
        };
    }

    const totalCount = parts.length;
    const uncollectedIds = getUncollectedMovieIds(parts, existingIds);
    const uncollectedCount = uncollectedIds.length;
    const collectedCount = Math.max(0, totalCount - uncollectedCount);
    const percentage = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;

    return {
        totalCount,
        collectedCount,
        uncollectedCount,
        percentage
    };
}

/**
 * Formats the button label for the bulk request action.
 */
export function formatRequestButtonLabel(
    uncollectedCount: number,
    totalCount: number,
    isLoading: boolean = false
): string {
    if (isLoading) {
        return "Requesting Movies...";
    }
    if (totalCount === 0) {
        return "No Movies in Collection";
    }
    if (uncollectedCount <= 0) {
        return `All ${totalCount} Movies in Library`;
    }
    if (uncollectedCount === totalCount) {
        return `Request All (${totalCount} ${totalCount === 1 ? "Movie" : "Movies"})`;
    }
    return `Request Uncollected (${uncollectedCount} of ${totalCount} Movies)`;
}

/**
 * Formats request response into a structured outcome summary.
 */
export function parseCollectionRequestOutcome(
    parsed: AddItemsParsedResult,
    totalRequested?: number
): { success: boolean; toastMessage: string; summary: string } {
    if (!parsed.success && parsed.addedCount === 0 && parsed.requeuedCount === 0) {
        return {
            success: false,
            toastMessage: parsed.toastMessage || "Failed to request collection items.",
            summary:
                parsed.message ||
                (totalRequested !== undefined
                    ? `Failed to request ${totalRequested} items`
                    : "Request failed")
        };
    }

    const processed = parsed.addedCount + parsed.requeuedCount;
    let summary: string;

    if (parsed.addedCount > 0 && parsed.requeuedCount > 0) {
        summary = `Added ${parsed.addedCount}, requeued ${parsed.requeuedCount}`;
    } else if (parsed.addedCount > 0) {
        summary = `Added ${parsed.addedCount} item(s)`;
    } else {
        summary = `Requeued ${parsed.requeuedCount} item(s)`;
    }

    return {
        success: true,
        toastMessage: parsed.toastMessage || `Processed ${processed} movie(s) successfully!`,
        summary
    };
}
