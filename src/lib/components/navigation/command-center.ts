/**
 * CineFlow Universal Cmd+K Command Center (VIS-003)
 * Pure domain logic, types, and search provider orchestration.
 */

export type CommandCategory = "navigation" | "diagnostics" | "library" | "tmdb" | "operations";

export interface CommandActionItem {
    id: string;
    title: string;
    description?: string;
    category: "navigation" | "diagnostics";
    icon: string;
    href?: string;
    action?: string;
    shortcut?: string;
    badge?: {
        text: string;
        variant?: "default" | "secondary" | "destructive" | "outline";
    };
    keywords?: string[];
}

export interface CommandLibraryItem {
    id: string;
    riven_id: number;
    title: string;
    year: string | number;
    media_type: "movie" | "show" | "season" | "episode" | "unknown";
    indexer: "tmdb" | "tvdb";
    state?: string | null;
    poster_path?: string | null;
    category: "library";
    badge?: {
        text: string;
        variant: "default" | "destructive" | "secondary" | "outline";
    } | null;
}

export interface CommandTmdbItem {
    id: number;
    title: string;
    year: string | number;
    media_type: "movie" | "tv" | "person";
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number | null;
    overview?: string | null;
    category: "tmdb";
}

export interface CommandOperationItem {
    id: string;
    operation_type: string;
    status: "pending" | "processing" | "completed" | "failed" | string;
    title?: string;
    correlation_id?: string;
    created_at?: string;
    category: "operations";
}

export type UnifiedCommandItem =
    | { type: "action"; data: CommandActionItem }
    | { type: "library"; data: CommandLibraryItem }
    | { type: "tmdb"; data: CommandTmdbItem }
    | { type: "operation"; data: CommandOperationItem };

/**
 * Returns static navigation routes across CineFlow.
 */
export function getStaticNavigationItems(): CommandActionItem[] {
    return [
        {
            id: "nav-dashboard",
            title: "Dashboard",
            description: "Home discovery, cinematic hero canvas & recommendations",
            category: "navigation",
            icon: "LayoutDashboard",
            href: "/",
            shortcut: "G H",
            keywords: ["home", "main", "start", "hero", "trending"]
        },
        {
            id: "nav-explore",
            title: "Explore Media",
            description: "Browse and discover movies, TV shows, and anime",
            category: "navigation",
            icon: "Compass",
            href: "/explore",
            shortcut: "G E",
            keywords: ["browse", "discover", "search", "catalog", "find"]
        },
        {
            id: "nav-library",
            title: "Media Library",
            description: "Manage collected items, view download & symlink states",
            category: "navigation",
            icon: "Film",
            href: "/library",
            shortcut: "G L",
            keywords: ["collected", "downloaded", "symlinked", "movies", "shows"]
        },
        {
            id: "nav-streams",
            title: "Stream Monitor (Live HUD)",
            description: "Real-time active playback sessions, throughput & attribution",
            category: "navigation",
            icon: "Tv",
            href: "/streams",
            shortcut: "G S",
            badge: { text: "Live HUD", variant: "secondary" },
            keywords: [
                "playback",
                "bandwidth",
                "speed",
                "vfs",
                "direct play",
                "transcode",
                "active"
            ]
        },
        {
            id: "nav-activity",
            title: "Activity & Outbox Timeline",
            description: "Transactional outbox ledger, background workers & queue health",
            category: "navigation",
            icon: "Activity",
            href: "/activity",
            shortcut: "G A",
            badge: { text: "Outbox", variant: "outline" },
            keywords: ["ledger", "dispatcher", "queue", "jobs", "operations", "timeline", "audit"]
        },
        {
            id: "nav-trending-anime",
            title: "Trending Anime",
            description: "Top rated and currently trending anime releases",
            category: "navigation",
            icon: "Flame",
            href: "/lists/trending/anime",
            keywords: ["anime", "japan", "animation", "anilist", "otaku"]
        },
        {
            id: "nav-settings",
            title: "Settings",
            description: "Configure scrapers, downloaders, filesystem, and profiles",
            category: "navigation",
            icon: "Settings",
            href: "/settings",
            shortcut: "G ,",
            keywords: ["config", "admin", "preferences", "setup", "credentials", "api keys"]
        },
        {
            id: "nav-logs",
            title: "System Logs",
            description: "Live real-time streaming backend logs & terminal",
            category: "navigation",
            icon: "Terminal",
            href: "/logs",
            shortcut: "G O",
            keywords: ["debug", "console", "stdout", "stream", "errors", "trace"]
        }
    ];
}

