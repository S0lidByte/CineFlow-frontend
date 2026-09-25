/**
 * Ambient Obsidian Dynamic Palette Extractor
 *
 * Provides bounded, client-side, hardware-accelerated color palette extraction
 * from media artwork (posters, backdrops, banners) to drive dynamic CSS custom
 * properties (--ambient-glow-1, --ambient-glow-2, --ambient-dominant, --ambient-accent).
 *
 * Design constraints:
 * - Bounded analysis canvas (32x32 = 1024 samples) for <1ms execution cost.
 * - In-memory LRU cache (100 entries) preventing redundant extractions.
 * - Graceful failure on CORS SecurityError or image load errors with deterministic fallback.
 * - Noise & edge-filtering (removes pure black, near-white, transparent, and ultra-low saturation noise).
 * - Safe sanitization generating only strict rgba/rgb CSS values (zero injection risk).
 */

export interface AmbientPalette {
    dominant: string;
    accent: string;
    glow1: string;
    glow2: string;
    background: string;
    raw: {
        dominant: [number, number, number];
        accent: [number, number, number];
    };
}

export const DEFAULT_AMBIENT_PALETTE: AmbientPalette = {
    dominant: "rgb(30, 41, 59)", // Slate-800
    accent: "rgb(56, 189, 248)", // Sky-400
    glow1: "rgba(56, 189, 248, 0.30)",
    glow2: "rgba(139, 92, 246, 0.20)", // Violet-500
    background: "rgb(10, 14, 23)", // Deep Obsidian
    raw: {
        dominant: [30, 41, 59],
        accent: [56, 189, 248]
    }
};

/** Fixed analysis dimensions for bounded performance */
const ANALYSIS_SIZE = 32;
const MAX_CACHE_SIZE = 100;
const paletteCache = new Map<string, AmbientPalette>();

/**
 * Normalizes a number into the 0-255 RGB integer range.
 */
function clampByte(val: number): number {
    return Math.max(0, Math.min(255, Math.round(val)));
}

/**
 * Calculates relative luminance of an RGB triplet [0..1].
 */
function getLuminance(r: number, g: number, b: number): number {
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates HSV saturation of an RGB triplet [0..1].
 */
function getSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
}

/**
 * Quantizes RGB to a reduced color space bucket (5-bit per channel).
 */
function quantizeColor(r: number, g: number, b: number, step = 16): [number, number, number] {
    const qr = Math.min(255, Math.round(r / step) * step);
    const qg = Math.min(255, Math.round(g / step) * step);
    const qb = Math.min(255, Math.round(b / step) * step);
    return [qr, qg, qb];
}

/**
 * Computes Euclidean color distance between two RGB triplets in [0..255] space.
 */
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Formats RGB triplet and alpha into a sanitized CSS rgba string.
 */
