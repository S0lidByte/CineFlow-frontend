/**
 * Rich in-app guides for each settings tab.
 * Powers help ribbons, expandable tips, and the full-guide dialog.
 */
import type { SectionTabId } from "./sections";

export interface SettingsTabGuide {
    /** One-line value proposition shown in the ribbon */
    headline: string;
    /** Quick actions / workflow bullets */
    howToUse: string[];
    /** Optional pro tips */
    tips?: string[];
    /** Things to watch out for */
    cautions?: string[];
    /** Feature highlights for this section */
    highlights?: { title: string; detail: string }[];
}

export const SETTINGS_TAB_GUIDES: Record<SectionTabId, SettingsTabGuide> = {
    general: {
        headline: "Core runtime identity, logging, and library retry behavior.",
        howToUse: [
            "Rotate the API key if the frontend or BFF cannot reach the backend.",
            "Set log level to DEBUG when diagnosing scrape or stream issues, then return to INFO.",
            "Enable network or stream tracing only while actively debugging — they are verbose.",
            "Adjust retry interval and batch size if library items stall in Incomplete state."
        ],
        tips: [
            "Use Cmd/Ctrl+K to jump directly to a field without hunting through nested groups.",
            "Save this section before switching tabs — unsaved changes trigger a guard dialog."
        ],
        highlights: [
            { title: "API key", detail: "Direct backend access only; do not expose it to the frontend." },
            { title: "Tracemalloc", detail: "Memory profiling for backend diagnostics only." }
        ]
    },
    filesystem: {
        headline: "Mount paths and storage layout for the media virtual filesystem.",
        howToUse: [
            "Configure mount points to match where Plex (or your player) expects media.",
            "Verify paths are reachable from the backend container or host process.",
            "After changing mount or path settings, restart the backend for VFS to remount."
        ],
        cautions: [
            "Requires backend restart — schedule changes during low activity.",
            "Wrong mount paths cause streams to 404 or show empty folders in Plex."
        ],
        tips: ["Library Profiles moved to their own tab — use that for per-profile folder rules."],
        highlights: [
            {
                title: "VFS",
                detail: "Riven mounts debrid content through FUSE with HTTP range support."
            },
            {
                title: "Paths",
                detail: "Keep paths consistent between Docker volumes and host binds."
            }
        ]
    },
    updaters: {
        headline: "Connect Plex, Emby, or Jellyfin and control library sync cadence.",
        howToUse: [
            "Add your media server URL and credentials for the updater you use.",
            "Set sync intervals so library state refreshes without hammering the server.",
            "Enable only the updaters you actually run — unused providers add noise."
        ],
        tips: [
            "If Overseerr reports items as available but Plex does not, check updater connectivity first.",
            "Pair with Content settings if you use watchlists to auto-request media."
        ],
        highlights: [
            {
                title: "Plex token",
                detail: "Found under Plex account settings → Authorized devices."
            },
            {
                title: "Sync",
                detail: "Drives what the backend believes is already in your library."
            }
        ]
    },
    "library-profiles": {
        headline: "Route movies and shows into separate Plex libraries by metadata rules.",
        howToUse: [
            "Create a profile per target library folder (e.g. Kids, 4K, Anime).",
            "Define match rules on genre, rating, language, or custom tags.",
            "Drag rule priority — first match wins when multiple profiles could apply.",
            "Save profiles here; filesystem mount paths must still exist on disk."
        ],
        tips: [
            "This panel saves independently from the schema-driven tabs.",
            "Optional Ranking pack binds Movies & Shows or Anime scrape ranking when the profile matches.",
            "Test with one title before rolling out complex rule chains."
        ],
        highlights: [
            { title: "Profiles", detail: "Each profile maps to a subdirectory under your mount." },
            { title: "Rules", detail: "Combine AND/OR groups for precise library splits." },
            {
                title: "Ranking pack",
                detail: "Override Ranking Studio pack per library; first match with a pack wins."
            }
        ]
    },
    downloaders: {
        headline: "Real-Debrid and downloader credentials plus download policy.",
        howToUse: [
            "Paste your debrid API token — this unlocks cached torrent streaming.",
            "Configure proxy URL if the backend must reach providers through a VPN or SOCKS proxy.",
            "Set download limits and timeouts appropriate for your connection and provider tier."
        ],
        cautions: [
            "Invalid debrid tokens cause the entire scrape→download pipeline to fail silently until logs are checked."
        ],
        tips: ["After token rotation, save here and retry a single failed item from the Library."],
        highlights: [
            { title: "Real Debrid", detail: "Primary path for instant cached releases." },
            {
                title: "Proxy",
                detail: "Optional; required in some restricted network environments."
            }
        ]
    },
    content: {
        headline: "Watchlists, discovery providers, and automated request sources.",
        howToUse: [
            "Enable content providers (Mdblist, Trakt, etc.) that should feed new requests.",
            "Map watchlist IDs and API keys from each provider’s dashboard.",
            "For Trakt OAuth: save Client ID/Secret + redirect URI ({ORIGIN}/api/trakt/oauth/callback), then use Connect Trakt.",
            "Tune polling so new items are picked up without exceeding rate limits."
        ],
        tips: [
            "Overseerr can still request directly — content settings add parallel discovery paths.",
            "Trakt redirect URI must be the frontend BFF callback, not the backend /api/v1 route.",
            "Use Cmd+K to find obscure provider fields quickly."
        ],
        highlights: [
            { title: "Watchlists", detail: "Auto-request media when lists update." },
            { title: "Discovery", detail: "Supplements manual search in Explore." },
            {
                title: "Trakt Connect",
                detail: "OAuth button above the form; tokens stay server-side."
            }
        ]
    },
    scraping: {
        headline: "Indexer connections and torrent scraper orchestration.",
        howToUse: [
            "Configure indexers (Jackett, Prowlarr URLs, etc.) with correct API keys.",
            "Enable scrapers that match your indexer capabilities and quality preferences.",
            "Set concurrency and timeouts — too aggressive scraping triggers indexer bans.",
            "Anime soft-opt-ins (extras.dubbed / MULTI audio) live here — Ranking Studio deep-links to them.",
            "Remake aliases (enable_remake_aliases + remake_alias_groups) are opt-in for live scrape remakes."
        ],
        cautions: ["Indexer misconfiguration is the #1 cause of 'no results' after a request."],
        tips: [
            "Ranking filters apply after scrape — if everything is rejected, check Ranking tab deny keys.",
            "Indexer and scraper sections are grouped here; use search to jump to a provider.",
            "Soft-opt-ins never change Ranking presets automatically — enable intentionally."
        ],
        highlights: [
            { title: "Indexers", detail: "Provide raw torrent search APIs." },
            { title: "Scrapers", detail: "Parse, dedupe, and hand off to RTN ranking." }
        ]
    },
    ranking: {
        headline: "Two packs: Movies & Shows vs Anime — edit quality independently.",
        howToUse: [
            "Switch pack (Movies & Shows / Anime) before editing Filters — each saves to its own settings key.",
            "Use Filters for the Fetch|Custom|Rank matrix; Languages / Patterns / Options for RTN lists.",
            "Presets (Balanced, WEB-DL, Strict, Anime Dub Friendly, Remux Max, Kids Safe) apply to the active pack only.",
            "Paste a release title in Tester to preview accept/reject without saving.",
            "When Tester shows extras_dubbed or missing_required_language, follow the Scraping soft-opt-in link.",
            "title_mismatch / remakes: matching modes with scrape badge write title_similarity; remake_diagnose is tester-only.",
            "Live remakes: Scraping → enable_remake_aliases + remake_alias_groups (default off) — not silent acceptance.",
            "Load scrape funnel by item id to see rtn_top deny buckets after a scrape."
        ],
        tips: [
            "Anime scrapes use ranking_anime; movies/shows use ranking — changing one never overwrites the other.",
            "Disney+/Amazon WEB-DL often needs audio_dolby_digital_plus fetch enabled on the Movies pack.",
            "Wrap regex in /slashes/ for case-sensitive patterns; Validate & preview before save.",
            "Anime Dub Friendly never silently enables Scraping soft-opt-ins — confirm the dialog."
        ],
        cautions: [
            "Over-aggressive deny rules produce empty scrape results with no obvious UI error.",
            "Save each pack separately if both have unsaved edits."
        ],
        highlights: [
            { title: "Packs", detail: "Movies & Shows → ranking; Anime → ranking_anime." },
            { title: "Fetch", detail: "When false, matching releases are rejected outright." },
            {
                title: "Patterns",
                detail: "require / exclude / preferred regex lists with ReDoS guards."
            },
            {
                title: "Soft-opt-ins",
                detail: "Scraping anime toggles are separate from Ranking presets."
            }
        ]
    },
    database: {
        headline: "Database connection string, pool, and migration settings.",
        howToUse: [
            "Set the PostgreSQL connection string — this is usually configured once at initial deploy.",
            "Adjust pool size and timeout if you see connection exhaustion warnings in logs.",
            "After changing database settings, a backend restart is required."
        ],
        cautions: [
            "Database URL changes need a controlled maintenance window — data is not migrated automatically.",
            "Requires backend restart."
        ],
        tips: [
            "The backend runs migrations on startup — ensure the database user has ALTER TABLE privileges."
        ],
        highlights: [
            {
                title: "Connection string",
                detail: "postgresql+psycopg2://user:pass@host/dbname format."
            },
            { title: "Pool", detail: "Default pool of 5 is fine for single-user setups." }
        ]
    },
    notifications: {
        headline: "Apprise webhooks and per-event alert configuration.",
        howToUse: [
            "Add Apprise-compatible URLs (Discord, Slack, Gotify, Ntfy, etc.) to the endpoints list.",
            "Enable the pipeline events you want to receive alerts for (item added, download complete…).",
            "Test with a single endpoint before enabling all events."
        ],
        tips: [
            "Notification failures never block downloads — check logs if alerts stop.",
            "Apprise supports 80+ services — use the Apprise URL format for each provider."
        ],
        highlights: [
            {
                title: "Apprise",
                detail: "Single URL scheme covers Discord, Slack, email, Telegram, and more."
            },
            { title: "Events", detail: "Subscribe only to the pipeline events you care about." }
        ]
    },
    ops: {
        headline: "Subtitles, log files, and the stream proxy that feeds Plex.",
        howToUse: [
            "Post-processing: enable subtitles, pick languages (ISO 639-2), and set OpenSubtitles credentials.",
            "Logging: set log rotation, retention, and output format.",
            "Stream: tune chunk sizes, CDN validation, and timeout values for Plex playback."
        ],
        cautions: [
            "Stream changes apply to newly opened playback sessions; reopen an active video to use the new values.",
            "Aggressive stream timeouts may cause Plex buffering on large 4K remux files."
        ],
        tips: [
            "Increase stream read timeout if Plex buffers at the start of 4K remux content.",
            "Post-processing scripts run as the container user — verify file permissions."
        ],
        highlights: [
            { title: "Post-processing", detail: "Runs after debrid download completes." },
            { title: "Stream", detail: "VFS + chunker path to Plex; validates CDN URLs strictly." }
        ]
    }
};

export function getTabGuide(tabId: SectionTabId): SettingsTabGuide | undefined {
    return SETTINGS_TAB_GUIDES[tabId];
}