/**
 * Returns quick diagnostic actions & outbox shortcuts.
 */
export function getDiagnosticActions(): CommandActionItem[] {
    return [
        {
            id: "diag-failed-outbox",
            title: "Inspect Failed Outbox Operations",
            description: "Filter activity ledger to examine dead-letter or failed operations",
            category: "diagnostics",
            icon: "AlertCircle",
            href: "/activity?status=failed",
            badge: { text: "Failed Jobs", variant: "destructive" },
            keywords: ["failed", "errors", "dead-letter", "outbox", "retry", "broken"]
        },
        {
            id: "diag-processing-outbox",
            title: "Inspect Processing Outbox Operations",
            description: "Monitor currently claimed and executing worker operations",
            category: "diagnostics",
            icon: "RefreshCw",
            href: "/activity?status=processing",
            badge: { text: "Active", variant: "default" },
            keywords: ["processing", "running", "workers", "active", "in-flight"]
        },
        {
            id: "diag-pending-outbox",
            title: "Inspect Pending Outbox Operations",
            description: "View scheduled operations waiting for dispatcher workers",
            category: "diagnostics",
            icon: "Clock",
            href: "/activity?status=pending",
            badge: { text: "Queued", variant: "secondary" },
            keywords: ["pending", "queued", "waiting", "scheduled", "backlog"]
        },
        {
            id: "diag-streams",
            title: "Live Stream Sessions & Bandwidth",
            description: "Inspect concurrent VFS direct play / transcode sessions",
            category: "diagnostics",
            icon: "Radio",
            href: "/streams",
            badge: { text: "Telemetry", variant: "secondary" },
            keywords: ["streams", "sessions", "bandwidth", "clients", "plex", "throughput"]
        },
        {
            id: "diag-settings-ranking",
            title: "Settings: Ranking Studio & Custom Formats",
            description: "Inspect RTN ranking packs, TRaSH formats, and quality tiers",
            category: "diagnostics",
            icon: "SlidersHorizontal",
            href: "/settings?tab=ranking",
            keywords: ["ranking", "rtn", "trash", "custom formats", "scores", "profiles"]
        },
        {
            id: "diag-settings-scrapers",
            title: "Settings: Scrapers & Indexers",
            description: "Manage Zilean, Prowlarr, Torrentio, and StremThru integrations",
            category: "diagnostics",
            icon: "Search",
            href: "/settings?tab=scraping",
            keywords: ["scrapers", "zilean", "prowlarr", "indexers", "jackett", "stremthru"]
        },
        {
            id: "diag-settings-downloaders",
            title: "Settings: Debrid Downloaders",
            description: "Configure Real-Debrid, AllDebrid, and Debrid-Link API keys",
            category: "diagnostics",
            icon: "DownloadCloud",
            href: "/settings?tab=downloaders",
            keywords: ["realdebrid", "alldebrid", "debridlink", "keys", "premium"]
        },
        {
            id: "diag-settings-filesystem",
            title: "Settings: Filesystem & VFS Cache",
            description: "Configure mount paths, tmpfs memory caps, and media directories",
            category: "diagnostics",
            icon: "FolderTree",
            href: "/settings?tab=filesystem",
            keywords: ["vfs", "fuse", "mount", "cache", "tmpfs", "disk", "storage"]
        }
    ];
}

/**
 * Normalized fuzzy substring and token scoring.
 * Returns a number between 0.0 (no match) and 1.0 (exact match).
 */
export function scoreMatch(target: string, query: string): number {
    const normTarget = target.trim().toLowerCase();
    const normQuery = query.trim().toLowerCase();

    if (!normQuery) return 1.0;
    if (normTarget === normQuery) return 1.0;
    if (normTarget.startsWith(normQuery)) return 0.9;

    const words = normTarget.split(/[\s\-_.:/]+/);
    // Word boundary start
    for (const word of words) {
        if (word.startsWith(normQuery)) return 0.8;
    }

    if (normTarget.includes(normQuery)) return 0.6;

    // Subsequence / acronym match (e.g. "sm" -> "stream monitor")
    if (normQuery.length >= 2) {
        const acronym = words.map((w) => w[0]).join("");
        if (acronym.startsWith(normQuery)) return 0.7;
        if (acronym.includes(normQuery)) return 0.5;

        // Subsequence match
        let tIdx = 0;
        let qIdx = 0;
        while (tIdx < normTarget.length && qIdx < normQuery.length) {
            if (normTarget[tIdx] === normQuery[qIdx]) {
                qIdx++;
            }
            tIdx++;
        }
        if (qIdx === normQuery.length) {
            return 0.3;
        }
    }

    return 0.0;
}

