/**
 * Settings search index: sections + flattened schema fields.
 * Used by the Cmd+K palette to jump to a tab and optionally focus a field.
 */
import { getTabIdForSettingsKey, SETTINGS_TABS, type SectionTabId } from "./sections";

export type SettingsSearchKind = "section" | "field";

export interface SettingsSearchEntry {
    id: string;
    kind: SettingsSearchKind;
    tabId: SectionTabId;
    label: string;
    description: string;
    /** Dot path under the form root, e.g. ranking.custom_ranks.audio.dolby_digital_plus */
    path?: string;
    /** Extra tokens for matching (deny keys, aliases) */
    keywords?: string[];
}

const RANKING_DENY_KEYWORDS: {
    path: string;
    label: string;
    description: string;
    keywords: string[];
}[] = [
    {
        path: "ranking.custom_ranks.audio.dolby_digital_plus",
        label: "Dolby Digital Plus (DDP)",
        description: "Disney+/Amazon WEB-DL audio. Log: denied by: audio_dolby_digital_plus",
        keywords: ["audio_dolby_digital_plus", "ddp", "dd+", "denied"]
    },
    {
        path: "ranking.custom_ranks.audio.dolby_digital",
        label: "Dolby Digital (DD/AC3)",
        description: "Log: denied by: audio_dolby_digital",
        keywords: ["audio_dolby_digital", "ac3", "dd5", "denied"]
    },
    {
        path: "ranking.custom_ranks.audio.atmos",
        label: "Dolby Atmos",
        description: "Log: denied by: audio_atmos",
        keywords: ["audio_atmos", "denied"]
    },
    {
        path: "ranking.custom_ranks.quality.remux",
        label: "Remux",
        description: "Log: denied by: quality_remux",
        keywords: ["quality_remux", "denied"]
    },
    {
        path: "ranking.custom_ranks.extras.dubbed",
        label: "Dubbed / Dual / MULTi",
        description: "Log: denied by: extras_dubbed",
        keywords: ["extras_dubbed", "multi", "dual", "denied"]
    },
    {
        path: "ranking.custom_ranks.extras.site",
        label: "Site tags (YTS, RARBG)",
        description: "Log: denied by: extras_site",
        keywords: ["extras_site", "yts", "rarbg", "denied"]
    },
    {
        path: "ranking.custom_ranks.rips.dvdrip",
        label: "DVDRip",
        description: "Log: denied by: rips_dvdrip",
        keywords: ["rips_dvdrip", "denied"]
    },
    {
        path: "ranking.custom_ranks.rips.bdrip",
        label: "BDRip",
        description: "Log: denied by: rips_bdrip",
        keywords: ["rips_bdrip", "denied"]
    },
    {
        path: "ranking.options.remove_all_trash",
        label: "Remove all trash",
        description: "Enable trash heuristics and trash custom_ranks fetch rules",
        keywords: ["trash", "remove_all_trash"]
    },
    {
        path: "ranking.options.remove_ranks_under",
        label: "Minimum rank threshold",
        description: "Log: does not meet the minimum rank requirement",
        keywords: ["remove_ranks_under", "minimum rank"]
    }
];

function humanizeKey(key: string): string {
    return key
        .replace(/^r(\d+p)$/i, "$1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveRef(
    schema: Record<string, unknown>,
    node: Record<string, unknown>
): Record<string, unknown> {
    const ref = node.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) {
        return node;
    }
    const defName = ref.slice("#/$defs/".length);
    const defs = schema.$defs as Record<string, unknown> | undefined;
    const def = defs?.[defName];
    return def && typeof def === "object" ? (def as Record<string, unknown>) : node;
}

function walkSchemaFields(
    schema: Record<string, unknown>,
    node: Record<string, unknown>,
    pathParts: string[],
    out: SettingsSearchEntry[]
): void {
    const resolved = resolveRef(schema, node);
    const props = resolved.properties as Record<string, unknown> | undefined;
    if (!props || typeof props !== "object") return;

    for (const [key, raw] of Object.entries(props)) {
        if (!raw || typeof raw !== "object") continue;
        const prop = resolveRef(schema, raw as Record<string, unknown>);
        const nextPath = [...pathParts, key];
        const path = nextPath.join(".");
        const topKey = nextPath[0];
        const tabId = getTabIdForSettingsKey(topKey);
        if (!tabId) continue;

        const title = (typeof prop.title === "string" && prop.title) || humanizeKey(key);
        const description = (typeof prop.description === "string" && prop.description) || "";

        out.push({
            id: `field:${path}`,
            kind: "field",
            tabId,
            label: title,
            description,
            path,
            keywords: [key, path, ...(description.match(/denied by:\s*[\w]+/gi) ?? [])]
        });

        if (prop.type === "object" || prop.properties || prop.$ref) {
            walkSchemaFields(schema, prop, nextPath, out);
        }
    }
}

