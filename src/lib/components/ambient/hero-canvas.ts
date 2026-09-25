export interface HeroItem {
    title?: string | null;
    backdrop_path?: string | null;
    poster_path?: string | null;
}

/**
 * Resolves the primary visual source URL for the 21:9 Ultra-Wide Hero Canvas.
 * Follows the visual priority: backdrop_path -> poster_path -> null.
 * Normalizes relative TMDB image paths to high-fidelity original CDN URLs.
 */
export function resolveHeroImage(item?: HeroItem | null): string | null {
    if (!item) return null;

    if (item.backdrop_path && typeof item.backdrop_path === "string" && item.backdrop_path.trim()) {
        const path = item.backdrop_path.trim();
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        const cleaned = path.startsWith("/") ? path : `/${path}`;
        return `https://image.tmdb.org/t/p/original${cleaned}`;
    }

    if (item.poster_path && typeof item.poster_path === "string" && item.poster_path.trim()) {
        const path = item.poster_path.trim();
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        const cleaned = path.startsWith("/") ? path : `/${path}`;
        return `https://image.tmdb.org/t/p/original${cleaned}`;
    }

    return null;
}
