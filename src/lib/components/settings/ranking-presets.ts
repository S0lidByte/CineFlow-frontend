/**
 * Named ranking presets applied to custom_ranks fetch toggles.
 * Inspired by Riven-TS download-flow overrides (WEB-DL permissive / strict / anime).
 */
export type RankingPresetId = "balanced" | "webdl" | "strict" | "anime";

export interface RankingPreset {
    id: RankingPresetId;
    label: string;
    description: string;
    /** category → attributes that should have fetch=true; others in known cats set false */
    enableFetch: Record<string, string[]>;
}

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
        }
    },
    {
        id: "webdl",
        label: "WEB-DL permissive",
        description: "Disney+/Amazon friendly — DDP/DD fetch on, remux optional.",
        enableFetch: {
            quality: ["avc", "hevc", "web", "webdl", "hdtv", "bluray"],
            audio: [
                "aac",
                "atmos",
                "dolby_digital",
                "dolby_digital_plus",
                "dts_lossy",
                "surround",
                "stereo"
            ],
            hdr: ["hdr", "hdr10plus", "sdr", "bit10"],
            rips: ["webrip", "hdrip"],
            extras: ["proper", "repack", "dubbed", "subbed", "scene"],
            trash: []
        }
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
        }
    },
    {
        id: "anime",
        label: "Anime friendly",
        description: "Allow dual/MULTi audio and common WEB encodes.",
        enableFetch: {
            quality: ["avc", "hevc", "web", "webdl", "hdtv"],
            audio: [
                "aac",
                "flac",
                "stereo",
                "surround",
                "dolby_digital",
                "dolby_digital_plus"
            ],
            hdr: ["sdr", "hdr", "bit10"],
            rips: ["webrip", "hdrip"],
            extras: ["dubbed", "subbed", "proper", "repack", "uncensored", "scene"],
            trash: []
        }
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
    languages?: Record<string, string[]>;
    require?: string[];
    exclude?: string[];
    preferred?: string[];
    [key: string]: unknown;
};

/** Apply preset fetch toggles onto a deep-cloned ranking settings object. */
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
    return next;
}

export function humanizeAttr(key: string, titles?: Record<string, string>): string {
    if (titles?.[key]) return titles[key];
    return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
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
