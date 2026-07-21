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
     * When true, the settings page renders a custom panel instead of the SJSF
     * auto-generated form. The panel component is responsible for its own data
     * loading and save actions.
     */
    custom?: boolean;
}

/** Tab groupings: General, Filesystem, Library Updaters, Downloaders, Content, Scraping, Ranking, Infra */
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
            "retry_library_batch_size",
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
        description:
            "Configure library update providers (e.g. Plex, Emby, Jellyfin) and sync intervals.",
        keys: ["updaters"]
    },
    {
        id: "library-profiles",
        label: "Library Profiles",
        icon: "book-open",
        description: "Organize media into separate library folders based on metadata rules.",
        keys: [],
        custom: true
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
        description: "Scraper sources, indexers, and scrape scheduling options.",
        keys: ["scraping", "indexer"]
    },
    {
        id: "ranking",
        label: "Ranking",
        icon: "list-ordered",
        description:
            "RTN quality filters and ranks. Log rejects map to denied by: <category>_<attribute> (e.g. audio_dolby_digital_plus).",
        keys: ["ranking"]
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

/** Map a top-level AppModel key to its settings tab id. */
export function getTabIdForSettingsKey(key: string): SectionTabId | undefined {
    const tab = SETTINGS_TABS.find((t) => t.keys.includes(key));
    return tab?.id;
}

export function getTabById(id: SectionTabId): SectionTab | undefined {
    return SETTINGS_TABS.find((t) => t.id === id);
}

/** Paths string for API: keys joined by comma */
export function getPathsForTab(tab: SectionTab): string {
    return tab.keys.join(",");
}