/**
 * Filter action items (navigation & diagnostics) by text query.
 */
export function filterActions(actions: CommandActionItem[], query: string): CommandActionItem[] {
    const trimmed = query.trim();
    if (!trimmed) return actions;

    const scored = actions
        .map((action) => {
            const titleScore = scoreMatch(action.title, trimmed) * 1.5;
            const descScore = action.description
                ? scoreMatch(action.description, trimmed) * 0.8
                : 0;
            const keywordScores = action.keywords
                ? action.keywords.map((kw) => scoreMatch(kw, trimmed) * 1.2)
                : [0];
            const maxKeywordScore = Math.max(...keywordScores, 0);

            const bestScore = Math.max(titleScore, descScore, maxKeywordScore);
            return { action, score: bestScore };
        })
        .filter((item) => item.score > 0.25)
        .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.action);
}

/**
 * Formats state badge variant for library items.
 */
export function getStateBadgeVariant(
    state?: string | null
): "default" | "destructive" | "secondary" | "outline" {
    if (!state) return "secondary";
    const s = state.toLowerCase();
    if (s.includes("complete") || s.includes("symlink") || s.includes("downloaded")) {
        return "default";
    }
    if (s.includes("fail") || s.includes("error")) {
        return "destructive";
    }
    if (s.includes("process") || s.includes("scrap") || s.includes("index")) {
        return "outline";
    }
    return "secondary";
}

/**
 * Formats details string for library items.
 */
export function formatItemDetails(item: CommandLibraryItem): string {
    const parts: string[] = [];
    const typeLabel = item.media_type.charAt(0).toUpperCase() + item.media_type.slice(1);
    parts.push(typeLabel);

    if (item.year && item.year !== "N/A") {
        parts.push(String(item.year));
    }

    if (item.state) {
        parts.push(item.state);
    }

    return parts.join(" • ");
}

/**
 * Formats details string for TMDB items.
 */
export function formatTmdbDetails(item: CommandTmdbItem): string {
    const parts: string[] = [];
    const typeLabel = item.media_type === "tv" ? "TV Series" : "Movie";
    parts.push(typeLabel);

    if (item.year && item.year !== "N/A") {
        parts.push(String(item.year));
    }

    if (typeof item.vote_average === "number" && item.vote_average > 0) {
        parts.push(`★ ${item.vote_average.toFixed(1)}`);
    }

    return parts.join(" • ");
}

/**
 * Formats details string for Operation items.
 */
export function formatOperationDetails(item: CommandOperationItem): string {
    const parts: string[] = [];
    parts.push(item.operation_type);

    if (item.status) {
        parts.push(item.status.toUpperCase());
    }

    if (item.correlation_id) {
        parts.push(item.correlation_id.slice(0, 8));
    }

    return parts.join(" • ");
}

/**
 * Resolves destination URL for a library or TMDB item.
 */
export function resolveItemHref(item: CommandLibraryItem | CommandTmdbItem): string {
    if (item.category === "library") {
        const type = item.media_type === "show" || item.media_type === "season" ? "show" : "movie";
        return `/details/media/${item.id}/${type}`;
    }
    const type = item.media_type === "tv" ? "show" : "movie";
    return `/details/media/${item.id}/${type}`;
}

interface RawLibraryResponseItem {
    id: number;
    type?: string;
    title?: string;
    tmdb_id?: number | string | null;
    tvdb_id?: number | string | null;
    parent_ids?: { tvdb_id?: number | string | null } | null;
    aired_at?: string | null;
    state?: string | null;
    poster_path?: string | null;
}

/**
 * Asynchronously searches local library items via the backend API.
 */
