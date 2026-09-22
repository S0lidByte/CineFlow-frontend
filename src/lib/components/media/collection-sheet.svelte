<script lang="ts">
    import * as Sheet from "$lib/components/ui/sheet/index.js";
    import * as Drawer from "$lib/components/ui/drawer/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import LandscapeCard from "$lib/components/media/landscape-card.svelte";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
    import DownloadCloud from "@lucide/svelte/icons/download-cloud";
    import Film from "@lucide/svelte/icons/film";
    import { toast } from "svelte-sonner";
    import providers from "$lib/providers";
    import { createScopedLogger } from "$lib/logger";
    import { IsMobile } from "$lib/hooks/is-mobile.svelte";
    import type { CollectionDetails, CollectionMovie } from "$lib/providers/parser";
    import {
        getCollectionYearSpan,
        formatCollectionSummary,
        getUncollectedMovieIds,
        calculateCollectionStats,
        formatRequestButtonLabel,
        parseCollectionRequestOutcome
    } from "./collection-details";
    import { parseAddItemsResponse } from "./riven/item-request-parser";
    import { type Snippet } from "svelte";
    import { resolve } from "$app/paths";
    import { SvelteSet } from "svelte/reactivity";

    const logger = createScopedLogger("collection-sheet");

    interface Props {
        collectionId: number;
        collectionName?: string;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        trigger?: Snippet<[{ props: Record<string, unknown> }]>;
    }

    let {
        collectionId,
        collectionName = "Collection",
        open = $bindable(false),
        onOpenChange,
        trigger
    }: Props = $props();

    const isMobile = new IsMobile();

    let loading = $state(false);
    let requestLoading = $state(false);
    let collectionData = $state<CollectionDetails | null>(null);
    let error = $state<string | null>(null);
    let collectedTmdbIds = new SvelteSet<number>();

    const stats = $derived(calculateCollectionStats(collectionData?.parts, collectedTmdbIds));
    const yearSpan = $derived(getCollectionYearSpan(collectionData?.parts));
    const summaryText = $derived(formatCollectionSummary(stats.totalCount, yearSpan.formatted));
    const buttonLabel = $derived(
        formatRequestButtonLabel(stats.uncollectedCount, stats.totalCount, requestLoading)
    );

    function handleOpenChange(newVal: boolean) {
        open = newVal;
        onOpenChange?.(newVal);
    }

    async function checkLibraryStatus(parts: CollectionMovie[]) {
        if (!parts || parts.length === 0) return;
        try {
            const res = await providers.riven.GET("/api/v1/items", {
                params: {
                    query: {
                        type: ["movie"],
                        limit: 250
                    }
                }
            });

            if (res.data?.items && Array.isArray(res.data.items)) {
                const partTmdbIds = new Set(parts.map((p) => String(p.id)));
                for (const item of res.data.items) {
                    if (item.tmdb_id && partTmdbIds.has(String(item.tmdb_id))) {
                        const numId = Number(item.tmdb_id);
                        if (Number.isFinite(numId)) {
                            collectedTmdbIds.add(numId);
                        }
                    }
                }
            }
        } catch (err) {
            logger.debug("Library collection check skipped or failed", err);
        }
    }

    async function fetchCollection() {
        if (collectionData) return;
        loading = true;
        error = null;
        try {
            const res = await fetch(`/api/collection/${collectionId}`);
            if (!res.ok) throw new Error("Failed to fetch collection");
            const data = await res.json();
            collectionData = data.collection;
            if (collectionData?.parts?.length) {
                void checkLibraryStatus(collectionData.parts);
            }
        } catch (e) {
            logger.error("Failed to fetch collection", e);
            error = "Failed to load collection details.";
        } finally {
            loading = false;
        }
    }

    async function requestAll() {
        if (!collectionData?.parts?.length) return;

        const uncollected = getUncollectedMovieIds(collectionData.parts, collectedTmdbIds);
        if (uncollected.length === 0) {
            toast.info("All movies in this collection are already in your library.");
            return;
        }

        requestLoading = true;
        const ids = uncollected.map((id) => id.toString());

        try {
            const response = await providers.riven.POST("/api/v1/items/add", {
                body: {
                    media_type: "movie",
                    tmdb_ids: ids,
                    tvdb_ids: []
                }
            });

            if (response.data) {
                const parsed = parseAddItemsResponse(response.data.message);
                const outcome = parseCollectionRequestOutcome(parsed, uncollected.length);

                if (outcome.success) {
                    for (const id of uncollected) {
                        collectedTmdbIds.add(id);
                    }
                    toast.success(outcome.toastMessage);
                } else {
                    toast.error(outcome.toastMessage);
                }
            } else {
                logger.error("Error response:", response.error);
                toast.error("Failed to request collection.");
            }
        } catch (e) {
            logger.error("Request failed", e);
            toast.error("Failed to request collection.");
        } finally {
            requestLoading = false;
        }
    }

    $effect(() => {
        if (open) {
            void fetchCollection();
        }
    });
