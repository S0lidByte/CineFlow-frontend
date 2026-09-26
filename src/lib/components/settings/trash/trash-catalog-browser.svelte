<script lang="ts">
    import { Input } from "$lib/components/ui/input/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import type { TrashCustomFormat, TrashProfile } from "$lib/services/trash-ranking";
    import { getCategoryLabel, getCategoryBadgeClass } from "$lib/services/trash-ranking";
    import TrashFormatDetailModal from "./trash-format-detail-modal.svelte";
    import Search from "@lucide/svelte/icons/search";
    import Info from "@lucide/svelte/icons/info";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import Layers from "@lucide/svelte/icons/layers";

    interface Props {
        formats: TrashCustomFormat[];
        activeProfile?: TrashProfile | null;
    }

    let { formats = [], activeProfile = null }: Props = $props();

    let searchQuery = $state("");
    let selectedCategory = $state<string>("all");
    let selectedFormat = $state<TrashCustomFormat | null>(null);
    let modalOpen = $state(false);

    const categories = $derived.by(() => {
        const unique = [...new Set(formats.map((f) => f.category).filter(Boolean))];
        return unique.sort();
    });

    const filteredFormats = $derived.by(() => {
        let list = formats;
        if (selectedCategory !== "all") {
            list = list.filter((f) => f.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (f) =>
                    f.name.toLowerCase().includes(q) ||
                    f.trash_id.toLowerCase().includes(q) ||
                    f.description?.toLowerCase().includes(q)
            );
        }
        return list;
    });

    function getEffectiveScore(format: TrashCustomFormat): { score: number; isCustom: boolean } {
        if (activeProfile?.format_scores && format.trash_id in activeProfile.format_scores) {
            const profileScore = activeProfile.format_scores[format.trash_id];
            return {
                score: profileScore,
                isCustom: profileScore !== format.default_score
            };
        }
        return {
            score: format.score ?? format.default_score,
            isCustom: false
        };
    }

    function openDetails(format: TrashCustomFormat) {
        selectedFormat = format;
        modalOpen = true;
    }
</script>

<div class="space-y-4">
    <!-- Search and Category Filters -->
    <div class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div class="relative max-w-md flex-1">
            <Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
                type="text"
                placeholder="Search formats, regex patterns, or IDs..."
                bind:value={searchQuery}
                class="bg-card/40 border-border/50 h-9 pl-9 text-xs" />
        </div>
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                class="h-7 rounded-full px-2.5 text-xs"
                onclick={() => (selectedCategory = "all")}>
                All ({formats.length})
            </Button>
            {#each categories as cat (cat)}
                {@const count = formats.filter((f) => f.category === cat).length}
                <Button
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    class="h-7 rounded-full px-2.5 text-xs whitespace-nowrap"
                    onclick={() => (selectedCategory = cat)}>
                    {getCategoryLabel(cat)} ({count})
                </Button>
            {/each}
        </div>
    </div>

    <!-- Active Profile Notice -->
    {#if activeProfile}
        <div
            class="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
            <div class="flex items-center gap-2">
                <Layers class="text-primary size-4" />
                <span>
                    Active Profile Weights: <strong class="text-primary"
                        >{activeProfile.name}</strong>
                </span>
            </div>
            <span class="text-muted-foreground">
                Cutoff Score: <strong class="text-foreground">{activeProfile.cutoff_score}</strong>
            </span>
        </div>
    {/if}

    <!-- Format Grid/Cards -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {#each filteredFormats as format (format.trash_id)}
            {@const { score, isCustom } = getEffectiveScore(format)}
            <div
                class="group bg-card/40 relative flex flex-col justify-between rounded-xl border border-white/5 p-3.5 backdrop-blur-sm transition-all hover:border-white/15">
                <div class="space-y-2">
                    <div class="flex items-start justify-between gap-2">
                        <Badge
                            variant="outline"
                            class="text-[10px] {getCategoryBadgeClass(format.category)}">
                            {getCategoryLabel(format.category)}
                        </Badge>
                        <div class="flex items-center gap-1.5 font-mono text-xs">
                            {#if score < 0}
                                <span class="flex items-center gap-1 font-semibold text-rose-400">
                                    <ShieldAlert class="size-3" />
                                    {score}
                                </span>
                            {:else}
                                <span
                                    class="flex items-center gap-1 font-semibold text-emerald-400">
                                    <ShieldCheck class="size-3" />
                                    +{score}
                                </span>
                            {/if}
                            {#if isCustom}
                                <Badge variant="secondary" class="px-1 py-0 text-[9px] uppercase">
                                    Override
                                </Badge>
                            {/if}
                        </div>
                    </div>

                    <div>
                        <h4
                            class="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                            {format.name}
                        </h4>
                        <p class="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                            {format.description || "TRaSH custom format specification"}
                        </p>
                    </div>
                </div>

                <div
                    class="mt-3.5 flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                    <span
                        class="text-muted-foreground max-w-[140px] truncate font-mono text-[11px]">
                        {format.trash_id}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        class="hover:text-primary h-6 gap-1 px-2 text-xs"
                        onclick={() => openDetails(format)}>
                        <Info class="size-3" />
                        Rules ({format.conditions?.length || 0})
                    </Button>
                </div>
            </div>
        {/each}

        {#if filteredFormats.length === 0}
            <div class="text-muted-foreground col-span-full py-12 text-center text-sm">
                No custom formats match your filter criteria.
            </div>
        {/if}
    </div>
</div>

<TrashFormatDetailModal
    bind:open={modalOpen}
    format={selectedFormat}
    onOpenChange={(open) => (modalOpen = open)} />
