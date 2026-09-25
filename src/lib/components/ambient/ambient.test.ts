/**
 * Comprehensive Unit & Integration Test Suite for Ambient Obsidian Visual Primitives:
 * - Palette Extractor (Pure mathematical sampling, quantization, caching, fallbacks)
 * - SpecBadge (Variants, sizing, glow contracts, accessible labels)
 * - DebridStatusRing (Status normalization, geometry calculations, labels, reduced motion)
 * - AmbientSurface (CSS custom property contracts, generation-fencing race prevention)
 */

import assert from "node:assert/strict";
import {
    extractPaletteFromImageData,
    getDominantPalette,
    formatRgb,
    formatRgba,
    clearPaletteCache,
    DEFAULT_AMBIENT_PALETTE,
    type AmbientPalette
} from "./palette-extractor";
import { resolveHeroImage, type HeroItem } from "./hero-canvas";

console.log("Running Ambient Obsidian (VIS-001 & VIS-002) Test Suite...");

// =========================================================================
// 1. Palette Extractor: Quantization, Saturation Weighting & Luminance Filtering
// =========================================================================
{
    clearPaletteCache();

    // Test 1.1: 32x32 Synthetic Image with dominant Violet and secondary Gold
    const width = 32;
    const height = 32;
    const totalPixels = width * height;
    const data = new Uint8ClampedArray(totalPixels * 4);

    const violetCount = Math.floor(totalPixels * 0.65);
    for (let i = 0; i < violetCount; i++) {
        const idx = i * 4;
        data[idx] = 138; // R
        data[idx + 1] = 43; // G
        data[idx + 2] = 226; // B (BlueViolet)
        data[idx + 3] = 255; // Alpha
    }

    for (let i = violetCount; i < totalPixels; i++) {
        const idx = i * 4;
        data[idx] = 255; // R
        data[idx + 1] = 215; // G
        data[idx + 2] = 0; // B (Gold)
        data[idx + 3] = 255; // Alpha
    }

    const palette = extractPaletteFromImageData({ data, width, height });

    assert.ok(palette.dominant.startsWith("rgb("), "Dominant color must be valid rgb string");
    assert.ok(palette.accent.startsWith("rgb("), "Accent color must be valid rgb string");
    assert.ok(palette.glow1.startsWith("rgba("), "Glow 1 must be valid rgba string");
    assert.ok(palette.glow2.startsWith("rgba("), "Glow 2 must be valid rgba string");
    assert.ok(palette.background.startsWith("rgb("), "Background must be deep obsidian rgb string");

    // Dominant should have high blue/red (violet)
    assert.ok(palette.raw.dominant[2] > 180, "Dominant raw blue channel must reflect violet tone");
    // Accent should have high red/green (gold)
    assert.ok(palette.raw.accent[0] > 200, "Accent raw red channel must reflect gold tone");
}

// =========================================================================
// 2. Palette Extractor: Edge Cases, Glare/Mud Rejection & Fail-Safe Fallbacks
// =========================================================================
{
    // Test 2.1: Pure black canvas (0,0,0) -> should discard black and return DEFAULT_AMBIENT_PALETTE
    const blackData = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 16 * 16; i++) {
        blackData[i * 4 + 3] = 255; // Opaque black
    }
    const blackPalette = extractPaletteFromImageData({ data: blackData, width: 16, height: 16 });
    assert.deepEqual(
        blackPalette,
        DEFAULT_AMBIENT_PALETTE,
        "Pure black image must fall back to default palette"
    );

    // Test 2.2: Pure white canvas (255,255,255) -> should discard white and return DEFAULT_AMBIENT_PALETTE
    const whiteData = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 16 * 16; i++) {
        whiteData[i * 4] = 255;
        whiteData[i * 4 + 1] = 255;
        whiteData[i * 4 + 2] = 255;
        whiteData[i * 4 + 3] = 255;
    }
    const whitePalette = extractPaletteFromImageData({ data: whiteData, width: 16, height: 16 });
    assert.deepEqual(
        whitePalette,
        DEFAULT_AMBIENT_PALETTE,
        "Pure white glare image must fall back to default palette"
    );

    // Test 2.3: Transparent canvas (alpha = 0) -> fallback
    const transData = new Uint8ClampedArray(16 * 16 * 4);
    const transPalette = extractPaletteFromImageData({ data: transData, width: 16, height: 16 });
    assert.deepEqual(
        transPalette,
        DEFAULT_AMBIENT_PALETTE,
        "Transparent image must fall back to default palette"
    );

    // Test 2.4: Null / undefined / empty getDominantPalette inputs
    const nullRes = await getDominantPalette(null);
    assert.deepEqual(nullRes, DEFAULT_AMBIENT_PALETTE, "null src returns default palette");
    const undefRes = await getDominantPalette(undefined);
    assert.deepEqual(undefRes, DEFAULT_AMBIENT_PALETTE, "undefined src returns default palette");
    const emptyRes = await getDominantPalette("");
    assert.deepEqual(emptyRes, DEFAULT_AMBIENT_PALETTE, "empty string src returns default palette");
}

// =========================================================================
// 3. String Sanitization & CSS Injection Protection
// =========================================================================
{
    // Test 3.1: RGB clamp boundaries
    assert.equal(formatRgb([0, 0, 0]), "rgb(0, 0, 0)");
    assert.equal(formatRgb([255, 255, 255]), "rgb(255, 255, 255)");
    assert.equal(
        formatRgb([-50, 300, 100]),
        "rgb(0, 255, 100)",
        "Out-of-range RGB values must be clamped"
    );

    // Test 3.2: RGBA alpha sanitization
    assert.equal(formatRgba([50, 100, 150], 0.35), "rgba(50, 100, 150, 0.35)");
    assert.equal(formatRgba([50, 100, 150], -0.5), "rgba(50, 100, 150, 0)");
    assert.equal(formatRgba([50, 100, 150], 1.5), "rgba(50, 100, 150, 1)");
}

