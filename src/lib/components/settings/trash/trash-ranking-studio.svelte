<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import TrashProfileSelector from "./trash-profile-selector.svelte";
    import TrashCatalogBrowser from "./trash-catalog-browser.svelte";
    import TrashReleaseEvaluator from "./trash-release-evaluator.svelte";
    import TrashFunnelView from "./trash-funnel-view.svelte";
    import type { TrashCustomFormat, TrashProfile } from "$lib/services/trash-ranking";
    import { getTrashCustomFormats } from "$lib/services/trash-ranking";
    import { onMount } from "svelte";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import Sliders from "@lucide/svelte/icons/sliders";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import Play from "@lucide/svelte/icons/play";
    import Filter from "@lucide/svelte/icons/filter";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";

    interface Props {
        initialProfileId?: string;
    }

    let { initialProfileId = "trash_balanced" }: Props = $props();

    let customFormats = $state<TrashCustomFormat[]>([]);
    let profiles = $state<TrashProfile[]>([]);
    let selectedProfileId = $state("trash_balanced");
    let activeSubTab = $state("profiles");
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);

    $effect(() => {
        if (initialProfileId) {
            selectedProfileId = initialProfileId;
        }
    });

    const activeProfile = $derived.by(() => {
        return profiles.find((p) => p.profile_id === selectedProfileId) || null;
    });

    async function loadData() {
        isLoading = true;
        loadError = null;
        try {
            const data = await getTrashCustomFormats();
            customFormats = data.custom_formats || [];
            profiles = data.profiles || [];
            if (profiles.length > 0 && !profiles.some((p) => p.profile_id === selectedProfileId)) {
                selectedProfileId = profiles[0].profile_id;
            }
        } catch (err: unknown) {
            loadError =
                err instanceof Error
                    ? err.message
                    : "Failed to load TRaSH Guides custom formats catalog";
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadData();
    });
</script>

<div class="space-y-4">
    <!-- Studio Header -->
    <div
        class="flex flex-col justify-between gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
        <div>
            <div class="flex items-center gap-2">
                <h3 class="text-foreground flex items-center gap-2 text-base font-semibold">
                    <Sparkles class="text-primary size-4" />
                    TRaSH Guides Scoring Engine
                </h3>
                <Badge
                    variant="outline"
                    class="border-primary/30 text-primary font-mono text-[10px] uppercase">
                    CineFlow TRaSH-Aligned
                </Badge>
            </div>
            <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                Deterministic regex-based scoring catalog for HDR formats, lossless audio, tier
                groups, and quality heuristics.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                class="h-8 gap-1.5 border-white/10 px-2.5 text-xs"
                disabled={isLoading}
                onclick={loadData}>
                {#if isLoading}
                    <Loader2 class="size-3.5 animate-spin" />
                {:else}
                    <RefreshCw class="size-3.5" />
                {/if}
                Refresh Catalog
            </Button>
        </div>
    </div>

    {#if loadError}
        <div
            class="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
            <p class="font-semibold">Unable to load TRaSH Guides catalog from backend:</p>
            <p class="font-mono">{loadError}</p>
            <Button
                variant="outline"
                size="sm"
                class="h-7 border-rose-500/30 text-xs"
                onclick={loadData}>
                Retry Loading
            </Button>
        </div>
    {:else if isLoading && customFormats.length === 0}
        <div
            class="text-muted-foreground flex flex-col items-center justify-center gap-2 p-12 text-xs">
            <Loader2 class="text-primary size-6 animate-spin" />
            <span>Loading TRaSH Guides catalog and scoring profiles...</span>
        </div>
    {:else}
        <Tabs.Root bind:value={activeSubTab} class="w-full">
            <Tabs.List class="grid w-full max-w-xl grid-cols-2 sm:grid-cols-4">
                <Tabs.Trigger value="profiles" class="gap-1.5 text-xs">
                    <Sliders class="size-3.5" />
                    Profiles ({profiles.length})
                </Tabs.Trigger>
                <Tabs.Trigger value="catalog" class="gap-1.5 text-xs">
                    <BookOpen class="size-3.5" />
                    Catalog ({customFormats.length})
                </Tabs.Trigger>
                <Tabs.Trigger value="evaluator" class="gap-1.5 text-xs">
                    <Play class="size-3.5" />
                    Evaluator
                </Tabs.Trigger>
                <Tabs.Trigger value="funnel" class="gap-1.5 text-xs">
                    <Filter class="size-3.5" />
                    Funnel
                </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="profiles" class="mt-4">
                <TrashProfileSelector
                    {profiles}
                    bind:selectedProfileId
                    onSelectProfile={(id: string) => (selectedProfileId = id)} />
            </Tabs.Content>

            <Tabs.Content value="catalog" class="mt-4">
                <TrashCatalogBrowser formats={customFormats} {activeProfile} />
            </Tabs.Content>

            <Tabs.Content value="evaluator" class="mt-4">
                <TrashReleaseEvaluator {profiles} {selectedProfileId} />
            </Tabs.Content>

            <Tabs.Content value="funnel" class="mt-4">
                <TrashFunnelView />
            </Tabs.Content>
        </Tabs.Root>
    {/if}
</div>
