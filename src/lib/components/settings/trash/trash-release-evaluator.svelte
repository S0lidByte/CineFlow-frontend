<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import type { TrashProfile, TrashEvaluationSummary } from "$lib/services/trash-ranking";
    import {
        evaluateTrashRelease,
        getCategoryLabel,
        getCategoryBadgeClass
    } from "$lib/services/trash-ranking";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Play from "@lucide/svelte/icons/play";
    import XCircle from "@lucide/svelte/icons/x-circle";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import Film from "@lucide/svelte/icons/film";
    import Tv from "@lucide/svelte/icons/tv";

    interface Props {
        profiles: TrashProfile[];
        selectedProfileId?: string;
    }

    let { profiles = [], selectedProfileId = "trash_balanced" }: Props = $props();

    let rawTitle = $state("Dune.Part.Two.2024.2160p.UHD.Remux.DV.HDR10.TrueHD.Atmos.7.1-FraMeSToR");
    let activeProfileId = $state("trash_balanced");
    let mediaType = $state<"movie" | "show">("movie");
    let isAnime = $state(false);

    let isEvaluating = $state(false);
    let evaluationResult = $state<TrashEvaluationSummary | null>(null);
    let evaluationError = $state<string | null>(null);

    // Sync if parent profile changes
    $effect(() => {
        if (selectedProfileId) {
            activeProfileId = selectedProfileId;
        }
    });

    const PRESET_TITLES = [
        {
            label: "Dune 2 (4K Remux DV/Atmos)",
            title: "Dune.Part.Two.2024.2160p.UHD.Remux.DV.HDR10.TrueHD.Atmos.7.1-FraMeSToR",
            mediaType: "movie" as const,
            profile: "trash_remux",
            anime: false
        },
        {
            label: "Breaking Bad (WEB-DL 1080p)",
            title: "Breaking.Bad.S05E16.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-FLUX",
            mediaType: "show" as const,
            profile: "trash_webdl",
            anime: false
        },
        {
            label: "Frieren (Anime Fansub FLAC)",
            title: "[SubsPlease] Sousou no Frieren - 28 (1080p) [9A1B2C3D].mkv",
            mediaType: "show" as const,
            profile: "trash_anime",
            anime: true
        },
        {
            label: "CAMRip / YIFY Low Quality",
            title: "Avatar.The.Way.of.Water.2022.CAM.HDCAM.x264-YTS.MX",
            mediaType: "movie" as const,
            profile: "trash_balanced",
            anime: false
        }
    ];

    async function runEvaluation() {
        if (!rawTitle.trim()) return;

        isEvaluating = true;
        evaluationError = null;

        try {
            const resp = await evaluateTrashRelease({
                raw_title: rawTitle.trim(),
                profile_id: activeProfileId,
                media_type: mediaType,
                is_anime: isAnime,
                reject_negative_scores: false,
                reject_unwanted_sources: true
            });

            evaluationResult = resp.summary;
        } catch (err: unknown) {
            evaluationError =
                err instanceof Error ? err.message : "Failed to evaluate release title";
            evaluationResult = null;
        } finally {
            isEvaluating = false;
        }
    }

    function applyPreset(preset: (typeof PRESET_TITLES)[number]) {
        rawTitle = preset.title;
        mediaType = preset.mediaType;
        activeProfileId = preset.profile;
        isAnime = preset.anime;
        runEvaluation();
    }
</script>

