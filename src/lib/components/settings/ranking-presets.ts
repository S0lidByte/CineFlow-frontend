/**
 * Named ranking presets applied via Ranking Studio (editable packs).
 * Inspired by riven-ts download-flow intent (WEB-DL / anime / matte exclude),
 * never hardcoded as engine overrides.
 */
export type RankingPresetId =
    | "balanced"
    | "webdl"
    | "strict"
    | "anime_dub"
    | "remux_max"
    | "kids_safe";

export interface ScrapingHint {
    path: string;
    label: string;
    recommended: boolean;
}

export interface RankingPreset {
    id: RankingPresetId;
    label: string;
    description: string;
    /** category → attributes that should have fetch=true; others in known cats set false */
    enableFetch: Record<string, string[]>;
    /** Merge into ranking.options when present */
    options?: Record<string, unknown>;
    /** Replace language lists when present */
    languages?: Partial<RankingLanguages>;
    /** Replace pattern lists when present */
    require?: string[];
    exclude?: string[];
    preferred?: string[];
    /** Merge into resolutions when present */
    resolutions?: Record<string, boolean>;
    /**
     * Scraping soft-opt-ins this preset relates to.
     * Never applied automatically — UI must confirm / deep-link.
     */
    scrapingHints?: ScrapingHint[];
}

export type RankingLanguages = {
    required: string[];
    allowed: string[];
    exclude: string[];
    preferred: string[];
};

export const RANKING_PRESETS: RankingPreset[] = [
    {
        id: "balanced",
        label: "Balanced",
        description: "Keep common WEB-DL/BluRay codecs; reject cams and most trash.",
        enableFetch: {
            quality: ["avc", "hevc", "bluray", "hdtv", "web", "webdl"],
            audio: [
                "aac",
                "atmos",
                "dolby_digital",
                "dolby_digital_plus",
                "dts_lossy",
                "truehd",
                "flac",
                "surround",
                "stereo"
            ],
            hdr: ["hdr", "hdr10plus", "dolby_vision", "sdr", "bit10"],
            rips: ["brrip", "hdrip", "webrip"],
            extras: ["proper", "repack", "scene", "edition"],
            trash: []
        },
        options: {
            title_similarity: 0.85,
            remove_all_trash: true,
            remove_adult_content: true
        },
        resolutions: { r2160p: true, r1080p: true, r720p: true },
        exclude: [String.raw`\bmatte\b`]
    },
    {
        id: "webdl",
        label: "WEB-DL permissive",
        description:
            "Disney+/Amazon friendly — DDP/DD fetch on; remux/AV1/DV allowed; matte excluded.",
        enableFetch: {
            quality: ["avc", "hevc", "av1", "web", "webdl", "hdtv", "bluray", "remux"],
            audio: [
                "aac",
                "atmos",
                "dolby_digital",
                "dolby_digital_plus",
                "dts_lossy",
                "surround",
                "stereo"
            ],
            hdr: ["hdr", "hdr10plus", "dolby_vision", "sdr", "bit10"],
            rips: ["webrip", "hdrip", "bdrip", "webdlrip", "uhdrip"],
            extras: ["proper", "repack", "dubbed", "subbed", "scene", "site", "documentary"],
            trash: []
        },
        options: {
            title_similarity: 0.8,
            remove_all_trash: true,
            remove_adult_content: true
        },
        resolutions: { r2160p: true, r1080p: true, r720p: true },
        exclude: [String.raw`\bmatte\b`],
        preferred: [String.raw`\b4[Kk]|2160p?\b`, "HDR|HDR10"]
    },
    {
        id: "strict",
        label: "Strict quality",
        description: "Prefer remux / BluRay / HEVC; reject WEB-DL and dubbed.",
        enableFetch: {
            quality: ["hevc", "avc", "bluray", "remux"],
            audio: ["atmos", "truehd", "dts_lossless", "flac"],
            hdr: ["hdr", "hdr10plus", "dolby_vision", "bit10"],
            rips: [],
            extras: ["proper", "repack"],
            trash: []
        },
        options: {
            title_similarity: 0.9,
            remove_all_trash: true,
            remove_adult_content: true
        },
        resolutions: { r2160p: true, r1080p: true, r720p: false },
        exclude: [String.raw`\bmatte\b`, String.raw`\bCAM\b`, String.raw`\bTS\b`]
    },
    {
        id: "anime_dub",
        label: "Anime Dub Friendly",
        description:
            "Allow dual/MULTi/dubbed + common WEB encodes. Does not change Scraping soft-opt-ins.",
        enableFetch: {
            quality: ["avc", "hevc", "web", "webdl", "hdtv", "bluray"],
            audio: ["aac", "flac", "stereo", "surround", "dolby_digital", "dolby_digital_plus"],
            hdr: ["sdr", "hdr", "bit10"],
            rips: ["webrip", "hdrip"],
            extras: ["dubbed", "subbed", "proper", "repack", "uncensored", "scene"],
            trash: []
        },
        options: {
            title_similarity: 0.75,
            remove_all_trash: true,
            allow_english_in_languages: true
        },
        languages: {
            preferred: ["anime"],
            required: [],
            allowed: [],
            exclude: []
        },
        resolutions: { r2160p: true, r1080p: true, r720p: true },
        exclude: [String.raw`\bmatte\b`],
        scrapingHints: [
            {
                path: "scraping.anime_allow_extras_dubbed",
                label: "Anime allow extras.dubbed (soft-opt-in)",
                recommended: true
            },
            {
                path: "scraping.anime_allow_multi_audio",
                label: "Anime allow MULTI/dual-audio retry",
                recommended: true
            }
        ]
    },
    {
        id: "remux_max",
        label: "Remux Max",
        description: "Remux / BluRay / HEVC / lossless audio first; WEB-DL off.",
        enableFetch: {
            quality: ["hevc", "avc", "bluray", "remux"],
            audio: ["atmos", "truehd", "dts_lossless", "flac"],
            hdr: ["hdr", "hdr10plus", "dolby_vision", "bit10"],
            rips: ["bdrip", "uhdrip"],
            extras: ["proper", "repack"],
            trash: []
        },
        options: {
            title_similarity: 0.88,
            remove_all_trash: true,
            remove_adult_content: true
        },
        resolutions: { r2160p: true, r1080p: true, r720p: false },
        preferred: [String.raw`\bREMUX\b`, String.raw`\bBluRay\b`, "HDR|HDR10"],
        exclude: [String.raw`\bmatte\b`]
    },
    {
        id: "kids_safe",
        label: "Kids Safe",
        description: "Hard-reject trash/adult; tighter title match; no CAM/SCR.",
        enableFetch: {
            quality: ["avc", "hevc", "web", "webdl", "bluray", "hdtv"],
            audio: ["aac", "stereo", "surround", "dolby_digital", "dolby_digital_plus"],
            hdr: ["sdr", "hdr", "bit10"],
            rips: ["webrip", "hdrip"],
            extras: ["proper", "repack", "dubbed", "subbed", "scene"],
            trash: []
        },
        options: {
            title_similarity: 0.9,
            remove_all_trash: true,
            remove_adult_content: true
        },
        resolutions: { r2160p: false, r1080p: true, r720p: true, r480p: false },
        exclude: [
            String.raw`\bxxx\b`,
            String.raw`\bporn\b`,
            String.raw`\bmatte\b`,
            String.raw`\bCAM\b`
        ]
    }
];

