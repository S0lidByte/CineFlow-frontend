/**
 * Shared section metadata for the Settings page.
 * Used by both +page.server.ts and +page.svelte.
 *
 * Each tab groups one or more top-level schema keys.
 * Keys are passed to GET /api/v1/settings/schema/keys and GET/POST /api/v1/settings/get|set/{paths}.
 */
export type SectionTabId = string;

/** Top-level sidebar group that a tab belongs to. */
export type SectionGroup = "core" | "media-stack" | "acquisition" | "tuning";

/** Sidebar group metadata — label + icon shown as the collapsible group header. */
export const SECTION_GROUPS: Record<SectionGroup, { label: string; icon: string }> = {
    core: { label: "Core", icon: "settings-2" },
    "media-stack": { label: "Media Stack", icon: "layers" },
    acquisition: { label: "Discovery & Acquisition", icon: "scan-search" },
    tuning: { label: "Tuning & Infrastructure", icon: "sliders-horizontal" }
};

export interface SectionTab {
    id: SectionTabId;
    label: string;
    /** Lucide icon name for the tab nav */
    icon: string;
    /** Short description shown under the section title */
    description: string;
    /** Top-level schema keys for this section (comma-separated for API paths) */
    keys: string[];
    /** Sidebar group this tab belongs to */
    group: SectionGroup;
    /** Whether changes in this section require backend restart to take effect */
    restartRequired?: boolean;
    /**
     * When true, the settings page renders a custom panel instead of the SJSF
     * auto-generated form. The panel component is responsible for its own data
     * loading and save actions.
     */
    custom?: boolean;
}

/**
 * Stable ID for the library-profiles custom tab.
 * Use this constant instead of the raw string to prevent typo drift across
 * the server load function, page shell, and any future consumers.
 */
export const LIBRARY_PROFILES_TAB_ID = "library-profiles" as const;

/** Stable ID for the custom Ranking / RTN panel. */
export const RANKING_TAB_ID = "ranking" as const;

/** Stable ID for the custom Users & Access panel. */
export const USERS_TAB_ID = "users" as const;

/** All settings tabs, ordered within each group as they appear in the sidebar. */
export const SETTINGS_TABS: SectionTab[] = [
    // ── Core ──────────────────────────────────────────────────────────────────
    {
        id: "general",
        label: "General",
        icon: "settings",
        group: "core",
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
        id: "users",
        label: "Users & Access",
        icon: "users",
        group: "core",
        description: "Manage accounts, roles, access permissions, and public registration.",
        keys: [],
        custom: true
    },

    // ── Media Stack ───────────────────────────────────────────────────────────
    {
        id: "filesystem",
        label: "Filesystem",
        icon: "folder-tree",
        group: "media-stack",
        description: "Paths, mount points, and storage configuration for the media library.",
        keys: ["filesystem"],
        restartRequired: true
    },
    {
        id: "updaters",
        label: "Library Updaters",
        icon: "library",
        group: "media-stack",
        description:
            "Configure library update providers (e.g. Plex, Emby, Jellyfin) and sync intervals.",
        keys: ["updaters"]
    },
    {
        id: "library-profiles",
        label: "Library Profiles",
        icon: "book-open",
        group: "media-stack",
        description: "Organize media into separate library folders based on metadata rules.",
        keys: [],
        custom: true
    },

    // ── Discovery & Acquisition ───────────────────────────────────────────────
    {
        id: "downloaders",
        label: "Downloaders",
        icon: "download",
        group: "acquisition",
        description: "Debrid and download service settings, credentials, and download behavior.",
        keys: ["downloaders"]
    },
    {
        id: "content",
        label: "Content Sources",
        icon: "file-text",
        group: "acquisition",
        description: "Content sources, watchlists, and media discovery providers.",
        keys: ["content"]
    },
    {
        id: "scraping",
        label: "Scraping",
        icon: "scan-search",
        group: "acquisition",
        description: "Scraper sources, indexers, and scrape scheduling options.",
        keys: ["scraping", "indexer"]
    },

    // ── Tuning & Infrastructure ───────────────────────────────────────────────
    {
        id: "ranking",
        label: "Ranking",
        icon: "list-ordered",
        group: "tuning",
        description:
            "RTN quality filters for movies/shows and anime (independent packs), presets, and a release tester.",
        keys: ["ranking", "ranking_anime"],
        custom: true
    },
    {
        id: "database",
        label: "Database",
        icon: "database",
        group: "tuning",
        description: "Database connection, migrations, and storage backend configuration.",
        keys: ["database"],
        restartRequired: true
    },
    {
        id: "notifications",
        label: "Notifications",
        icon: "bell",
        group: "tuning",
        description: "Apprise notification endpoints, events, and alert thresholds.",
        keys: ["notifications"]
    },
    {
        id: "ops",
        label: "Operations",
        icon: "activity",
        group: "tuning",
        description: "Post-processing, logging verbosity, and stream proxy configuration.",
        keys: ["post_processing", "logging", "stream"]
    }
];

export const DEFAULT_TAB_ID: SectionTabId = SETTINGS_TABS[0].id;

/** Map a top-level AppModel key to its settings tab id. */
export function getTabIdForSettingsKey(key: string): SectionTabId | undefined {
    const tab = SETTINGS_TABS.find((t) => t.keys.includes(key));
    return tab?.id;
}

export function getTabById(id: SectionTabId): SectionTab | undefined {
    // Friendly aliases for older or natural URLs
    const normalized = id === "operations" ? "ops" : id;
    return SETTINGS_TABS.find((t) => t.id === normalized);
}

/** Paths string for API: keys joined by comma */
export function getPathsForTab(tab: SectionTab): string {
    return tab.keys.join(",");
}

/** Return all tabs that belong to a given group, in declaration order. */
export function getTabsByGroup(group: SectionGroup): SectionTab[] {
    return SETTINGS_TABS.filter((t) => t.group === group);
}
