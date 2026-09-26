/**
 * Calendar presentation & release tracking helpers for CineFlow.
 * Aligns with Filmu consumer-calendar specifications (CAL-001):
 * - Library presence indicators
 * - Air date countdown calculations
 * - 1-click media request dispatch
 */

import type { CalendarDate } from "@internationalized/date";
import * as dateUtils from "$lib/utils/date";
import providers from "$lib/providers";
import {
    parseAddItemsResponse,
    type AddItemsParsedResult
} from "$lib/components/media/riven/item-request-parser";

export type CountdownUrgency = "today" | "tomorrow" | "upcoming" | "past";

export interface AirDateCountdown {
    label: string;
    urgency: CountdownUrgency;
    diffDays: number;
}

export type LibraryStatusVariant = "success" | "warning" | "info" | "neutral" | "destructive";

export interface LibraryStatusBadge {
    label: string;
    variant: LibraryStatusVariant;
    inLibrary: boolean;
    canRequest: boolean;
}

export interface CalendarMediaCandidate {
    item_id: number;
    tvdb_id?: string | number | null;
    tmdb_id?: string | number | null;
    show_title?: string;
    item_type: string; // "movie" | "show" | "season" | "episode"
    aired_at?: string;
    last_state?: string;
}

/**
 * Calculates air date countdown badge attributes.
 */
export function getAirDateCountdown(
    itemDate: CalendarDate,
    todayDate: CalendarDate
): AirDateCountdown {
    const diffDays = dateUtils.differenceInDays(itemDate, todayDate);

    if (diffDays === 0) {
        return { label: "Today", urgency: "today", diffDays: 0 };
    }
    if (diffDays === 1) {
        return { label: "Tomorrow", urgency: "tomorrow", diffDays: 1 };
    }
    if (diffDays > 1) {
        return { label: `In ${diffDays}d`, urgency: "upcoming", diffDays };
    }
    if (diffDays === -1) {
        return { label: "Yesterday", urgency: "past", diffDays: -1 };
    }
    return { label: `${Math.abs(diffDays)}d ago`, urgency: "past", diffDays };
}

/**
 * Derives library presence and download status from the backend's declarative state.
 */
export function getLibraryStatusBadge(lastState: string | null | undefined): LibraryStatusBadge {
    const state = (lastState ?? "").trim();

    switch (state) {
        case "Completed":
            return {
                label: "In Library",
                variant: "success",
                inLibrary: true,
                canRequest: false
            };
        case "Downloaded":
        case "Symlinked":
            return {
                label: "Downloaded",
                variant: "success",
                inLibrary: true,
                canRequest: false
            };
        case "PartiallyCompleted":
            return {
                label: "Partial",
                variant: "warning",
                inLibrary: true,
                canRequest: true
            };
        case "Scraped":
        case "Indexed":
            return {
                label: "Processing",
                variant: "info",
                inLibrary: false,
                canRequest: false
            };
        case "Requested":
        case "Ongoing":
            return {
                label: "Queued",
                variant: "warning",
                inLibrary: false,
                canRequest: false
            };
        case "Unreleased":
            return {
                label: "Unreleased",
                variant: "neutral",
                inLibrary: false,
                canRequest: true
            };
        case "Failed":
            return {
                label: "Failed",
                variant: "destructive",
                inLibrary: false,
                canRequest: true
            };
        default:
            return {
                label: "Not in Library",
                variant: "neutral",
                inLibrary: false,
                canRequest: true
            };
    }
}

/**
 * Dispatches a 1-click request or re-scrape for a calendar media item.
 */
export async function executeQuickRequest(
    item: CalendarMediaCandidate
): Promise<AddItemsParsedResult> {
    try {
        const hasTmdb =
            item.tmdb_id !== undefined && item.tmdb_id !== null && `${item.tmdb_id}`.trim() !== "";
        const hasTvdb =
            item.tvdb_id !== undefined && item.tvdb_id !== null && `${item.tvdb_id}`.trim() !== "";

        const mediaType = item.item_type === "movie" ? "movie" : "tv";

        const response = await providers.riven.POST("/api/v1/items/add", {
            body: {
                media_type: mediaType,
                tmdb_ids: mediaType === "movie" && hasTmdb ? [String(item.tmdb_id)] : [],
                tvdb_ids: mediaType === "tv" && hasTvdb ? [String(item.tvdb_id)] : []
            }
        });

        return parseAddItemsResponse(response.data?.message);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown network error";
        return {
            success: false,
            addedCount: 0,
            requeuedCount: 0,
            skippedCount: 0,
            failedCount: 1,
            message,
            toastMessage: `Failed to request item: ${message}`
        };
    }
}
