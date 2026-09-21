export const ALLOWED_INDEXERS = new Set(["tvdb", "tmdb"]);

export function parsePositiveIntegerId(value: string | null | undefined): number | null {
    if (!value || typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