export async function searchLibraryItems(
    query: string,
    signal?: AbortSignal,
    fetchFn: typeof fetch = fetch
): Promise<CommandLibraryItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
        const response = await fetchFn(
            `/api/v1/items?search=${encodeURIComponent(trimmed)}&limit=6`,
            { signal }
        );

        if (!response.ok) return [];

        const data = await response.json();
        const items: RawLibraryResponseItem[] = Array.isArray(data?.items) ? data.items : [];

        return items
            .map((item: RawLibraryResponseItem): CommandLibraryItem | null => {
                let id: string | null = null;
                let indexer: "tmdb" | "tvdb" = "tmdb";

                if (item.type === "movie") {
                    id = item.tmdb_id ? String(item.tmdb_id) : null;
                    indexer = "tmdb";
                } else if (item.type === "show") {
                    id = item.tvdb_id ? String(item.tvdb_id) : null;
                    indexer = "tvdb";
                } else if (item.parent_ids?.tvdb_id) {
                    id = String(item.parent_ids.tvdb_id);
                    indexer = "tvdb";
                }

                if (!id) return null;

                const year = item.aired_at ? new Date(item.aired_at).getFullYear() : "N/A";
                const rawType = item.type?.toLowerCase();
                const media_type: CommandLibraryItem["media_type"] =
                    rawType === "movie" ||
                    rawType === "show" ||
                    rawType === "season" ||
                    rawType === "episode"
                        ? rawType
                        : "unknown";

                return {
                    id,
                    riven_id: item.id,
                    title: item.title || "Untitled",
                    year: Number.isNaN(year) ? "N/A" : year,
                    media_type,
                    indexer,
                    state: item.state || null,
                    poster_path: item.poster_path || null,
                    category: "library",
                    badge: item.state
                        ? {
                              text: item.state,
                              variant: getStateBadgeVariant(item.state)
                          }
                        : null
                };
            })
            .filter((item: CommandLibraryItem | null): item is CommandLibraryItem => item !== null);
    } catch (e: unknown) {
        if ((e as Error)?.name === "AbortError") return [];
        return [];
    }
}

/**
 * Asynchronously searches TMDB catalog via SvelteKit BFF endpoints.
 */
export async function searchTmdbCatalog(
    query: string,
    signal?: AbortSignal,
    fetchFn: typeof fetch = fetch
): Promise<CommandTmdbItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
        const [movieRes, tvRes] = await Promise.allSettled([
            fetchFn(
                `/api/tmdb/search/movie?query=${encodeURIComponent(trimmed)}&searchMode=search`,
                { signal }
            ),
            fetchFn(`/api/tmdb/search/tv?query=${encodeURIComponent(trimmed)}&searchMode=search`, {
                signal
            })
        ]);

        const results: CommandTmdbItem[] = [];

        if (movieRes.status === "fulfilled" && movieRes.value.ok) {
            const data = await movieRes.value.json();
            const list = Array.isArray(data?.results) ? data.results : [];
            for (const m of list.slice(0, 4)) {
                const year = m.release_date ? new Date(m.release_date).getFullYear() : "N/A";
                results.push({
                    id: m.id,
                    title: m.title || m.original_title || "Untitled",
                    year: Number.isNaN(year) ? "N/A" : year,
                    media_type: "movie",
                    poster_path: m.poster_path
                        ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
                        : null,
                    vote_average: m.vote_average ?? null,
                    overview: m.overview ?? null,
                    category: "tmdb"
                });
            }
        }

        if (tvRes.status === "fulfilled" && tvRes.value.ok) {
            const data = await tvRes.value.json();
            const list = Array.isArray(data?.results) ? data.results : [];
            for (const t of list.slice(0, 4)) {
                const year = t.first_air_date ? new Date(t.first_air_date).getFullYear() : "N/A";
                results.push({
                    id: t.id,
                    title: t.name || t.original_name || "Untitled",
                    year: Number.isNaN(year) ? "N/A" : year,
                    media_type: "tv",
                    poster_path: t.poster_path
                        ? `https://image.tmdb.org/t/p/w200${t.poster_path}`
                        : null,
                    vote_average: t.vote_average ?? null,
                    overview: t.overview ?? null,
                    category: "tmdb"
                });
            }
        }

        return results.slice(0, 6);
    } catch (e: unknown) {
        if ((e as Error)?.name === "AbortError") return [];
        return [];
    }
}

/**
 * Filters unified command items by active category tab.
 */
export function filterByCategory(
    items: UnifiedCommandItem[],
    category: CommandCategory | "all"
): UnifiedCommandItem[] {
    if (category === "all") return items;
    return items.filter((item) => {
        if (category === "navigation" || category === "diagnostics") {
            return item.type === "action" && item.data.category === category;
        }
        return item.type === category;
    });
}
