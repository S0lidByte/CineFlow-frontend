<script lang="ts">
    import type { Snippet } from "svelte";
    import {
        getDominantPalette,
        DEFAULT_AMBIENT_PALETTE,
        type AmbientPalette
    } from "./palette-extractor";
    import { cn } from "$lib/utils";

    type Intensity = "subtle" | "medium" | "vibrant" | "intense";
    type BlurLevel = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
    type Spread = "compact" | "normal" | "wide";

    interface Props {
        src?: string | null;
        palette?: Partial<AmbientPalette> | null;
        intensity?: Intensity;
        blur?: BlurLevel;
        spread?: Spread;
        bordered?: boolean;
        as?: string;
        class?: string;
        style?: string;
        children?: Snippet;
    }

    let {
        src = null,
        palette: customPalette = null,
        intensity = "medium",
        blur = "xl",
        spread = "normal",
        bordered = true,
        as: ElementTag = "div",
        class: className = "",
        style = "",
        children
    }: Props = $props();

    let activePalette = $state<AmbientPalette>(DEFAULT_AMBIENT_PALETTE);
    let currentExtractionId = 0;

    // Intensity multiplier for glows
    const intensityMap: Record<Intensity, { glow1Opacity: number; glow2Opacity: number }> = {
        subtle: { glow1Opacity: 0.15, glow2Opacity: 0.1 },
        medium: { glow1Opacity: 0.3, glow2Opacity: 0.2 },
        vibrant: { glow1Opacity: 0.45, glow2Opacity: 0.3 },
        intense: { glow1Opacity: 0.6, glow2Opacity: 0.4 }
    };

    // Blur classes for the ambient glow canvas
    const blurMap: Record<BlurLevel, string> = {
        sm: "blur-md",
        md: "blur-lg",
        lg: "blur-xl",
        xl: "blur-2xl",
        "2xl": "blur-3xl",
        "3xl": "blur-[72px]"
    };

    // Spread classes for the ambient bloom
    const spreadMap: Record<Spread, string> = {
        compact: "-inset-2 opacity-80",
        normal: "-inset-4 opacity-90",
        wide: "-inset-8 opacity-100"
    };

    $effect(() => {
        if (customPalette) {
            activePalette = {
                ...DEFAULT_AMBIENT_PALETTE,
                ...customPalette
            };
            return;
        }

        if (!src) {
            activePalette = DEFAULT_AMBIENT_PALETTE;
            return;
        }

        // Increment extraction generation token to prevent A->B->C race condition
        const extractionId = ++currentExtractionId;

        getDominantPalette(src).then((extracted) => {
            // Only adopt palette if this was the latest initiated request
            if (extractionId === currentExtractionId) {
                activePalette = extracted;
            }
        });
    });

    // Compute effective custom properties
    const glow1 = $derived(
        customPalette?.glow1 ??
            `rgba(${activePalette.raw.dominant[0]}, ${activePalette.raw.dominant[1]}, ${activePalette.raw.dominant[2]}, ${intensityMap[intensity].glow1Opacity})`
    );

    const glow2 = $derived(
        customPalette?.glow2 ??
            `rgba(${activePalette.raw.accent[0]}, ${activePalette.raw.accent[1]}, ${activePalette.raw.accent[2]}, ${intensityMap[intensity].glow2Opacity})`
    );

    const surfaceCssVars = $derived(
        [
            `--ambient-glow-1: ${glow1};`,
            `--ambient-glow-2: ${glow2};`,
            `--ambient-dominant: ${activePalette.dominant};`,
            `--ambient-accent: ${activePalette.accent};`,
            `--ambient-bg: ${activePalette.background};`,
            style
        ]
            .filter(Boolean)
            .join(" ")
    );
</script>

<svelte:element
    this={ElementTag}
    class={cn(
        "bg-card/70 text-card-foreground relative isolate overflow-hidden rounded-2xl backdrop-blur-xl transition-colors duration-500",
        bordered && "border border-white/10 shadow-2xl",
        className
    )}
    style={surfaceCssVars}>
    <!-- Hardware-accelerated dynamic ambient bloom backdrop -->
    <div
        class={cn(
            "pointer-events-none absolute -z-10 transform-gpu transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none",
            spreadMap[spread],
            blurMap[blur]
        )}
        style="background: radial-gradient(circle at 20% 20%, var(--ambient-glow-1) 0%, transparent 60%), radial-gradient(circle at 80% 80%, var(--ambient-glow-2) 0%, transparent 60%);"
        aria-hidden="true">
    </div>

    <!-- Obsidian surface noise & depth gradient -->
    <div
        class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20"
        aria-hidden="true">
    </div>

    {#if children}
        {@render children()}
    {/if}
</svelte:element>
