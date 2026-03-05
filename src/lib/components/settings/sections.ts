/**
 * Shared section metadata for the Settings page.
 * Used by both +page.server.ts and +page.svelte.
 *
 * Each tab groups one or more top-level schema keys.
 * Keys are passed to GET /api/v1/settings/schema/keys and GET/POST /api/v1/settings/get|set/{paths}.
 */
export type SectionTabId = string;

export interface SectionTab {
    id: SectionTabId;
    label: string;
    /** Lucide icon name for the tab nav */
    icon: string;
    /** Short description shown under the section title */
    description: string;
    /** Top-level schema keys for this section (comma-separated for API paths) */
    keys: string[];
    /** Whether changes in this section require backend restart to take effect */
    restartRequired?: boolean;
    /**
     * If set, clicking this tab navigates to the given href instead of
     * switching to a SJSF-rendered tab. Used for pages with custom UIs
     * (e.g. Library Profiles) that live under a separate route.
     */
    href?: string;
}

/** Tab groupings: General, Filesystem, Library Updaters, Downloaders, Content, Scraping, Infra */
export const SETTINGS_TABS: SectionTab[] = [
    {
        id: "general",
        label: "General",
        icon: "settings",
        description: "API key, log level, network tracing, and core runtime options.",
        keys: [
            "version",
            "api_key",
            "log_level",
            "enable_network_tracing",
            "enable_stream_tracing",
            "retry_interval",
            "tracemalloc"
        ]
    },
    {
        id: "filesystem",
        label: "Filesystem",
        icon: "folder-tree",
        description: "Paths, mount points, and storage configuration for the media library.",
        keys: ["filesystem"],
        restartRequired: true
    },
    {
        id: "updaters",
        label: "Library Updaters",
        icon: "library",
        description: "Configure library update providers (e.g. Plex, Emby, Jellyfin) and sync intervals.",
        keys: ["updaters"]
    },
    {
        id: "library-profiles",
        label: "Library Profiles",
        icon: "book-open",
        description: "Organize media into separate library folders based on metadata rules.",
        keys: [],
        href: "/library-profiles"
    },
    {
        id: "downloaders",
        label: "Downloaders",
        icon: "download",
        description: "Debrid and download service settings, credentials, and download behavior.",
        keys: ["downloaders"]
    },
    {
        id: "content",
        label: "Content",
        icon: "file-text",
        description: "Content sources, watchlists, and media discovery providers.",
        keys: ["content"]
    },
    {
        id: "scraping",
        label: "Scraping",
        icon: "scan-search",
        description: "Scraper sources, indexers, ranking rules, and torrent filtering options.",
        keys: ["scraping", "ranking", "indexer"]
    },
    {
        id: "infra",
        label: "Infra",
        icon: "server",
        description: "Database, notifications, post-processing, logging, and stream configuration.",
        keys: ["database", "notifications", "post_processing", "logging", "stream"],
        restartRequired: true
    }
];

export const DEFAULT_TAB_ID: SectionTabId = SETTINGS_TABS[0].id;

export function getTabById(id: SectionTabId): SectionTab | undefined {
    return SETTINGS_TABS.find((t) => t.id === id);
}

/** Paths string for API: keys joined by comma */
export function getPathsForTab(tab: SectionTab): string {
    return tab.keys.join(",");
}