/** Build search entries from a full (or filtered) settings JSON schema. */
export function buildFieldIndexFromSchema(
    schema: Record<string, unknown> | null | undefined
): SettingsSearchEntry[] {
    if (!schema || typeof schema !== "object") return [];
    const out: SettingsSearchEntry[] = [];
    walkSchemaFields(schema, schema, [], out);
    return out;
}

export function buildSectionSearchEntries(): SettingsSearchEntry[] {
    return SETTINGS_TABS.map((tab) => ({
        id: `section:${tab.id}`,
        kind: "section" as const,
        tabId: tab.id,
        label: tab.label,
        description: tab.description,
        keywords: [...tab.keys, tab.id]
    }));
}

/** Always-available ranking shortcuts (works even before full schema loads). */
export function buildRankingShortcutEntries(): SettingsSearchEntry[] {
    return RANKING_DENY_KEYWORDS.map((item) => ({
        id: `field:${item.path}`,
        kind: "field" as const,
        tabId: "ranking",
        label: item.label,
        description: item.description,
        path: item.path,
        keywords: item.keywords
    }));
}

const LIBRARY_PROFILES_SHORTCUTS: {
    path: string;
    label: string;
    description: string;
    keywords: string[];
}[] = [
    {
        path: "library_profiles.name",
        label: "Profile name",
        description: "Human-readable library profile name",
        keywords: ["name", "profile"]
    },
    {
        path: "library_profiles.library_path",
        label: "Library path",
        description: "VFS path prefix for a profile (e.g. /anime)",
        keywords: ["path", "vfs", "library_path"]
    },
    {
        path: "library_profiles.enabled",
        label: "Profile enabled",
        description: "Include this profile when matching media",
        keywords: ["enabled", "toggle"]
    },
    {
        path: "library_profiles.filter_rules.content_types",
        label: "Content types",
        description: "Restrict profile to movie and/or show",
        keywords: ["movie", "show", "content_types"]
    },
    {
        path: "library_profiles.filter_rules.is_anime",
        label: "Anime only",
        description: "Match only anime-flagged content",
        keywords: ["anime", "is_anime"]
    },
    {
        path: "library_profiles.filter_rules.genres",
        label: "Genres filter",
        description: "Include or exclude genres (!prefix to exclude)",
        keywords: ["genres", "filter"]
    },
    {
        path: "library_profiles.filter_rules.min_year",
        label: "Year range",
        description: "Minimum and maximum release year",
        keywords: ["year", "min_year", "max_year"]
    },
    {
        path: "library_profiles.filter_rules.min_rating",
        label: "Rating range",
        description: "Minimum and maximum rating (0–10)",
        keywords: ["rating", "min_rating", "max_rating"]
    },
    {
        path: "library_profiles.filter_rules.content_ratings",
        label: "Content ratings",
        description: "G, PG, TV-MA, and similar ratings",
        keywords: ["content_ratings", "pg", "tv-ma"]
    },
    {
        path: "library_profiles.filter_rules.languages",
        label: "Languages filter",
        description: "Include or exclude languages",
        keywords: ["languages", "lang"]
    },
    {
        path: "library_profiles.filter_rules.countries",
        label: "Countries filter",
        description: "Include or exclude countries",
        keywords: ["countries"]
    },
    {
        path: "library_profiles.filter_rules.networks",
        label: "Networks filter",
        description: "Include or exclude networks (HBO, Netflix, …)",
        keywords: ["networks", "hbo", "netflix"]
    }
];

/** Library Profiles field shortcuts (custom tab — not in JSON schema). */
export function buildLibraryProfilesShortcutEntries(): SettingsSearchEntry[] {
    return LIBRARY_PROFILES_SHORTCUTS.map((item) => ({
        id: `field:${item.path}`,
        kind: "field" as const,
        tabId: "library-profiles",
        label: item.label,
        description: item.description,
        path: item.path,
        keywords: item.keywords
    }));
}