<div class="space-y-4">
    <!-- Header & Presets -->
    <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
            <h3 class="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles class="text-primary size-4" />
                Interactive Release Evaluator
            </h3>
            <p class="text-muted-foreground text-xs">
                Test release titles through TRaSH Guides regex engine and inspect point
                contributions.
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-1">
            <span class="text-muted-foreground mr-1 text-[11px]">Presets:</span>
            {#each PRESET_TITLES as preset (preset.label)}
                <Button
                    variant="outline"
                    size="sm"
                    class="hover:border-primary/40 h-6 border-white/10 px-2 text-[10px]"
                    onclick={() => applyPreset(preset)}>
                    {preset.label}
                </Button>
            {/each}
        </div>
    </div>

    <!-- Input Form -->
    <div class="bg-card/40 space-y-3.5 rounded-xl border border-white/5 p-4 backdrop-blur-sm">
        <div>
            <Label for="release-title-input" class="text-muted-foreground text-xs">
                Raw Release String / Torrent Title
            </Label>
            <div class="mt-1 flex gap-2">
                <Input
                    id="release-title-input"
                    type="text"
                    bind:value={rawTitle}
                    placeholder="Enter release title (e.g. Movie.Name.2024.2160p.UHD.Remux...)"
                    class="border-white/10 bg-black/40 font-mono text-xs"
                    onkeydown={(e) => e.key === "Enter" && runEvaluation()} />
                <Button
                    variant="default"
                    size="sm"
                    class="h-9 shrink-0 gap-1.5 px-4 font-medium"
                    disabled={isEvaluating || !rawTitle.trim()}
                    onclick={runEvaluation}>
                    {#if isEvaluating}
                        <Loader2 class="size-3.5 animate-spin" />
                        Evaluating...
                    {:else}
                        <Play class="size-3.5" />
                        Evaluate
                    {/if}
                </Button>
            </div>
        </div>

        <!-- Controls: Profile & Media Type -->
        <div class="flex flex-wrap items-center gap-4 border-t border-white/5 pt-1 text-xs">
            <div class="flex items-center gap-2">
                <span class="text-muted-foreground">Target Profile:</span>
                <select
                    bind:value={activeProfileId}
                    class="text-foreground focus:ring-primary rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs focus:ring-1 focus:outline-none">
                    {#each profiles as p (p.profile_id)}
                        <option value={p.profile_id}>{p.name}</option>
                    {/each}
                </select>
            </div>

            <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Media Type:</span>
                <Button
                    variant={mediaType === "movie" ? "default" : "outline"}
                    size="sm"
                    class="h-6 gap-1 px-2 text-xs"
                    onclick={() => (mediaType = "movie")}>
                    <Film class="size-3" /> Movie
                </Button>
                <Button
                    variant={mediaType === "show" ? "default" : "outline"}
                    size="sm"
                    class="h-6 gap-1 px-2 text-xs"
                    onclick={() => (mediaType = "show")}>
                    <Tv class="size-3" /> Show
                </Button>
            </div>

            <label
                class="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5">
                <input
                    type="checkbox"
                    bind:checked={isAnime}
                    class="text-primary focus:ring-primary rounded border-white/20 bg-black/40" />
                <span>Anime Content</span>
            </label>
        </div>
    </div>

    <!-- Error state -->
    {#if evaluationError}
        <div
            class="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <XCircle class="size-4 shrink-0 text-rose-400" />
            <span>{evaluationError}</span>
        </div>
    {/if}

    <!-- Evaluation Results Surface -->
    {#if evaluationResult}
        <div
            class="space-y-4 rounded-xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur-md">
            <!-- Score Banner -->
            <div
                class="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div class="flex items-center gap-3">
                    <div class="flex flex-col">
                        <span
                            class="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                            TRaSH Total Score
                        </span>
                        <div class="flex items-baseline gap-1.5">
                            <span
                                class="font-mono text-2xl font-bold {evaluationResult.total_score >
                                0
                                    ? 'text-emerald-400'
                                    : evaluationResult.total_score < 0
                                      ? 'text-rose-400'
                                      : 'text-muted-foreground'}">
                                {evaluationResult.total_score > 0
                                    ? `+${evaluationResult.total_score}`
                                    : evaluationResult.total_score}
                            </span>
                            <span class="text-muted-foreground text-xs">pts</span>
                        </div>
                    </div>

                    <div class="mx-1 hidden h-8 w-px bg-white/10 sm:block"></div>

                    <div class="hidden gap-3 text-xs sm:flex">
                        <div>
                            <span class="text-muted-foreground block text-[10px] uppercase"
                                >Additive</span>
                            <span class="font-mono font-semibold text-emerald-400"
                                >+{evaluationResult.additive_score}</span>
                        </div>
                        <div>
                            <span class="text-muted-foreground block text-[10px] uppercase"
                                >Penalties</span>
                            <span class="font-mono font-semibold text-rose-400"
                                >{evaluationResult.negative_score}</span>
                        </div>
                    </div>
                </div>

                <!-- Status Badges -->
                <div class="flex flex-wrap items-center gap-2">
                    {#if evaluationResult.rejected_by_lq}
                        <Badge variant="destructive" class="gap-1 text-xs">
                            <ShieldAlert class="size-3.5" />
                            Rejected: {evaluationResult.rejection_reason || "Low Quality Filter"}
                        </Badge>
                    {:else}
                        <Badge
                            variant="default"
                            class="gap-1 border border-emerald-500/30 bg-emerald-500/20 text-xs text-emerald-400">
                            <ShieldCheck class="size-3.5" />
                            Accepted by Scorer
                        </Badge>
                    {/if}

                    {#if evaluationResult.cutoff_reached}
                        <Badge
                            variant="outline"
                            class="gap-1 border-amber-500/40 bg-amber-500/10 text-xs text-amber-400">
                            <Sparkles class="size-3.5" />
                            Cutoff Reached
                        </Badge>
                    {/if}
                </div>
            </div>

            <!-- Matched Formats Breakdown -->
            <div class="space-y-2">
                <h4 class="text-foreground flex items-center justify-between text-xs font-semibold">
                    <span>Matched Formats ({evaluationResult.matched_formats?.length || 0})</span>
                    <span class="text-muted-foreground text-[11px] font-normal">
                        Profile: <strong>{evaluationResult.active_profile_id}</strong>
                    </span>
                </h4>

                {#if evaluationResult.matched_formats && evaluationResult.matched_formats.length > 0}
                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {#each evaluationResult.matched_formats as format (format.trash_id)}
                            <div
                                class="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-xs">
                                <div class="flex min-w-0 items-center gap-2 pr-2">
                                    <Badge
                                        variant="outline"
                                        class="shrink-0 text-[10px] {getCategoryBadgeClass(
                                            format.category
                                        )}">
                                        {getCategoryLabel(format.category)}
                                    </Badge>
                                    <span class="text-foreground truncate font-medium"
                                        >{format.name}</span>
                                </div>
                                <span
                                    class="shrink-0 font-mono font-semibold {format.score > 0
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'}">
                                    {format.score > 0 ? `+${format.score}` : format.score}
                                </span>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div
                        class="text-muted-foreground rounded-lg border border-dashed border-white/5 py-6 text-center text-xs italic">
                        No custom formats matched this release title. Default base RTN rank applies.
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
