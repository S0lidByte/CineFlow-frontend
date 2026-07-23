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
 * Single-pass scan: tests each field for an exact attr match first, then a
 * leaf-key attr match, then a text-content match. Tracks the best weak match
 * seen so far and returns it as a fallback — avoiding a second full traversal.
 */
export function findFieldElement(focusPath: string): HTMLElement | null {
    const form = document.querySelector(".settings-form");
    if (!form) return null;

    const leaf = focusPath.split(".").pop()?.toLowerCase() ?? "";
    const normalizedPath = focusPath.toLowerCase();
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

    // Expand any collapsed ancestor fieldsets so the target is visible.
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
        ancestor = ancestor.parentElement;
    }

    document
        .querySelectorAll(".settings-form [data-settings-focus='true']")
        .forEach((node) => node.removeAttribute("data-settings-focus"));

    el.setAttribute("data-settings-focus", "true");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>(
        "input, select, textarea, button, [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus({ preventScroll: true });
    return true;
}