export type CustomRankValue = {
    fetch?: boolean;
    use_custom_rank?: boolean;
    rank?: number;
};

export type RankingSettings = {
    custom_ranks?: Record<string, Record<string, CustomRankValue>>;
    resolutions?: Record<string, boolean>;
    options?: Record<string, unknown>;
    languages?: Partial<RankingLanguages> & Record<string, string[] | undefined>;
    require?: string[];
    exclude?: string[];
    preferred?: string[];
    [key: string]: unknown;
};

/** Title-matching modes for remake / alias diagnose (mirrors BE contract). */
export type TitleMatchingModeId =
    | "strict"
    | "balanced"
    | "aliases_friendly"
    | "remake_diagnose";

export interface TitleMatchingMode {
    id: TitleMatchingModeId;
    label: string;
    title_similarity: number;
    enable_aliases: boolean;
    description: string;
    diagnose_only: boolean;
}

export const TITLE_MATCHING_MODES: TitleMatchingMode[] = [
    {
        id: "strict",
        label: "Strict",
        title_similarity: 0.9,
        enable_aliases: true,
        description: "Tight Levenshtein match. Best default when titles are stable.",
        diagnose_only: false
    },
    {
        id: "balanced",
        label: "Balanced",
        title_similarity: 0.85,
        enable_aliases: true,
        description: "Default RTN threshold with aliases enabled.",
        diagnose_only: false
    },
    {
        id: "aliases_friendly",
        label: "Aliases friendly",
        title_similarity: 0.8,
        enable_aliases: true,
        description:
            "Slightly looser match while relying on Trakt/TMDB aliases. Keep Scraping → enable_aliases on.",
        diagnose_only: false
    },
    {
        id: "remake_diagnose",
        label: "Remake diagnose",
        title_similarity: 0.7,
        enable_aliases: true,
        description:
            "Temporary diagnose for remakes (e.g. Saint Seiya vs Knights of the Zodiac). Do not leave this low permanently.",
        diagnose_only: true
    }
];