</script>

{#snippet headerContent()}
    <div class="flex flex-col gap-1.5">
        <h2 class="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            {collectionName}
        </h2>
        <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-muted-foreground font-medium">{summaryText}</span>
            {#if stats.totalCount > 0}
                {#if stats.percentage === 100}
                    <Badge
                        variant="secondary"
                        class="border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                        <CheckCircle2 class="mr-1 size-3 text-emerald-400" />
                        100% In Library
                    </Badge>
                {:else if stats.collectedCount > 0}
                    <Badge
                        variant="outline"
                        class="border-primary/30 bg-primary/10 text-primary font-mono text-xs">
                        {stats.collectedCount}/{stats.totalCount} In Library ({stats.percentage}%)
                    </Badge>
                {/if}
            {/if}
        </div>
    </div>
{/snippet}

{#snippet bodyContent()}
    <div class="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-24">
        {#if loading}
            <div class="flex h-48 flex-col items-center justify-center gap-3">
                <Loader2 class="text-primary size-8 animate-spin" />
                <span class="text-muted-foreground text-xs font-medium">Loading collection...</span>
            </div>
        {:else if error}
            <div
                class="text-destructive flex h-48 flex-col items-center justify-center gap-2 text-center">
                <Film class="size-8 opacity-60" />
                <p class="text-sm font-medium">{error}</p>
                <Button variant="outline" size="sm" class="mt-2" onclick={() => fetchCollection()}>
                    Retry
                </Button>
            </div>
        {:else if collectionData}
            {#if collectionData.backdrop_path}
                <div class="relative h-44 w-full overflow-hidden rounded-2xl shadow-xl md:h-56">
                    <img
                        src={collectionData.backdrop_path}
                        alt={collectionData.name}
                        class="h-full w-full object-cover" />
                    <div
                        class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent">
                    </div>
                    <div class="absolute right-6 bottom-6 left-6">
                        <p
                            class="line-clamp-3 text-sm leading-relaxed font-medium text-white/90 drop-shadow-md">
                            {collectionData.overview || "No collection overview available."}
                        </p>
                    </div>
                    <div
                        class="pointer-events-none absolute inset-0 rounded-2xl border border-white/10">
                    </div>
                </div>
            {/if}

            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <div
                        class="bg-primary h-5 w-1 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]">
                    </div>
                    <h3 class="text-foreground text-base font-bold tracking-tight drop-shadow-md">
                        Franchise Movies
                    </h3>
                </div>
                {#if stats.totalCount > 0}
                    <span class="text-muted-foreground font-mono text-xs">
                        {stats.totalCount}
                        {stats.totalCount === 1 ? "Entry" : "Entries"}
                    </span>
                {/if}
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {#each collectionData.parts ?? [] as part (part.id)}
                    {@const isCollected = collectedTmdbIds.has(part.id)}
                    <a
                        href={resolve(`/details/media/${part.id}/movie`)}
                        class="group block transition-all duration-300 hover:scale-[1.02]"
                        onclick={() => isMobile.current && (open = false)}>
                        <LandscapeCard
                            title={part.title}
                            image={part.backdrop_path}
                            overview={part.overview}
                            tmdbId={part.id}
                            mediaType="movie"
                            initialRating={part.vote_average ?? undefined}
                            class="transition-shadow group-hover:shadow-lg">
                            {#snippet topRight()}
                                {#if isCollected}
                                    <Badge
                                        variant="secondary"
                                        class="border border-emerald-500/20 bg-emerald-500/20 font-mono text-xs text-emerald-400 backdrop-blur-md">
                                        In Library
                                    </Badge>
                                {/if}
                            {/snippet}
                            {#snippet meta()}
                                {#if part.year}
                                    <span
                                        class="text-muted-foreground rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs backdrop-blur-sm">
                                        {part.year}
                                    </span>
                                {/if}
                            {/snippet}
                        </LandscapeCard>
                    </a>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet footerContent()}
    {#if collectionData?.parts?.length}
        <div class="border-t border-white/5 bg-black/40 p-4 backdrop-blur-md md:p-6">
            <Button
                onclick={requestAll}
                disabled={requestLoading || stats.uncollectedCount === 0}
                variant="secondary"
                class="border-primary/50 bg-primary/20 text-primary hover:bg-primary/30 w-full border shadow-lg backdrop-blur-md transition-all hover:scale-[1.01] disabled:opacity-60">
                {#if requestLoading}
                    <Loader2 class="mr-2 size-4 animate-spin" />
                {:else if stats.uncollectedCount === 0}
                    <CheckCircle2 class="mr-2 size-4 text-emerald-400" />
                {:else}
                    <DownloadCloud class="mr-2 size-4" />
                {/if}
                {buttonLabel}
            </Button>
        </div>
    {/if}
{/snippet}

{#if isMobile.current}
    <Drawer.Root bind:open onOpenChange={handleOpenChange} direction="bottom">
        {#if trigger}
            <Drawer.Trigger>
                {#snippet child({ props })}
                    {@render trigger({ props })}
                {/snippet}
            </Drawer.Trigger>
        {/if}
        <Drawer.Content class="flex max-h-[85vh] flex-col overflow-hidden outline-none">
            <div
                class="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-hidden px-4 pb-4 md:px-6">
                <Drawer.Header class="shrink-0 px-0 pt-2 pb-0 text-left">
                    <Drawer.Title class="sr-only">
                        {collectionName}
                    </Drawer.Title>
                    <Drawer.Description class="sr-only">
                        Browse and request movies in the {collectionName} franchise.
                    </Drawer.Description>
                    {@render headerContent()}
                </Drawer.Header>
                {@render bodyContent()}
                {@render footerContent()}
            </div>
        </Drawer.Content>
    </Drawer.Root>
{:else}
    <Sheet.Root bind:open onOpenChange={handleOpenChange}>
        {#if trigger}
            <Sheet.Trigger>
                {#snippet child({ props })}
                    {@render trigger({ props })}
                {/snippet}
            </Sheet.Trigger>
        {/if}
        <Sheet.Content
            side="right"
            class="flex w-full flex-col overflow-hidden border-l border-white/10 bg-zinc-950/95 backdrop-blur-2xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
            <Sheet.Header class="px-6 pt-6 text-left">
                <Sheet.Title class="sr-only">
                    {collectionName}
                </Sheet.Title>
                <Sheet.Description class="sr-only">
                    Browse and request movies in the {collectionName} franchise.
                </Sheet.Description>
                {@render headerContent()}
            </Sheet.Header>
            {@render bodyContent()}
            {@render footerContent()}
        </Sheet.Content>
    </Sheet.Root>
{/if}