export function mergeSearchEntries(...groups: SettingsSearchEntry[][]): SettingsSearchEntry[] {
    const byId = new Map<string, SettingsSearchEntry>();
    for (const group of groups) {
        for (const entry of group) {
            const existing = byId.get(entry.id);
            if (!existing) {
                byId.set(entry.id, entry);
                continue;
            }
            // Prefer richer descriptions from schema enrichment
            if (
                entry.description.length > existing.description.length ||
                (entry.path && !existing.path)
            ) {
                byId.set(entry.id, {
                    ...existing,
                    ...entry,
                    keywords: [
                        ...new Set([...(existing.keywords ?? []), ...(entry.keywords ?? [])])
                    ]
                });
            }
        }
    }
    return [...byId.values()];
}

export function filterSearchEntries(
    entries: SettingsSearchEntry[],
    query: string
): SettingsSearchEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) {
        return entries.filter((e) => e.kind === "section");
    }
    return entries.filter((entry) => {
        const haystack = [
            entry.label,
            entry.description,
            entry.path ?? "",
            entry.tabId,
            ...(entry.keywords ?? [])
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(q);
    });
}

/** Match a focus path to a rendered field card in the settings form.
 *
 * Prefers custom-panel anchors (`data-settings-search-path`), then SJSF fields.
 */
export function findFieldElement(focusPath: string): HTMLElement | null {
    const normalizedPath = focusPath.toLowerCase();
    const exactCustom = document.querySelector<HTMLElement>(
        `[data-settings-search-path="${CSS.escape(focusPath)}"]`
    );
    if (exactCustom) return exactCustom;

    const customNodes = document.querySelectorAll<HTMLElement>("[data-settings-search-path]");
    for (const node of customNodes) {
        const path = node.getAttribute("data-settings-search-path")?.toLowerCase() ?? "";
        if (path === normalizedPath || path.endsWith(`.${normalizedPath.split(".").pop()}`)) {
            return node;
        }
    }

    const form = document.querySelector(".settings-form");
    if (!form) return null;

    const leaf = focusPath.split(".").pop()?.toLowerCase() ?? "";
    const leafHuman = leaf.replace(/_/g, " ");
    const fields = form.querySelectorAll<HTMLElement>('[data-slot="field"]');

    let weakMatch: HTMLElement | null = null;

    for (const field of fields) {
        const nameAttrs = Array.from(field.querySelectorAll("[name], [id], [for]"))
            .flatMap((el) => {
                const h = el as HTMLElement;
                return [h.getAttribute("name"), h.getAttribute("id"), h.getAttribute("for")];
            })
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        // Strong match: attribute contains the full path or the leaf key
        if (nameAttrs.includes(normalizedPath) || nameAttrs.includes(leaf)) {
            return field;
        }

        // Weak match: visible text contains the humanized leaf (e.g. "dolby digital")
        if (!weakMatch && leaf.length > 2) {
            const text = field.textContent?.toLowerCase() ?? "";
            if (text.includes(leafHuman)) {
                weakMatch = field;
            }
        }
    }

    return weakMatch;
}

export function highlightAndScrollToField(focusPath: string): boolean {
    const el = findFieldElement(focusPath);
    if (!el) return false;

    // Expand any collapsed ancestor fieldsets / details so the target is visible.
    let ancestor: HTMLElement | null = el;
    while (ancestor) {
        if (
            ancestor.matches?.('fieldset[data-slot="field-set"][data-collapsed]') ||
            (ancestor.tagName === "FIELDSET" && ancestor.hasAttribute("data-collapsed"))
        ) {
            const content = ancestor.querySelector<HTMLElement>(
                ':scope > [data-slot="field-group"]'
            );
            const legend = ancestor.querySelector<HTMLElement>(
                ':scope > legend[data-slot="field-legend"]'
            );
            ancestor.removeAttribute("data-collapsed");
            if (content) content.hidden = false;
            legend?.setAttribute("aria-expanded", "true");
        }
        if (ancestor instanceof HTMLDetailsElement) {
            ancestor.open = true;
        }
        ancestor = ancestor.parentElement;
    }

    document
        .querySelectorAll("[data-settings-focus='true']")
        .forEach((node) => node.removeAttribute("data-settings-focus"));

    el.setAttribute("data-settings-focus", "true");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>(
        "input, select, textarea, button, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus({ preventScroll: true });
    return true;
}
