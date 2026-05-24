import type { RivenMediaItem } from "$lib/types/riven";

const RETRY_SKIP_STATES = new Set(["Completed", "Downloaded", "Paused", "Symlinked", "Unreleased"]);

export function isRetryableRivenState(state: string | null | undefined): boolean {
    if (!state) return true;
    return !RETRY_SKIP_STATES.has(state);
}

export function getMissingEpisodeRetryIds(riven: RivenMediaItem | null | undefined): string[] {
    return (
        riven?.seasons?.flatMap((season) =>
            (season.episodes ?? [])
                .filter(
                    (episode) =>
                        episode.id !== null &&
                        episode.id !== undefined &&
                        isRetryableRivenState(episode.state)
                )
                .map((episode) => String(episode.id))
        ) ?? []
    );
}

export function getRetryItemIds(
    riven: RivenMediaItem | null | undefined,
    mediaType: "movie" | "tv" | string | null | undefined,
    fallbackId: number | string | null | undefined
): string[] {
    if (mediaType === "tv") {
        return getMissingEpisodeRetryIds(riven);
    }

    return fallbackId === null || fallbackId === undefined ? [] : [String(fallbackId)];
}
