import { normalizeTitle } from "$lib/utils/string";

// RT matching tunables (matching Jellyseerr / CineFlow canonical specification)
export const INEXACT_TITLE_FACTOR = 0.25;
export const ALTERNATE_TITLE_FACTOR = 0.8;
export const PER_YEAR_PENALTY = 0.4;
export const MINIMUM_SCORE = 0.175;

export interface RatingScore {
    name: string;
    image: string;
    score: number | string;
    url: string;
}

export interface RatingsResponse {
    scores: RatingScore[];
    tmdbId: number;
    mediaType: "movie" | "tv";
    imdbId: string | null;
}

export interface RadarrImdbResponse {
    ImdbId: string;
    MovieRatings: {
        Imdb?: { Value: number };
    };
}

export interface RTAlgoliaSearchResponse {
    results: {
        hits: RTAlgoliaHit[];
        index: "content_rt" | "people_rt";
    }[];
}

export interface RTAlgoliaHit {
    title: string;
    titles?: string[];
    releaseYear: number;
    vanity: string;
    aka?: string[];
    rottenTomatoes?: {
        audienceScore: number;
        certifiedFresh: boolean;
        criticsScore: number;
    };
}

/**
 * Jaro similarity algorithm for fuzzy string matching.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
export function jaroSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, s2.length);

        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    return (
        (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
    );
}

/**
 * Calculate title similarity with inexact matching penalty.
 */
export function titleSimilarity(a: string, b: string): number {
    return a === b ? 1 : jaroSimilarity(a, b) * INEXACT_TITLE_FACTOR;
}

/**
 * Get best similarity score between searched title and all alternate titles of a candidate.
 */
export function getTitleScore(hit: RTAlgoliaHit, searchTitle: string): number {
    const normalizedSearch = normalizeTitle(searchTitle);

    const scoreTitleVariant = (title: string, isAlternate: boolean): number => {
        const score = titleSimilarity(normalizeTitle(title), normalizedSearch);
        return isAlternate ? score * ALTERNATE_TITLE_FACTOR : score;
    };

    const allTitles = [hit.title, ...(hit.aka || []), ...(hit.titles || [])];
    const scores = allTitles.map((t, i) => scoreTitleVariant(t, i > 0));

    return Math.max(...scores);
}

/**
 * Calculate year match score with penalty for year difference (0.4 per year delta).
 */
export function getYearScore(hit: RTAlgoliaHit, year?: number): number {
    if (!year || typeof hit.releaseYear !== "number" || isNaN(hit.releaseYear)) return 1;
    return Math.max(0, 1 - Math.abs(hit.releaseYear - year) * PER_YEAR_PENALTY);
}

/**
 * Score factor based on presence of Rotten Tomatoes score data.
 */
export function getExtraScore(hit: RTAlgoliaHit): number {
    return hit.rottenTomatoes ? 1 : 0.5;
}

/**
 * Composite candidate match scoring function.
 */
export function calculateScore(hit: RTAlgoliaHit, title: string, year?: number): number {
    return getTitleScore(hit, title) * getYearScore(hit, year) * getExtraScore(hit);
}

/**
 * Find the best matching RT result based on combined scoring and threshold filtering.
 */
export function findBestRTMatch(
    hits: RTAlgoliaHit[],
    title: string,
    year?: number
): RTAlgoliaHit | null {
    const scored = hits
        .map((hit) => ({ hit, score: calculateScore(hit, title, year) }))
        .filter(({ score }) => score > MINIMUM_SCORE)
        .sort((a, b) => b.score - a.score);

    return scored[0]?.hit || null;
}

/**
 * Format Rotten Tomatoes Tomatometer Critics Score badge.
 */
export function formatRTCriticsScore(
    hit: RTAlgoliaHit,
    mediaType: "movie" | "tv"
): RatingScore | null {
    if (!hit.rottenTomatoes || hit.rottenTomatoes.criticsScore <= 0) {
        return null;
    }

    const rt = hit.rottenTomatoes;
    const rtUrl = `https://www.rottentomatoes.com/${mediaType === "movie" ? "m" : "tv"}/${hit.vanity}`;

    let criticsName: string;
    let criticsImage: string;

    if (mediaType === "movie" && rt.certifiedFresh) {
        criticsName = "rt_tomatometer_certified_fresh";
        criticsImage = "rt_certified_fresh.svg";
    } else if (rt.criticsScore >= 60) {
        criticsName = "rt_tomatometer_fresh";
        criticsImage = "rt_fresh.svg";
    } else {
        criticsName = "rt_tomatometer_rotten";
        criticsImage = "rt_rotten.svg";
    }

    return {
        name: criticsName,
        image: criticsImage,
        score: `${rt.criticsScore}%`,
        url: rtUrl
    };
}

/**
 * Format Rotten Tomatoes Popcornmeter Audience Score badge.
 */
export function formatRTAudienceScore(
    hit: RTAlgoliaHit,
    mediaType: "movie" | "tv"
): RatingScore | null {
    if (!hit.rottenTomatoes || hit.rottenTomatoes.audienceScore <= 0) {
        return null;
    }

    const rt = hit.rottenTomatoes;
    const rtUrl = `https://www.rottentomatoes.com/${mediaType === "movie" ? "m" : "tv"}/${hit.vanity}`;
    const isFresh = rt.audienceScore >= 60;

    return {
        name: isFresh ? "rt_popcornmeter_fresh" : "rt_popcornmeter_stale",
        image: isFresh ? "rt_aud_fresh.svg" : "rt_aud_rotten.svg",
        score: `${rt.audienceScore}%`,
        url: rtUrl
    };
}

/**
 * Format IMDb score badge.
 */
export function formatImdbScore(imdbId: string, value: number): RatingScore | null {
    if (!value || value <= 0) return null;
    return {
        name: "imdb",
        image: "imdb.svg",
        score: value,
        url: `https://www.imdb.com/title/${imdbId}/`
    };
}

/**
 * Format TMDB user rating score badge.
 */
export function formatTmdbScore(
    tmdbId: number,
    mediaType: "movie" | "tv",
    voteAverage: number
): RatingScore | null {
    if (!voteAverage || voteAverage <= 0) return null;
    return {
        name: "tmdb",
        image: "tmdb.svg",
        score: `${Math.round(voteAverage * 10)}%`,
        url: `https://www.themoviedb.org/${mediaType}/${tmdbId}`
    };
}
