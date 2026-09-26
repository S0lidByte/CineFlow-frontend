<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import type { TrashProfile } from "$lib/services/trash-ranking";
    import Check from "@lucide/svelte/icons/check";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import Sliders from "@lucide/svelte/icons/sliders";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import ShieldX from "@lucide/svelte/icons/shield-x";
    import GitFork from "@lucide/svelte/icons/git-fork";
    import TrendingUp from "@lucide/svelte/icons/trending-up";
    import TrendingDown from "@lucide/svelte/icons/trending-down";

    interface Props {
        profiles: TrashProfile[];
        selectedProfileId: string;
        onSelectProfile: (profileId: string) => void;
    }

    let { profiles = [], selectedProfileId = $bindable(""), onSelectProfile }: Props = $props();

    function select(profileId: string) {
        selectedProfileId = profileId;
        onSelectProfile?.(profileId);
    }

    function getTopScores(formatScores: Record<string, number> = {}) {
        const entries = Object.entries(formatScores);
        const boosted = entries
            .filter(([, s]) => s > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);
        const penalized = entries
            .filter(([, s]) => s < 0)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 2);
        return { boosted, penalized };
    }
</script>

<div class="space-y-4">
    <!-- Routing Hierarchy Visualization -->
    <div class="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3.5 backdrop-blur-sm">
        <div class="flex items-center gap-2">
            <GitFork class="text-primary size-4" />
            <h4 class="text-foreground text-xs font-semibold">Default Profile Routing Hierarchy</h4>
        </div>
        <div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
            <div
                class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span
                    class="bg-primary/20 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold">
                    1
                </span>
                <div class="min-w-0">
                    <strong class="text-foreground block truncate text-[11px]"
                        >Request Override</strong>
                    <span class="text-muted-foreground block truncate text-[10px]"
                        >Title / Scrape option</span>
                </div>
            </div>

            <div
                class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span
                    class="bg-primary/20 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold">
                    2
                </span>
                <div class="min-w-0">
                    <strong class="text-foreground block truncate text-[11px]">Anime Media</strong>
                    <span class="text-muted-foreground block truncate text-[10px]"
                        >Routes to trash_anime</span>
                </div>
            </div>

            <div
                class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span
                    class="bg-primary/20 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold">
                    3
                </span>
                <div class="min-w-0">
                    <strong class="text-foreground block truncate text-[11px]"
                        >Default Profile</strong>
                    <span class="text-muted-foreground block truncate text-[10px]"
                        >trash_balanced (Standard)</span>
                </div>
            </div>

            <div
                class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <span
                    class="bg-primary/20 text-primary flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold">
                    4
                </span>
                <div class="min-w-0">
                    <strong class="text-foreground block truncate text-[11px]"
                        >Global Fallback</strong>
                    <span class="text-muted-foreground block truncate text-[10px]"
                        >Base RTN Scorer</span>
                </div>
            </div>
        </div>
    </div>

    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                <Sliders class="text-primary size-4" />
                Scoring Profile Preset
            </h3>
            <p class="text-muted-foreground text-xs">
                Profiles bundle curated format weightings and cutoff scores aligned with your
                playback setup.
            </p>
        </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {#each profiles as profile (profile.profile_id)}
            {@const isSelected = selectedProfileId === profile.profile_id}
            {@const overrideCount = Object.keys(profile.format_scores || {}).length}
            {@const { boosted, penalized } = getTopScores(profile.format_scores)}
            <div
                role="button"
                tabindex="0"
                onclick={() => select(profile.profile_id)}
                onkeydown={(e) =>
                    (e.key === "Enter" || e.key === " ") && select(profile.profile_id)}
                class="relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left backdrop-blur-sm transition-all {isSelected
                    ? 'border-primary/50 bg-primary/10 shadow-primary/5 shadow-lg'
                    : 'bg-card/40 border-white/5 hover:border-white/20'}">
                <div class="space-y-2">
                    <div class="flex items-start justify-between gap-2">
                        <Badge
                            variant={isSelected ? "default" : "outline"}
                            class="text-[10px] font-medium">
                            {#if profile.profile_id === "trash_balanced"}
                                <Sparkles class="mr-1 size-3 text-amber-300" />
                                Recommended
                            {:else}
                                Profile
                            {/if}
                        </Badge>

                        {#if isSelected}
                            <div
                                class="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">
                                <Check class="size-3" />
                            </div>
                        {/if}
                    </div>

                    <div>
                        <h4 class="text-foreground text-sm font-semibold">{profile.name}</h4>
                        <p class="text-muted-foreground mt-1 line-clamp-3 text-xs leading-relaxed">
                            {profile.description}
                        </p>
                    </div>

                    <!-- Top Boosted & Penalized Formats -->
                    {#if boosted.length > 0 || penalized.length > 0}
                        <div class="space-y-1.5 pt-2">
                            {#if boosted.length > 0}
                                <div class="flex items-center gap-1 text-[10px]">
                                    <TrendingUp class="size-3 shrink-0 text-emerald-400" />
                                    <div class="flex flex-wrap gap-1">
                                        {#each boosted as [fmt, sc] (fmt)}
                                            <span
                                                class="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-[9px] text-emerald-300">
                                                +{sc}
                                                {fmt.replace("trash_", "")}
                                            </span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                            {#if penalized.length > 0}
                                <div class="flex items-center gap-1 text-[10px]">
                                    <TrendingDown class="size-3 shrink-0 text-rose-400" />
                                    <div class="flex flex-wrap gap-1">
                                        {#each penalized as [fmt, sc] (fmt)}
                                            <span
                                                class="rounded bg-rose-500/10 px-1 py-0.5 font-mono text-[9px] text-rose-300">
                                                {sc}
                                                {fmt.replace("trash_", "")}
                                            </span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>

                <div
                    class="text-muted-foreground mt-4 space-y-1.5 border-t border-white/5 pt-3 font-mono text-[11px]">
                    <div class="flex justify-between">
                        <span>Cutoff Score:</span>
                        <strong class="text-foreground">{profile.cutoff_score} pts</strong>
                    </div>
                    <div class="flex justify-between">
                        <span>Min Floor:</span>
                        <strong class="text-foreground">{profile.min_score} pts</strong>
                    </div>
                    <div class="flex items-center justify-between">
                        <span>Reject Negatives:</span>
                        {#if profile.reject_negative_scores}
                            <span class="flex items-center gap-0.5 font-semibold text-rose-400">
                                <ShieldX class="size-3" /> Yes
                            </span>
                        {:else}
                            <span class="flex items-center gap-0.5 font-semibold text-emerald-400">
                                <ShieldCheck class="size-3" /> No
                            </span>
                        {/if}
                    </div>
                    <div class="flex justify-between">
                        <span>Active Weights:</span>
                        <strong class="text-foreground">{overrideCount} formats</strong>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
