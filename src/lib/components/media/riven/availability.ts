const VFS_READY_STATES = new Set(["Completed", "Downloaded", "Symlinked"]);

export type RequestAvailability = "VfsAvailable" | "Unreleased";

/**
 * Returns the request UI status for items that are already exposed by CineFlow's
 * filesystem/VFS pipeline. This does not represent connected media-server library indexing,
 * including Plex, Jellyfin, or Emby.
 */
export function getRequestAvailability(
    state: string | null | undefined
): RequestAvailability | undefined {
    if (state === "Unreleased") return "Unreleased";
    return state && VFS_READY_STATES.has(state) ? "VfsAvailable" : undefined;
}

export function isRequestAvailabilityLocked(status: string | undefined): boolean {
    return status === "VfsAvailable" || status === "Unreleased";
}
