import type { FilesystemEntry } from "$lib/types/riven";
import type { EpisodeItemData } from "./episode-details-sheet.svelte";

export type VfsBadgeStatus = "vfs_mounted" | "direct_stream" | "none";

/**
 * Determines the canonical VFS badge status for an episode or media item.
 * Contract:
 * - filesystem_entry.available_in_vfs === true -> "vfs_mounted" (VFS Mounted badge)
 * - filesystem_entry.available_in_vfs === false && unrestricted_url != null -> "direct_stream" (Direct Stream badge)
 * - otherwise -> "none" (no VFS pill displayed)
 */
export function getVfsBadgeStatus(fs: FilesystemEntry | null | undefined): VfsBadgeStatus {
    if (!fs) return "none";
    if (fs.available_in_vfs === true) return "vfs_mounted";
    if (
        fs.available_in_vfs === false &&
        fs.unrestricted_url != null &&
        fs.unrestricted_url.trim() !== ""
    ) {
        return "direct_stream";
    }
    return "none";
}

/**
 * Formats byte size to human-readable GB string (e.g., 2.45 GB).
 */
export function formatEpisodeSize(b: number | string | null | undefined): string {
    if (b == null) return "";
    const num = typeof b === "number" ? b : Number(b);
    if (!Number.isFinite(num) || num <= 0) return "";
    return `${(num / 1073741824).toFixed(2)} GB`;
}

/**
 * Formats video/audio bitrate to Mbps or kbps.
 */
export function formatBitrate(bitrate: number | null | undefined): string {
    if (bitrate == null || !Number.isFinite(bitrate) || bitrate <= 0) return "";
    if (bitrate >= 1000000) {
        return `${Math.round(bitrate / 1000000)} Mbps`;
    }
    return `${Math.round(bitrate / 1000)} kbps`;
}

/**
 * Builds the canonical header title for an episode.
 * Examples:
 * - S1E5 - Ozymandias
 * - S2E1
 * - Special Episode
 * - Episode Details (fallback)
 */
export function getEpisodeDisplayTitle(ep: EpisodeItemData | null | undefined): string {
    if (!ep) return "Episode Details";
    if (ep.seasonNumber != null && ep.number != null) {
        return ep.name
            ? `S${ep.seasonNumber}E${ep.number} - ${ep.name}`
            : `S${ep.seasonNumber}E${ep.number}`;
    }
    if (ep.name) return ep.name;
    return "Episode Details";
}

/**
 * Parses ?season=X&episode=Y query parameters from URLSearchParams or query string.
 * Returns { season: number, episode: number } if valid positive integers, else null.
 */
export function parseEpisodeDeepLink(
    params: URLSearchParams | string
): { season: number; episode: number } | null {
    const searchParams = typeof params === "string" ? new URLSearchParams(params) : params;
    const seasonRaw = searchParams.get("season");
    const episodeRaw = searchParams.get("episode");
    if (!seasonRaw || !episodeRaw) return null;
    const season = Number(seasonRaw);
    const episode = Number(episodeRaw);
    if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 0 || episode < 0) {
        return null;
    }
    return { season, episode };
}

/**
 * Updates or removes ?season=X&episode=Y query parameters on a URLSearchParams instance,
 * preserving all other query parameters (such as search, tab, etc.).
 */
export function syncEpisodeDeepLink(
    params: URLSearchParams,
    selection: { season: number; episode: number } | null
): URLSearchParams {
    const updated = new URLSearchParams(params.toString());
    if (selection) {
        updated.set("season", selection.season.toString());
        updated.set("episode", selection.episode.toString());
    } else {
        updated.delete("season");
        updated.delete("episode");
    }
    return updated;
}