export function applyTitleMatchingMode(
    ranking: RankingSettings,
    mode: TitleMatchingMode
): RankingSettings {
    const next = structuredClone(ranking);
    next.options = {
        ...(next.options ?? {}),
        title_similarity: mode.title_similarity
    };
    return next;
}

/** Deny keys that should deep-link to Scraping soft-opt-ins. */
export const DENY_TO_SCRAPING: Record<string, { path: string; label: string; hint: string }> = {
    extras_dubbed: {
        path: "scraping.anime_allow_extras_dubbed",
        label: "Anime allow extras.dubbed",
        hint: "Scraping soft-opt-in enables extras.dubbed.fetch for anime items only."
    },
    missing_required_language: {
        path: "scraping.anime_allow_multi_audio",
        label: "Anime allow MULTI/dual-audio",
        hint: "Scraping soft-opt-in retries MULTI/dual titles after language rejects."
    },
    title_mismatch: {
        path: "scraping.enable_aliases",
        label: "Enable title aliases",
        hint: "Use matching modes + aliases to diagnose remakes; do not silently accept wrong titles."
    }
};

/** Apply preset onto a deep-cloned ranking settings object (ranking only). */
export function applyRankingPreset(
    ranking: RankingSettings,
    preset: RankingPreset
): RankingSettings {
    const next = structuredClone(ranking);
    const ranks = next.custom_ranks ?? {};
    for (const [category, attrs] of Object.entries(ranks)) {
        const enabled = new Set(preset.enableFetch[category] ?? []);
        for (const [attr, value] of Object.entries(attrs)) {
            if (!value || typeof value !== "object") continue;
            value.fetch = enabled.has(attr);
        }
    }
    next.custom_ranks = ranks;

    if (preset.options) {
        next.options = { ...(next.options ?? {}), ...preset.options };
    }
    if (preset.resolutions) {
        next.resolutions = { ...(next.resolutions ?? {}), ...preset.resolutions };
    }
    if (preset.languages) {
        next.languages = {
            required: preset.languages.required ?? next.languages?.required ?? [],
            allowed: preset.languages.allowed ?? next.languages?.allowed ?? [],
            exclude: preset.languages.exclude ?? next.languages?.exclude ?? [],
            preferred: preset.languages.preferred ?? next.languages?.preferred ?? []
        };
    }
    if (preset.require !== undefined) next.require = [...preset.require];
    if (preset.exclude !== undefined) next.exclude = [...preset.exclude];
    if (preset.preferred !== undefined) next.preferred = [...preset.preferred];

    return next;
}

export function humanizeAttr(key: string, titles?: Record<string, string>): string {
    if (titles?.[key]) return titles[key];
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function denyKeyFor(category: string, attribute: string): string {
    return `${category}_${attribute}`;
}

export function countRejecting(ranking: RankingSettings): number {
    let n = 0;
    const ranks = ranking.custom_ranks ?? {};
    for (const attrs of Object.values(ranks)) {
        for (const value of Object.values(attrs)) {
            if (value && typeof value === "object" && value.fetch === false) n += 1;
        }
    }
    return n;
}

export function ensureLanguages(ranking: RankingSettings): RankingLanguages {
    return {
        required: [...(ranking.languages?.required ?? [])],
        allowed: [...(ranking.languages?.allowed ?? [])],
        exclude: [...(ranking.languages?.exclude ?? [])],
        preferred: [...(ranking.languages?.preferred ?? [])]
    };
}

export function linesToPatterns(text: string): string[] {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

export function patternsToLines(patterns: string[] | undefined): string {
    return (patterns ?? []).join("\n");
}

/** Client-side length/count checks only — compile/ReDoS belong to BFF validate. */
export const PATTERN_LIMITS = {
    maxPerList: 32,
    maxLength: 200
} as const;

export function clientValidatePatterns(patterns: string[]): string[] {
    const errors: string[] = [];
    if (patterns.length > PATTERN_LIMITS.maxPerList) {
        errors.push(`At most ${PATTERN_LIMITS.maxPerList} patterns allowed`);
    }
    for (const [i, pattern] of patterns.entries()) {
        if (pattern.length > PATTERN_LIMITS.maxLength) {
            errors.push(`Pattern ${i + 1} exceeds ${PATTERN_LIMITS.maxLength} chars`);
        }
    }
    return errors;
}
