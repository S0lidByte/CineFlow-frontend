import type { components } from "$lib/providers/riven";

export type TrashCustomFormat = components["schemas"]["TrashCustomFormat"];
export type TrashProfile = components["schemas"]["TrashProfile"];
export type TrashCustomFormatsResponse = components["schemas"]["TrashCustomFormatsResponse"];
export type TrashEvaluateRequest = components["schemas"]["TrashEvaluateRequest"];
export type TrashEvaluateResponse = components["schemas"]["TrashEvaluateResponse"];
export type TrashEvaluationSummary = components["schemas"]["TrashEvaluationSummary"];
export type TrashFormatMatchResult = components["schemas"]["TrashFormatMatchResult"];
export type FunnelSummaryResponse = components["schemas"]["FunnelSummaryResponse"];
export type RankingTestRequest = components["schemas"]["RankingTestRequest"];
export type RankingTestResponse = components["schemas"]["RankingTestResponse"];

/**
 * Fetch default or active TRaSH Guides custom formats catalog and profiles
 * from the backend via the authenticated BFF proxy.
 */
export async function getTrashCustomFormats(
    fetchFn: typeof fetch = fetch
): Promise<TrashCustomFormatsResponse> {
    const res = await fetchFn("/api/v1/ranking/custom-formats", {
        headers: {
            Accept: "application/json"
        }
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
            `Failed to load TRaSH custom formats (${res.status}): ${errorText || res.statusText}`
        );
    }

    return res.json();
}

/**
 * Evaluate a release title against TRaSH Custom Formats without saving settings.
 */
export async function evaluateTrashRelease(
    req: TrashEvaluateRequest,
    fetchFn: typeof fetch = fetch
): Promise<TrashEvaluateResponse> {
    const res = await fetchFn("/api/v1/ranking/custom-formats/evaluate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify(req)
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
            `Failed to evaluate TRaSH custom formats (${res.status}): ${errorText || res.statusText}`
        );
    }

    return res.json();
}

/**
 * Run ranking test integrating RTN and optional TRaSH evaluation.
 */
export async function testRankingWithTrash(
    req: RankingTestRequest,
    fetchFn: typeof fetch = fetch
): Promise<RankingTestResponse> {
    const res = await fetchFn("/api/v1/ranking/test", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify(req)
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Ranking test failed (${res.status}): ${errorText || res.statusText}`);
    }

    return res.json();
}

/**
 * Fetch scrape funnel summary for a given item.
 */
export async function getFunnelSummary(
    itemId: number,
    fetchFn: typeof fetch = fetch
): Promise<FunnelSummaryResponse> {
    const res = await fetchFn(`/api/v1/ranking/funnel/${itemId}`, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Failed to load funnel (${res.status}): ${errorText || res.statusText}`);
    }

    return res.json();
}

/**
 * Helper to get a human-friendly category label for TRaSH format categories.
 */
export function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        hdr_dv: "Dolby Vision & HDR",
        audio_advanced: "Advanced Audio & Codecs",
        source_remux_tier: "Remux Quality Tiers",
        source_web_tier: "WEB-DL Quality Tiers",
        low_quality: "Low Quality & Unwanted Rips",
        unwanted_lq: "Low Quality & Unwanted Rips",
        anime: "Anime & Dual-Audio Tiers",
        streaming_service: "Streaming Services",
        enhancement: "Editions & Enhancements",
        general: "General Formats"
    };

    return labels[category] || category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Helper to compute category color badge styling.
 */
export function getCategoryBadgeClass(category: string): string {
    switch (category) {
        case "hdr_dv":
            return "bg-purple-500/10 text-purple-400 border-purple-500/30";
        case "audio_advanced":
            return "bg-blue-500/10 text-blue-400 border-blue-500/30";
        case "source_remux_tier":
            return "bg-amber-500/10 text-amber-400 border-amber-500/30";
        case "source_web_tier":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
        case "low_quality":
        case "unwanted_lq":
            return "bg-rose-500/10 text-rose-400 border-rose-500/30";
        case "anime":
            return "bg-pink-500/10 text-pink-400 border-pink-500/30";
        default:
            return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
}
