<script lang="ts">
    import type { Snippet } from "svelte";
    import AmbientSurface from "./AmbientSurface.svelte";
    import { resolveHeroImage, type HeroItem } from "./hero-canvas";
    import { cn } from "$lib/utils";

    interface Props {
        item?: HeroItem | null;
        showTitle?: boolean;
        class?: string;
        children?: Snippet;
    }

    let { item = null, showTitle = true, class: className = "", children }: Props = $props();

    const displaySrc = $derived(resolveHeroImage(item));
</script>

<AmbientSurface
    src={displaySrc}
    intensity="vibrant"
    blur="2xl"
    class={cn(
        "relative aspect-[21/9] max-h-[640px] min-h-[260px] w-full overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl transition-all duration-500",
        className
    )}>
    {#if displaySrc}
        <img
            src={displaySrc}
            alt={item?.title ? `${item.title} backdrop` : "Media backdrop"}
            class="absolute inset-0 h-full w-full object-cover object-center"
            loading="eager" />
    {/if}
    <!-- Top & Bottom obsidian depth gradients -->
    <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"
        aria-hidden="true">
    </div>
    <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/60 via-transparent to-transparent"
        aria-hidden="true">
    </div>
    <!-- Subtle obsidian border rim to prevent edge glare -->
    <div
        class="border-border/10 pointer-events-none absolute inset-0 rounded-3xl border"
        aria-hidden="true">
    </div>
    {#if showTitle && item?.title}
        <div class="pointer-events-none absolute bottom-0 left-0 z-10 p-6 md:p-10">
            <h1
                class="text-2xl font-black tracking-tight text-white drop-shadow-md sm:text-3xl md:text-4xl lg:text-5xl">
                {item.title}
            </h1>
        </div>
    {/if}
    {#if children}
        {@render children()}
    {/if}
</AmbientSurface>