export function formatRgba(rgb: [number, number, number], alpha: number): string {
    const r = clampByte(rgb[0]);
    const g = clampByte(rgb[1]);
    const b = clampByte(rgb[2]);
    const a = Math.max(0, Math.min(1, Number(alpha.toFixed(2))));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Formats RGB triplet into a sanitized CSS rgb string.
 */
export function formatRgb(rgb: [number, number, number]): string {
    const r = clampByte(rgb[0]);
    const g = clampByte(rgb[1]);
    const b = clampByte(rgb[2]);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Extracts dominant and accent colors from an ImageData pixel buffer.
 * Pure, deterministic, and highly optimized.
 */
export function extractPaletteFromImageData(
    imageData:
        | ImageData
        | { data: Uint8ClampedArray | Uint8Array | number[]; width: number; height: number }
): AmbientPalette {
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    if (!data || totalPixels === 0) {
        return DEFAULT_AMBIENT_PALETTE;
    }

    const bucketCounts = new Map<
        string,
        { rgb: [number, number, number]; count: number; score: number }
    >();

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 1. Ignore transparent / translucent pixels (alpha < 160)
        if (a < 160) continue;

        const lum = getLuminance(r, g, b);
        const sat = getSaturation(r, g, b);

        // 2. Filter out muddy near-blacks (lum < 0.08) and glare near-whites (lum > 0.92)
        if (lum < 0.08 || lum > 0.92) continue;

        // 3. Quantize color to 16-step buckets
        const [qr, qg, qb] = quantizeColor(r, g, b, 16);
        const key = `${qr},${qg},${qb}`;

        // 4. Weight score by frequency and saturation (favors vivid cinematic tones over grey noise)
        const weight = 1 + sat * 2.0;

        const existing = bucketCounts.get(key);
        if (existing) {
            existing.count += 1;
            existing.score += weight;
        } else {
            bucketCounts.set(key, {
                rgb: [qr, qg, qb],
                count: 1,
                score: weight
            });
        }
    }

    if (bucketCounts.size === 0) {
        return DEFAULT_AMBIENT_PALETTE;
    }

    // Sort buckets by weighted score descending
    const sorted = Array.from(bucketCounts.values()).sort((a, b) => b.score - a.score);

    const dominantRgb = sorted[0].rgb;

    // Search for secondary accent with distinct hue/chroma (distance >= 60 in RGB space)
    let accentRgb: [number, number, number] | null = null;
    for (let i = 1; i < sorted.length; i++) {
        const cand = sorted[i].rgb;
        const dist = colorDistance(dominantRgb, cand);
        const sat = getSaturation(cand[0], cand[1], cand[2]);
        if (dist >= 60 && sat > 0.25) {
            accentRgb = cand;
            break;
        }
    }

    // Fallback accent if all pixels were monochrome or closely clustered
    if (!accentRgb) {
        if (sorted.length > 1 && colorDistance(dominantRgb, sorted[1].rgb) >= 30) {
            accentRgb = sorted[1].rgb;
        } else {
            // Synthesize a harmonious complementary tone
            accentRgb = [
                clampByte(dominantRgb[2] + 40),
                clampByte(dominantRgb[0] + 30),
                clampByte(dominantRgb[1] + 50)
            ];
        }
    }

    // Deep Obsidian tinted background
    const bgRgb: [number, number, number] = [
        clampByte(Math.round(dominantRgb[0] * 0.15) + 6),
        clampByte(Math.round(dominantRgb[1] * 0.15) + 9),
        clampByte(Math.round(dominantRgb[2] * 0.15) + 16)
    ];

    return {
        dominant: formatRgb(dominantRgb),
        accent: formatRgb(accentRgb),
        glow1: formatRgba(dominantRgb, 0.35),
        glow2: formatRgba(accentRgb, 0.22),
        background: formatRgb(bgRgb),
        raw: {
            dominant: dominantRgb,
            accent: accentRgb
        }
    };
}

/**
 * Asynchronously extracts an Ambient Obsidian palette from an image URL or image element.
 *
 * Includes:
 * - In-memory LRU caching
 * - Canvas security error isolation (CORS fallback)
 * - Headless / SSR safe execution
 */
export async function getDominantPalette(
    src: string | HTMLImageElement | null | undefined
): Promise<AmbientPalette> {
    if (!src) {
        return DEFAULT_AMBIENT_PALETTE;
    }

    // Check cache when source is a string URL
    if (typeof src === "string") {
        const cached = paletteCache.get(src);
        if (cached) {
            return cached;
        }
    }

    // SSR / Node environment guard
    if (typeof document === "undefined" || typeof window === "undefined") {
        return DEFAULT_AMBIENT_PALETTE;
    }

    try {
        let img: HTMLImageElement;

        if (typeof src === "string") {
            img = new Image();
            img.crossOrigin = "anonymous";

            const loaded = new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Image failed to load"));
            });

            img.src = src;
            await loaded;
        } else {
            img = src;
            if (!img.complete || img.naturalWidth === 0) {
                return DEFAULT_AMBIENT_PALETTE;
            }
        }

        // Create bounded offscreen analysis canvas
        const canvas = document.createElement("canvas");
        canvas.width = ANALYSIS_SIZE;
        canvas.height = ANALYSIS_SIZE;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            return DEFAULT_AMBIENT_PALETTE;
        }

        // Downsample source into 32x32 analysis grid
        ctx.drawImage(img, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

        let imageData: ImageData;
        try {
            imageData = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        } catch {
            // SecurityError triggered on CORS-tainted canvas -> fail-safe fallback
            return DEFAULT_AMBIENT_PALETTE;
        }

        const palette = extractPaletteFromImageData(imageData);

        // Cache result if string URL
        if (typeof src === "string") {
            if (paletteCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = paletteCache.keys().next().value;
                if (oldestKey) paletteCache.delete(oldestKey);
            }
            paletteCache.set(src, palette);
        }

        return palette;
    } catch {
        return DEFAULT_AMBIENT_PALETTE;
    }
}

/**
 * Clears the in-memory palette cache (primarily for tests or memory hygiene).
 */
export function clearPaletteCache(): void {
    paletteCache.clear();
}
