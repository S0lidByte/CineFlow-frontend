import { describe, it, expect, beforeEach } from "vitest";
import {
    extractPaletteFromImageData,
    getDominantPalette,
    formatRgb,
    formatRgba,
    clearPaletteCache,
    DEFAULT_AMBIENT_PALETTE
} from "./palette-extractor";

describe("palette-extractor", () => {
    beforeEach(() => {
        clearPaletteCache();
    });

    it("extracts dominant and accent colors from known synthetic pixel data", () => {
        // Create 32x32 image with 70% deep blue and 30% vivid orange
        const width = 32;
        const height = 32;
        const totalPixels = width * height;
        const data = new Uint8ClampedArray(totalPixels * 4);

        const bluePixels = Math.floor(totalPixels * 0.7);
        for (let i = 0; i < bluePixels; i++) {
            const idx = i * 4;
            data[idx] = 20; // R
            data[idx + 1] = 80; // G
            data[idx + 2] = 220; // B
            data[idx + 3] = 255; // A
        }

        for (let i = bluePixels; i < totalPixels; i++) {
            const idx = i * 4;
            data[idx] = 240; // R
            data[idx + 1] = 120; // G
            data[idx + 2] = 10; // B
            data[idx + 3] = 255; // A
        }

        const palette = extractPaletteFromImageData({ data, width, height });

        expect(palette).toBeDefined();
        // Dominant should be the blue tone
        expect(palette.dominant).toContain("rgb(");
        expect(palette.raw.dominant[2]).toBeGreaterThan(palette.raw.dominant[0]);
        // Accent should be the orange tone
        expect(palette.accent).toContain("rgb(");
        expect(palette.raw.accent[0]).toBeGreaterThan(palette.raw.accent[2]);
        // Glow strings should be properly formatted
        expect(palette.glow1).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.35\)$/);
        expect(palette.glow2).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.22\)$/);
    });

    it("falls back to DEFAULT_AMBIENT_PALETTE for transparent or empty images", () => {
        const width = 16;
        const height = 16;
        const data = new Uint8ClampedArray(width * height * 4); // All zeros (transparent)

        const palette = extractPaletteFromImageData({ data, width, height });
        expect(palette).toEqual(DEFAULT_AMBIENT_PALETTE);
    });

    it("filters out extreme near-blacks and near-whites to avoid glare or mud", () => {
        const width = 10;
        const height = 10;
        const total = width * height;
        const data = new Uint8ClampedArray(total * 4);

        // 90% pure black (0,0,0) and pure white (255,255,255)
        for (let i = 0; i < total * 0.5; i++) {
            data[i * 4] = 2;
            data[i * 4 + 1] = 2;
            data[i * 4 + 2] = 2;
            data[i * 4 + 3] = 255;
        }
        for (let i = Math.floor(total * 0.5); i < total * 0.9; i++) {
            data[i * 4] = 253;
            data[i * 4 + 1] = 253;
            data[i * 4 + 2] = 253;
            data[i * 4 + 3] = 255;
        }
        // 10% vivid emerald green (16, 185, 129)
        for (let i = Math.floor(total * 0.9); i < total; i++) {
            data[i * 4] = 16;
            data[i * 4 + 1] = 185;
            data[i * 4 + 2] = 129;
            data[i * 4 + 3] = 255;
        }

        const palette = extractPaletteFromImageData({ data, width, height });
        // The emerald green should be chosen because black and white are filtered
        expect(palette.raw.dominant[1]).toBeGreaterThan(150);
        expect(palette.raw.dominant[0]).toBeLessThan(50);
    });

    it("handles getDominantPalette null/undefined/empty input safely", async () => {
        expect(await getDominantPalette(null)).toEqual(DEFAULT_AMBIENT_PALETTE);
        expect(await getDominantPalette(undefined)).toEqual(DEFAULT_AMBIENT_PALETTE);
        expect(await getDominantPalette("")).toEqual(DEFAULT_AMBIENT_PALETTE);
    });

    it("formats sanitized RGB and RGBA strings strictly without CSS injection", () => {
        expect(formatRgb([12, 34, 56])).toBe("rgb(12, 34, 56)");
        expect(formatRgba([12, 34, 56], 0.45)).toBe("rgba(12, 34, 56, 0.45)");
        // Clamping out-of-range values
        expect(formatRgb([-10, 300, 128])).toBe("rgb(0, 255, 128)");
        expect(formatRgba([500, -50, 200], 1.5)).toBe("rgba(255, 0, 200, 1)");
    });

    it("generates harmonious complementary accent if palette is completely monochrome", () => {
        const width = 16;
        const height = 16;
        const total = width * height;
        const data = new Uint8ClampedArray(total * 4);

        // Fill with uniform slate grey (100, 100, 100)
        for (let i = 0; i < total; i++) {
            data[i * 4] = 100;
            data[i * 4 + 1] = 100;
            data[i * 4 + 2] = 100;
            data[i * 4 + 3] = 255;
        }

        const palette = extractPaletteFromImageData({ data, width, height });
        expect(palette.dominant).toBe("rgb(96, 96, 96)"); // Quantized
        expect(palette.accent).toBeDefined();
        expect(palette.glow1).toBeDefined();
        expect(palette.glow2).toBeDefined();
    });
});