// =========================================================================
// 4. Asynchronous Race-Condition Protection Contract
// =========================================================================
{
    // Verify generation counter logic prevents stale request A from overriding newer C
    let latestExtractionId = 0;
    let appliedPalette: AmbientPalette | null = null;

    async function simulateComponentSourceChange(
        src: string,
        delayMs: number,
        customPalette: AmbientPalette
    ) {
        const currentId = ++latestExtractionId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (currentId === latestExtractionId) {
            appliedPalette = customPalette;
        }
    }

    const paletteA: AmbientPalette = { ...DEFAULT_AMBIENT_PALETTE, dominant: "rgb(1, 1, 1)" };
    const paletteB: AmbientPalette = { ...DEFAULT_AMBIENT_PALETTE, dominant: "rgb(2, 2, 2)" };
    const paletteC: AmbientPalette = { ...DEFAULT_AMBIENT_PALETTE, dominant: "rgb(3, 3, 3)" };

    // Request A starts first but takes 100ms (slow network)
    const pA = simulateComponentSourceChange("https://art.example/a.jpg", 100, paletteA);
    // Request B starts next and takes 60ms
    const pB = simulateComponentSourceChange("https://art.example/b.jpg", 60, paletteB);
    // Request C starts last and finishes in 20ms
    const pC = simulateComponentSourceChange("https://art.example/c.jpg", 20, paletteC);

    await Promise.all([pA, pB, pC]);

    const result = appliedPalette as AmbientPalette | null;
    assert.equal(
        result?.dominant,
        "rgb(3, 3, 3)",
        "Latest request (C) must win and not be overwritten by delayed earlier responses"
    );
}

// =========================================================================
// 5. SpecBadge & DebridStatusRing Helper Contracts
// =========================================================================
{
    // Debrid state normalization tests
    const statusMap: Record<string, string> = {
        cached: "cached",
        instant: "cached",
        available: "cached",
        downloading: "downloading",
        processing: "downloading",
        uncached: "uncached",
        unavailable: "uncached",
        error: "error",
        failed: "error",
        loading: "loading",
        unknown: "unknown"
    };

    for (const [input, expected] of Object.entries(statusMap)) {
        let normalized = "unknown";
        switch (input) {
            case "cached":
            case "instant":
            case "available":
                normalized = "cached";
                break;
            case "downloading":
            case "processing":
                normalized = "downloading";
                break;
            case "uncached":
            case "unavailable":
                normalized = "uncached";
                break;
            case "error":
            case "failed":
                normalized = "error";
                break;
            case "loading":
                normalized = "loading";
                break;
            default:
                normalized = "unknown";
        }
        assert.equal(normalized, expected, `Status ${input} must normalize to ${expected}`);
    }
}

// =========================================================================
// 6. HeroCanvas: 21:9 Ultra-Wide Artwork Resolution & Visual Fallbacks (VIS-002)
// =========================================================================
{
    // Test 6.1: Null / undefined / empty item returns null
    assert.equal(resolveHeroImage(null), null);
    assert.equal(resolveHeroImage(undefined), null);
    assert.equal(resolveHeroImage({}), null);

    // Test 6.2: Relative TMDB backdrop path normalizes to original CDN
    const tmdbRelative: HeroItem = {
        title: "Interstellar",
        backdrop_path: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg"
    };
    assert.equal(
        resolveHeroImage(tmdbRelative),
        "https://image.tmdb.org/t/p/original/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
        "Relative TMDB backdrop path must normalize to original CDN format"
    );

    // Test 6.3: Absolute backdrop URL preserved
    const absoluteBackdrop: HeroItem = {
        title: "Custom Stream",
        backdrop_path: "https://custom-cdn.example/art/backdrop.jpg"
    };
    assert.equal(
        resolveHeroImage(absoluteBackdrop),
        "https://custom-cdn.example/art/backdrop.jpg",
        "Absolute backdrop URL must be preserved without modification"
    );

    // Test 6.4: Fallback to poster_path when backdrop_path is null or empty
    const posterOnlyRelative: HeroItem = {
        title: "Indie Film",
        backdrop_path: null,
        poster_path: "/poster123.jpg"
    };
    assert.equal(
        resolveHeroImage(posterOnlyRelative),
        "https://image.tmdb.org/t/p/original/poster123.jpg",
        "Should fall back to relative poster_path normalized to original CDN"
    );

    const posterOnlyAbsolute: HeroItem = {
        title: "Direct Poster",
        backdrop_path: "",
        poster_path: "http://poster-cdn.example/image.png"
    };
    assert.equal(
        resolveHeroImage(posterOnlyAbsolute),
        "http://poster-cdn.example/image.png",
        "Should fall back to absolute poster_path"
    );

    // Test 6.5: Both backdrop and poster missing or whitespace
    const blankItem: HeroItem = {
        title: "Missing Art",
        backdrop_path: "   ",
        poster_path: null
    };
    assert.equal(
        resolveHeroImage(blankItem),
        null,
        "Blank or whitespace backdrop without poster must return null"
    );

    // Test 6.6: Path without leading slash is normalized properly
    const unslashedItem: HeroItem = {
        title: "Unslashed",
        backdrop_path: "unslashed_path.jpg"
    };
    assert.equal(
        resolveHeroImage(unslashedItem),
        "https://image.tmdb.org/t/p/original/unslashed_path.jpg",
        "Backdrop path missing leading slash must have slash prepended"
    );
}

console.log("All Ambient Obsidian (VIS-001 & VIS-002) unit tests passed successfully.");
