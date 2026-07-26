<script lang="ts">
    /**
     * Custom Ranking / RTN settings panel (Ranking Studio).
     * Tabs: Filters · Languages · Patterns · Options · Tester
     */
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import { TagsInput } from "$lib/components/ui/extras/tags-input/index.js";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { toast } from "svelte-sonner";
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { onDestroy, untrack } from "svelte";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import Copy from "@lucide/svelte/icons/copy";
    import FlaskConical from "@lucide/svelte/icons/flask-conical";
    import ExternalLink from "@lucide/svelte/icons/external-link";
    import {
        RANKING_PRESETS,
        TITLE_MATCHING_MODES,
        applyRankingPreset,
        applyTitleMatchingMode,
        rankingForTester,
        clientValidatePatterns,
        countRejecting,
        denyKeyFor,
        DENY_TO_SCRAPING,
        ensureLanguages,
        humanizeAttr,
        linesToPatterns,
        patternsToLines,
        type RankingPreset,
        type RankingSettings,
        type CustomRankValue,
        type TitleMatchingMode
    } from "./ranking-presets";
    import { clearCustomDirty, customDirtyStore } from "./settings-dirty";

    interface RankingMeta {
        deny_keys: Record<string, string>;
        attribute_titles: Record<string, string>;
        categories: Record<string, string>;
        soft_opt_in_links?: Record<string, { scraping_path: string; label: string }>;
        pattern_limits?: { max_patterns_per_list?: number; max_pattern_length?: number };
        title_matching_modes?: TitleMatchingMode[];
    }

    interface TestResult {
        accepted: boolean;
        rank: number;
        lev_ratio: number;
        fetch: boolean;
        deny_reason?: string | null;
        deny_help?: string | null;
        scraping_hint?: string | null;
        title_similarity_threshold?: number | null;
        message?: string;
    }

    interface FunnelSummary {
        found: boolean;
        item_id?: number | null;
        item_log?: string | null;
        found_count: number;
        ranked: number;
        new: number;
        already_known: number;
        blacklisted: number;
        rtn_rejected: number;
        content_filtered: number;
        rtn_top: { reason: string; count: number }[];
        message?: string;
    }

    interface PatternPreview {
        require_matches: string[];
        exclude_matches: string[];
        preferred_matches: string[];
    }

    interface Props {
        ranking?: RankingSettings;
        rankingAnime?: RankingSettings;
        meta?: RankingMeta;
    }

    type RankingPackId = "ranking" | "ranking_anime";

    const PACK_LABELS: Record<RankingPackId, string> = {
        ranking: "Movies & Shows",
        ranking_anime: "Anime"
    };

    let {
        ranking = {},
        rankingAnime = {},
        meta = { deny_keys: {}, attribute_titles: {}, categories: {} }
    }: Props = $props();

    function normalizeRanking(raw: RankingSettings): RankingSettings {
        const next = structuredClone(raw) as RankingSettings;
        next.languages = ensureLanguages(next);
        next.require = [...(next.require ?? [])];
        next.exclude = [...(next.exclude ?? [])];
        next.preferred = [...(next.preferred ?? [])];
        return next;
    }

    let activePack = $state<RankingPackId>("ranking");
    let movieLocal = $state(normalizeRanking(untrack(() => ranking)));
    let movieBaseline = $state(JSON.stringify(untrack(() => normalizeRanking(ranking))));
    let animeLocal = $state(normalizeRanking(untrack(() => rankingAnime)));
    let animeBaseline = $state(JSON.stringify(untrack(() => normalizeRanking(rankingAnime))));

    let localRanking = $state(normalizeRanking(untrack(() => ranking)));
    let baselineJson = $state(JSON.stringify(untrack(() => normalizeRanking(ranking))));
    let activeDirty = $derived(JSON.stringify(localRanking) !== baselineJson);
    let otherDirty = $derived(
        activePack === "ranking"
            ? JSON.stringify(animeLocal) !== animeBaseline
            : JSON.stringify(movieLocal) !== movieBaseline
    );
    let isDirty = $derived(activeDirty || otherDirty);
    let isSaving = $state(false);
    /** Tester-only remake_diagnose threshold — never written into saveable ranking. */
    let testerMatchingMode = $state<TitleMatchingMode | null>(null);

    let langRequired = $state([...ensureLanguages(untrack(() => ranking)).required]);
    let langAllowed = $state([...ensureLanguages(untrack(() => ranking)).allowed]);
    let langExclude = $state([...ensureLanguages(untrack(() => ranking)).exclude]);
    let langPreferred = $state([...ensureLanguages(untrack(() => ranking)).preferred]);

    function hydrateLanguageEditors() {
        const langs = ensureLanguages(localRanking);
        langRequired = [...langs.required];
        langAllowed = [...langs.allowed];
        langExclude = [...langs.exclude];
        langPreferred = [...langs.preferred];
    }

    function commitLanguageEditors() {
        localRanking = {
            ...localRanking,
            languages: {
                required: [...langRequired],
                allowed: [...langAllowed],
                exclude: [...langExclude],
                preferred: [...langPreferred]
            }
        };
    }

    // Keep Ranking payload in sync as tags are added/removed.
    $effect(() => {
        const next = {
            required: langRequired,
            allowed: langAllowed,
            exclude: langExclude,
            preferred: langPreferred
        };
        const current = ensureLanguages(localRanking);
        if (JSON.stringify(next) !== JSON.stringify(current)) {
            untrack(() => commitLanguageEditors());
        }
    });

    function persistActiveDraft() {
        commitPatternEditors();
        commitLanguageEditors();
        if (activePack === "ranking") {
            movieLocal = structuredClone(localRanking);
        } else {
            animeLocal = structuredClone(localRanking);
        }
    }

    function switchPack(next: RankingPackId) {
        if (next === activePack) return;
        persistActiveDraft();
        activePack = next;
        localRanking =
            next === "ranking" ? structuredClone(movieLocal) : structuredClone(animeLocal);
        baselineJson = next === "ranking" ? movieBaseline : animeBaseline;
        testerMatchingMode = null;
        testResult = null;
        syncPatternEditors();
        hydrateLanguageEditors();
    }

    function discardChanges() {
        localRanking = structuredClone(JSON.parse(baselineJson));
        if (activePack === "ranking") {
            movieLocal = structuredClone(localRanking);
        } else {
            animeLocal = structuredClone(localRanking);
        }
        syncPatternEditors();
        hydrateLanguageEditors();
    }

    $effect(() => {
        customDirtyStore.set({
            isDirty,
            discard: discardChanges
        });
    });

    onDestroy(() => {
        clearCustomDirty();
    });

    let isTesting = $state(false);
    let isValidatingPatterns = $state(false);
    let panelTab = $state("filters");
    let activeCategory = $state("audio");
    let testTitle = $state("The.Movie.2024.2160p.WEB-DL.DDP5.1.Atmos.H.265-GROUP");
    let testCorrect = $state("");
    let testResult = $state<TestResult | null>(null);
    let patternPreview = $state<PatternPreview | null>(null);
    let patternErrors = $state<string[]>([]);
    let funnelItemId = $state("");
    let funnelSummary = $state<FunnelSummary | null>(null);
    let isLoadingFunnel = $state(false);
    const matchingModes = $derived(
        meta.title_matching_modes?.length ? meta.title_matching_modes : TITLE_MATCHING_MODES
    );

    let requireText = $state(patternsToLines(untrack(() => ranking.require)));
    let excludeText = $state(patternsToLines(untrack(() => ranking.exclude)));
    let preferredText = $state(patternsToLines(untrack(() => ranking.preferred)));

    function syncPatternEditors() {
        requireText = patternsToLines(localRanking.require);
        excludeText = patternsToLines(localRanking.exclude);
        preferredText = patternsToLines(localRanking.preferred);
    }

    function commitPatternEditors() {
        localRanking = {
            ...localRanking,
            require: linesToPatterns(requireText),
            exclude: linesToPatterns(excludeText),
            preferred: linesToPatterns(preferredText)
        };
    }

    const categories = $derived(
        Object.keys(localRanking.custom_ranks ?? {}).length
            ? Object.keys(localRanking.custom_ranks ?? {})
            : Object.keys(meta.categories)
    );

    $effect(() => {
        if (!categories.includes(activeCategory) && categories.length > 0) {
            activeCategory = categories[0];
        }
    });

    const rejectingCount = $derived(countRejecting(localRanking));
    const categoryAttrs = $derived(
        Object.entries(localRanking.custom_ranks?.[activeCategory] ?? {}) as [
            string,
            CustomRankValue
        ][]
    );

    const PROMINENT_OPTIONS = [
        "title_similarity",
        "remove_all_trash",
        "remove_adult_content"
    ] as const;

    let pendingPreset = $state<RankingPreset | null>(null);
    let showPresetConfirm = $state(false);

    function setFetch(category: string, attr: string, fetch: boolean) {
        const ranks = localRanking.custom_ranks ?? {};
        const cat = { ...(ranks[category] ?? {}) };
        cat[attr] = { ...cat[attr], fetch };
        localRanking = {
            ...localRanking,
            custom_ranks: { ...ranks, [category]: cat }
        };
    }

    function setUseCustom(category: string, attr: string, use: boolean) {
        const ranks = localRanking.custom_ranks ?? {};
        const cat = { ...(ranks[category] ?? {}) };
        cat[attr] = { ...cat[attr], use_custom_rank: use };
        localRanking = {
            ...localRanking,
            custom_ranks: { ...ranks, [category]: cat }
        };
    }

    function setRank(category: string, attr: string, rank: number) {
        const ranks = localRanking.custom_ranks ?? {};
        const cat = { ...(ranks[category] ?? {}) };
        cat[attr] = { ...cat[attr], rank, use_custom_rank: true };
        localRanking = {
            ...localRanking,
            custom_ranks: { ...ranks, [category]: cat }
        };
    }

    function enableAll(category: string, enabled: boolean) {
        const ranks = localRanking.custom_ranks ?? {};
        const cat = { ...(ranks[category] ?? {}) };
        for (const key of Object.keys(cat)) {
            cat[key] = { ...cat[key], fetch: enabled };
        }
        localRanking = {
            ...localRanking,
            custom_ranks: { ...ranks, [category]: cat }
        };
    }

    function applyPresetConfirmed(preset: RankingPreset) {
        commitPatternEditors();
        commitLanguageEditors();
        localRanking = applyRankingPreset(localRanking, preset);
        syncPatternEditors();
        hydrateLanguageEditors();
        toast.success(`Applied preset: ${preset.label}`);
    }

    function requestPreset(id: string) {
        const preset = RANKING_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        if (preset.scrapingHints?.length) {
            pendingPreset = preset;
            showPresetConfirm = true;
            return;
        }
        applyPresetConfirmed(preset);
    }

    function confirmPresetRankingOnly() {
        if (pendingPreset) applyPresetConfirmed(pendingPreset);
        pendingPreset = null;
        showPresetConfirm = false;
    }

    function confirmPresetAndOpenScraping() {
        const hints = pendingPreset?.scrapingHints ?? [];
        if (pendingPreset) applyPresetConfirmed(pendingPreset);
        pendingPreset = null;
        showPresetConfirm = false;
        const focus = hints[0]?.path ?? "scraping.anime_allow_extras_dubbed";
        void goto(resolve(`/settings?tab=scraping&focus=${encodeURIComponent(focus)}`));
    }

    async function copyDenyKey(key: string) {
        try {
            await navigator.clipboard.writeText(key);
            toast.success(`Copied ${key}`);
        } catch {
            toast.error("Could not copy");
        }
    }

    function openScrapingFocus(path: string) {
        void goto(resolve(`/settings?tab=scraping&focus=${encodeURIComponent(path)}`));
    }

    function scrapingLinkForDeny(deny: string | null | undefined) {
        if (!deny) return null;
        const key = deny.toLowerCase();
        if (DENY_TO_SCRAPING[key]) return DENY_TO_SCRAPING[key];
        const fromMeta = meta.soft_opt_in_links?.[key];
        if (fromMeta) {
            return {
                path: fromMeta.scraping_path,
                label: fromMeta.label,
                hint: meta.deny_keys[key] ?? ""
            };
        }
        return null;
    }

    function setOption(key: string, value: unknown) {
        localRanking = {
            ...localRanking,
            options: { ...localRanking.options, [key]: value }
        };
    }

    function handleSaveResult(result: {
        type: string;
        data?: {
            success?: boolean;
            pack?: RankingPackId;
            ranking?: RankingSettings;
            error?: string;
        };
    }) {
        isSaving = false;
        if (result.type === "success" && result.data?.success && result.data.ranking) {
            const saved = normalizeRanking(result.data.ranking);
            const pack = result.data.pack ?? activePack;
            localRanking = saved;
            baselineJson = JSON.stringify(saved);
            if (pack === "ranking") {
                movieLocal = structuredClone(saved);
                movieBaseline = baselineJson;
            } else {
                animeLocal = structuredClone(saved);
                animeBaseline = baselineJson;
            }
            syncPatternEditors();
            hydrateLanguageEditors();
            toast.success(`${PACK_LABELS[pack]} ranking saved`);
        } else {
            toast.error(result.data?.error ?? "Failed to save ranking settings");
        }
    }

    function handleTestResult(result: {
        type: string;
        data?: { success?: boolean; result?: TestResult; error?: string };
    }) {
        isTesting = false;
        if (result.type === "success" && result.data?.success && result.data.result) {
            testResult = result.data.result;
            if (result.data.result.accepted) {
                toast.success(`Accepted · rank ${result.data.result.rank}`);
            } else {
                toast.message(`Rejected · ${result.data.result.deny_reason ?? "unknown"}`);
            }
        } else {
            toast.error(result.data?.error ?? "Ranking test failed");
        }
    }

    function handleValidateResult(result: {
        type: string;
        data?: {
            success?: boolean;
            valid?: boolean;
            errors?: { message: string }[];
            preview?: PatternPreview | null;
            error?: string;
        };
    }) {
        isValidatingPatterns = false;
        if (result.type === "success" && result.data?.success) {
            patternPreview = result.data.preview ?? null;
            patternErrors = (result.data.errors ?? []).map((e) => e.message);
            if (result.data.valid) {
                toast.success("Patterns valid");
            } else {
                toast.error("Pattern validation failed");
            }
        } else {
            toast.error(result.data?.error ?? "Pattern validation failed");
        }
    }

    function runClientPatternCheck(): boolean {
        commitPatternEditors();
        const all = [
            ...clientValidatePatterns(localRanking.require ?? []),
            ...clientValidatePatterns(localRanking.exclude ?? []),
            ...clientValidatePatterns(localRanking.preferred ?? [])
        ];
        patternErrors = all;
        return all.length === 0;
    }

    function applyMatchingMode(mode: TitleMatchingMode) {
        if (mode.diagnose_only) {
            testerMatchingMode = mode;
            toast.success(
                `Tester-only: ${mode.label} (threshold ${mode.title_similarity} applies to Tester only — not saved)`
            );
            return;
        }
        testerMatchingMode = null;
        localRanking = applyTitleMatchingMode(localRanking, mode);
        toast.success(`Scrape-applied when saved: ${mode.label}`);
    }

    function rankingPayloadForTest(): RankingSettings {
        return rankingForTester(localRanking, testerMatchingMode);
    }

    function handleFunnelResult(result: {
        type: string;
        data?: FunnelSummary & { error?: string; success?: boolean };
    }) {
        isLoadingFunnel = false;
        if (result.type === "success" && result.data?.success) {
            funnelSummary = {
                found: Boolean(result.data.found),
                item_id: result.data.item_id,
                item_log: result.data.item_log,
                found_count: Number(result.data.found_count ?? 0),
                ranked: Number(result.data.ranked ?? 0),
                new: Number(result.data.new ?? 0),
                already_known: Number(result.data.already_known ?? 0),
                blacklisted: Number(result.data.blacklisted ?? 0),
                rtn_rejected: Number(result.data.rtn_rejected ?? 0),
                content_filtered: Number(result.data.content_filtered ?? 0),
                rtn_top: Array.isArray(result.data.rtn_top) ? result.data.rtn_top : [],
                message: result.data.message
            };
            if (!funnelSummary.found) {
                toast.message(funnelSummary.message ?? "No recent funnel for this item");
            }
        } else {
            toast.error(result.data?.error ?? "Funnel lookup failed");
        }
    }
</script>

<div class="relative z-20 isolate space-y-3">
    <!--
      Pack/Presets stay outside Filters scroll competition.
      sticky + isolate + high z so category chips (below) cannot cover these controls.
      Explore header is not mounted on Settings (layout + header guards).
    -->
    <div
        id="ranking-pack-presets"
        class="bg-background/95 pointer-events-auto sticky top-0 z-30 -mx-1 space-y-2 px-1 py-1.5 backdrop-blur-sm"
        data-ranking-controls>
        <!-- Pack switcher: movies/shows vs anime (independent settings keys) -->
        <div
            class="border-border/60 bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2"
            role="group"
            aria-label="Ranking pack">
            <span class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
                >Pack</span>
            {#each [{ id: "ranking" as const, label: PACK_LABELS.ranking }, { id: "ranking_anime" as const, label: PACK_LABELS.ranking_anime }] as packOpt (packOpt.id)}
                <Button
                    type="button"
                    size="sm"
                    variant={activePack === packOpt.id ? "default" : "outline"}
                    class="pointer-events-auto relative z-10 h-8 min-w-[7.5rem] text-xs"
                    aria-pressed={activePack === packOpt.id}
                    aria-label={`Select ${packOpt.label} ranking pack`}
                    onclick={(e) => {
                        e.stopPropagation();
                        switchPack(packOpt.id);
                    }}>
                    {packOpt.label}
                    {#if packOpt.id !== activePack && (packOpt.id === "ranking" ? JSON.stringify(movieLocal) !== movieBaseline : JSON.stringify(animeLocal) !== animeBaseline)}
                        <span class="ml-1 size-1.5 rounded-full bg-amber-500" aria-hidden="true"
                        ></span>
                    {/if}
                </Button>
            {/each}
            <p class="text-muted-foreground w-full text-[11px] sm:ml-auto sm:w-auto">
                {#if activePack === "ranking_anime"}
                    Edits <code class="text-[10px]">ranking_anime</code> — used when the item is anime.
                {:else}
                    Edits <code class="text-[10px]">ranking</code> — movies and non-anime shows.
                {/if}
            </p>
        </div>

        <!-- Compact toolbar: status + presets + save -->
        <div class="flex flex-wrap items-center gap-2">
            <Badge variant="outline" class="text-xs">
                {rejectingCount} rejecting
            </Badge>
            {#if activeDirty}
                <Badge
                    class="border-amber-500/30 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400">
                    Unsaved · {PACK_LABELS[activePack]}
                </Badge>
            {:else if otherDirty}
                <Badge
                    class="border-amber-500/30 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400">
                    Other pack unsaved
                </Badge>
            {:else}
                <Badge
                    class="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check class="mr-1 size-3" />
                    Saved
                </Badge>
            {/if}

            <div class="bg-border/60 mx-1 hidden h-4 w-px sm:block" aria-hidden="true"></div>

            <span class="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
                >Presets</span>
            {#each RANKING_PRESETS as preset (preset.id)}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="pointer-events-auto relative z-10 h-8 text-xs"
                    title={preset.description}
                    aria-label={`Apply preset ${preset.label}`}
                    onclick={(e) => {
                        e.stopPropagation();
                        requestPreset(preset.id);
                    }}>
                    {preset.label}
                </Button>
            {/each}

            <div class="ml-auto flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!activeDirty || isSaving}
                    onclick={discardChanges}>
                    Discard
                </Button>
                <form
                    method="POST"
                    action="/ranking?/save"
                    use:enhance={({ cancel, formData }) => {
                        commitPatternEditors();
                        commitLanguageEditors();
                        if (!runClientPatternCheck()) {
                            toast.error("Fix pattern errors before saving");
                            cancel();
                            return;
                        }
                        // Commit updates localRanking sync, but hidden inputs re-render async —
                        // write committed payload into FormData so the POST is not stale.
                        formData.set("pack", activePack);
                        formData.set("ranking", JSON.stringify(localRanking));
                        isSaving = true;
                        return async ({ result }) => {
                            handleSaveResult(
                                result as {
                                    type: string;
                                    data?: {
                                        success?: boolean;
                                        pack?: RankingPackId;
                                        ranking?: RankingSettings;
                                        error?: string;
                                    };
                                }
                            );
                        };
                    }}
                    class="contents">
                    <input type="hidden" name="pack" value={activePack} />
                    <input type="hidden" name="ranking" value={JSON.stringify(localRanking)} />
                    <Button
                        id="ranking-save-submit"
                        type="submit"
                        size="sm"
                        disabled={!activeDirty || isSaving}>
                        {#if isSaving}
                            <Loader2 class="size-3.5 animate-spin" />
                            Saving…
                        {:else}
                            Save {PACK_LABELS[activePack]}
                        {/if}
                    </Button>
                </form>
            </div>
        </div>
    </div>

    {#if !(localRanking.custom_ranks && Object.keys(localRanking.custom_ranks).length)}
        <div
            class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            role="status">
            {PACK_LABELS[activePack]} has no quality filters yet
            {#if activePack === "ranking_anime"}
                (backend may be older than ranking_anime, or the pack was never initialized).
            {:else}
                .
            {/if}
            Apply a Preset above to populate Filters, then Save.
        </div>
    {/if}

    <Tabs.Root bind:value={panelTab} class="w-full">
        <Tabs.List class="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-5">
            <Tabs.Trigger value="filters">Filters</Tabs.Trigger>
            <Tabs.Trigger value="languages">Languages</Tabs.Trigger>
            <Tabs.Trigger value="patterns">Patterns</Tabs.Trigger>
            <Tabs.Trigger value="options">Options</Tabs.Trigger>
            <Tabs.Trigger value="tester">
                <FlaskConical class="mr-1.5 size-3.5" />
                Tester
            </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="filters" class="mt-3 space-y-3">
            <div
                class="bg-background/80 sticky top-[5.5rem] z-10 -mx-1 flex flex-wrap gap-1.5 px-1 py-1.5 backdrop-blur-sm">
                {#each categories as cat (cat)}
                    <button
                        type="button"
                        class={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            activeCategory === cat
                                ? "border-primary/40 bg-primary/12 text-primary"
                                : "border-border/50 text-muted-foreground hover:bg-muted/50"
                        }`}
                        onclick={() => (activeCategory = cat)}>
                        {cat}
                    </button>
                {/each}
            </div>

            <div class="border-border/60 bg-card/40 rounded-xl border p-3 md:p-4">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold capitalize">{activeCategory}</h3>
                    <div class="flex gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="h-7 text-xs"
                            onclick={() => enableAll(activeCategory, true)}>
                            Enable all
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="h-7 text-xs"
                            onclick={() => enableAll(activeCategory, false)}>
                            Disable all
                        </Button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full min-w-[36rem] text-left text-sm">
                        <thead>
                            <tr class="text-muted-foreground border-b text-xs">
                                <th class="py-2 pr-2 font-medium">Attribute</th>
                                <th class="w-20 py-2 pr-2 font-medium">Fetch</th>
                                <th class="w-24 py-2 pr-2 font-medium">Custom</th>
                                <th class="w-28 py-2 pr-2 font-medium">Rank</th>
                                <th class="py-2 font-medium">Deny key</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each categoryAttrs as [attr, value] (attr)}
                                {@const deny = denyKeyFor(activeCategory, attr)}
                                <tr
                                    class={`border-border/40 border-b last:border-0 ${
                                        value.fetch === false ? "opacity-60" : ""
                                    }`}>
                                    <td class="py-2 pr-2 font-medium">
                                        {humanizeAttr(attr, meta.attribute_titles)}
                                    </td>
                                    <td class="py-2 pr-2">
                                        <Switch
                                            checked={value.fetch !== false}
                                            onCheckedChange={(v) =>
                                                setFetch(activeCategory, attr, v)}
                                            aria-label={`Fetch ${attr}`} />
                                    </td>
                                    <td class="py-2 pr-2">
                                        <Switch
                                            checked={!!value.use_custom_rank}
                                            onCheckedChange={(v) =>
                                                setUseCustom(activeCategory, attr, v)}
                                            aria-label={`Custom rank ${attr}`} />
                                    </td>
                                    <td class="py-2 pr-2">
                                        <Input
                                            type="number"
                                            class="h-8 w-24"
                                            value={value.rank ?? 0}
                                            disabled={!value.use_custom_rank}
                                            oninput={(e) =>
                                                setRank(
                                                    activeCategory,
                                                    attr,
                                                    Number(
                                                        (e.currentTarget as HTMLInputElement).value
                                                    )
                                                )} />
                                    </td>
                                    <td class="py-2">
                                        <button
                                            type="button"
                                            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-[11px]"
                                            title={meta.deny_keys[deny] ?? deny}
                                            onclick={() => copyDenyKey(deny)}>
                                            {deny}
                                            <Copy class="size-3 opacity-60" />
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </Tabs.Content>

        <Tabs.Content value="languages" class="mt-3 space-y-3">
            <div class="border-border/60 bg-card/40 space-y-4 rounded-xl border p-4">
                <p class="text-muted-foreground text-xs">
                    ISO language codes or RTN groups (<code class="font-mono">anime</code>,
                    <code class="font-mono">common</code>). Required languages reject releases that
                    lack them (<code class="font-mono">missing_required_language</code>).
                </p>
                <div class="space-y-1.5">
                    <Label>Required</Label>
                    <TagsInput
                        bind:value={langRequired}
                        placeholder="Add required language…"
                        onchange={() => commitLanguageEditors()}
                        onblur={() => commitLanguageEditors()} />
                </div>
                <div class="space-y-1.5">
                    <Label>Allowed</Label>
                    <TagsInput
                        bind:value={langAllowed}
                        placeholder="Add allowed language…"
                        onblur={() => commitLanguageEditors()} />
                </div>
                <div class="space-y-1.5">
                    <Label>Exclude</Label>
                    <TagsInput
                        bind:value={langExclude}
                        placeholder="Add excluded language…"
                        onblur={() => commitLanguageEditors()} />
                </div>
                <div class="space-y-1.5">
                    <Label>Preferred</Label>
                    <TagsInput
                        bind:value={langPreferred}
                        placeholder="Add preferred language…"
                        onblur={() => commitLanguageEditors()} />
                </div>
                <Button type="button" size="sm" variant="outline" onclick={commitLanguageEditors}>
                    Apply language edits
                </Button>
            </div>
        </Tabs.Content>

        <Tabs.Content value="patterns" class="mt-3 space-y-3">
            <div class="border-border/60 bg-card/40 space-y-4 rounded-xl border p-4">
                <p class="text-muted-foreground text-xs">
                    One regex per line. Wrap in <code class="font-mono">/slashes/</code> for
                    case-sensitive. Max {meta.pattern_limits?.max_patterns_per_list ?? 32} per list,
                    {meta.pattern_limits?.max_pattern_length ?? 200} chars each.
                </p>
                {#each [["require", "Require (must match)", requireText], ["exclude", "Exclude (reject if match)", excludeText], ["preferred", "Preferred (+rank boost)", preferredText]] as [key, label, text] (key)}
                    <div class="space-y-1.5">
                        <Label for={`pattern-${key}`}>{label}</Label>
                        <Textarea
                            id={`pattern-${key}`}
                            class="min-h-24 font-mono text-xs"
                            value={text as string}
                            oninput={(e) => {
                                const v = (e.currentTarget as HTMLTextAreaElement).value;
                                if (key === "require") requireText = v;
                                else if (key === "exclude") excludeText = v;
                                else preferredText = v;
                            }}
                            onblur={() => commitPatternEditors()}
                            placeholder="e.g. \bmatte\b" />
                    </div>
                {/each}

                {#if patternErrors.length}
                    <ul class="text-destructive list-inside list-disc text-xs">
                        {#each patternErrors as err (err)}
                            <li>{err}</li>
                        {/each}
                    </ul>
                {/if}

                <form
                    method="POST"
                    action="/ranking?/validatePatterns"
                    use:enhance={({ cancel, formData }) => {
                        commitPatternEditors();
                        if (!runClientPatternCheck()) {
                            toast.error("Fix client-side pattern errors first");
                            cancel();
                            return;
                        }
                        formData.set("require", JSON.stringify(localRanking.require ?? []));
                        formData.set("exclude", JSON.stringify(localRanking.exclude ?? []));
                        formData.set("preferred", JSON.stringify(localRanking.preferred ?? []));
                        formData.set("preview_title", testTitle);
                        isValidatingPatterns = true;
                        return async ({ result }) => {
                            handleValidateResult(
                                result as {
                                    type: string;
                                    data?: {
                                        success?: boolean;
                                        valid?: boolean;
                                        errors?: { message: string }[];
                                        preview?: PatternPreview | null;
                                        error?: string;
                                    };
                                }
                            );
                        };
                    }}
                    class="flex flex-wrap gap-2">
                    <input
                        type="hidden"
                        name="require"
                        value={JSON.stringify(localRanking.require ?? [])} />
                    <input
                        type="hidden"
                        name="exclude"
                        value={JSON.stringify(localRanking.exclude ?? [])} />
                    <input
                        type="hidden"
                        name="preferred"
                        value={JSON.stringify(localRanking.preferred ?? [])} />
                    <input type="hidden" name="preview_title" value={testTitle} />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={isValidatingPatterns}>
                        {#if isValidatingPatterns}
                            <Loader2 class="size-3.5 animate-spin" />
                            Validating…
                        {:else}
                            Validate & preview
                        {/if}
                    </Button>
                    <span class="text-muted-foreground self-center text-xs">
                        Preview uses the Tester release title.
                    </span>
                </form>

                {#if patternPreview}
                    <div class="bg-muted/40 space-y-1 rounded-lg p-3 text-xs">
                        <p>
                            <span class="font-medium">Require hits:</span>
                            {patternPreview.require_matches.join(", ") || "—"}
                        </p>
                        <p>
                            <span class="font-medium">Exclude hits:</span>
                            {patternPreview.exclude_matches.join(", ") || "—"}
                        </p>
                        <p>
                            <span class="font-medium">Preferred hits:</span>
                            {patternPreview.preferred_matches.join(", ") || "—"}
                        </p>
                    </div>
                {/if}
            </div>
        </Tabs.Content>

        <Tabs.Content value="options" class="mt-3 space-y-3">
            <div class="border-border/60 bg-card/40 space-y-4 rounded-xl border p-4">
                <div class="space-y-1">
                    <h3 class="text-sm font-semibold">Title matching mode</h3>
                    <p class="text-muted-foreground text-xs">
                        Non-diagnose modes write <span class="font-mono">title_similarity</span>
                        (scrape-applied when saved).
                        <span class="font-medium">Remake diagnose</span> is tester-only — for live remakes
                        use Scraping → enable_remake_aliases + remake_alias_groups (default off).
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    {#each matchingModes as mode (mode.id)}
                        <Button
                            type="button"
                            size="sm"
                            variant={mode.diagnose_only ? "outline" : "secondary"}
                            onclick={() => applyMatchingMode(mode)}
                            title={mode.description}>
                            {mode.label}
                            <span class="text-muted-foreground ml-1 font-mono text-[10px]">
                                {mode.title_similarity}
                            </span>
                            {#if mode.diagnose_only}
                                <span class="text-muted-foreground ml-1 text-[10px]">tester</span>
                            {:else}
                                <span class="text-muted-foreground ml-1 text-[10px]">scrape</span>
                            {/if}
                        </Button>
                    {/each}
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-7 text-xs"
                        onclick={() => openScrapingFocus("scraping.enable_aliases")}>
                        <ExternalLink class="size-3.5" />
                        Open Scraping: enable aliases
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-7 text-xs"
                        onclick={() => openScrapingFocus("scraping.enable_remake_aliases")}>
                        <ExternalLink class="size-3.5" />
                        Open Scraping: remake aliases
                    </Button>
                </div>
            </div>

            <div class="border-border/60 bg-card/40 space-y-4 rounded-xl border p-4">
                <h3 class="text-sm font-semibold">Core options</h3>
                <div class="grid gap-4 sm:grid-cols-2">
                    {#if localRanking.options && typeof localRanking.options === "object"}
                        {#each PROMINENT_OPTIONS as key (key)}
                            {@const val = localRanking.options[key]}
                            {#if typeof val === "boolean"}
                                <label class="flex items-center justify-between gap-3 text-sm">
                                    <span class="capitalize">{key.replace(/_/g, " ")}</span>
                                    <Switch
                                        checked={val}
                                        onCheckedChange={(v) => setOption(key, v)} />
                                </label>
                            {:else if typeof val === "number"}
                                <div class="space-y-1">
                                    <Label class="capitalize">{key.replace(/_/g, " ")}</Label>
                                    <Input
                                        type="number"
                                        class="h-8"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={val}
                                        oninput={(e) =>
                                            setOption(
                                                key,
                                                Number((e.currentTarget as HTMLInputElement).value)
                                            )} />
                                </div>
                            {/if}
                        {/each}
                    {/if}
                </div>
            </div>

            {#if localRanking.resolutions}
                <div class="border-border/60 bg-card/40 space-y-3 rounded-xl border p-4">
                    <h3 class="text-sm font-semibold">Resolutions</h3>
                    <div class="flex flex-wrap gap-3">
                        {#each Object.entries(localRanking.resolutions) as [key, on] (key)}
                            <label class="flex items-center gap-2 text-sm">
                                <Switch
                                    checked={!!on}
                                    onCheckedChange={(v) => {
                                        localRanking = {
                                            ...localRanking,
                                            resolutions: {
                                                ...localRanking.resolutions,
                                                [key]: v
                                            }
                                        };
                                    }} />
                                <span class="capitalize">{key.replace(/^r/, "")}</span>
                            </label>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if localRanking.options && typeof localRanking.options === "object"}
                <div class="border-border/60 bg-card/40 space-y-3 rounded-xl border p-4">
                    <h3 class="text-sm font-semibold">More RTN options</h3>
                    <div class="grid gap-3 sm:grid-cols-2">
                        {#each Object.entries(localRanking.options) as [key, val] (key)}
                            {#if !(PROMINENT_OPTIONS as readonly string[]).includes(key)}
                                {#if typeof val === "boolean"}
                                    <label class="flex items-center justify-between gap-3 text-sm">
                                        <span class="capitalize">{key.replace(/_/g, " ")}</span>
                                        <Switch
                                            checked={val}
                                            onCheckedChange={(v) => setOption(key, v)} />
                                    </label>
                                {:else if typeof val === "number"}
                                    <div class="space-y-1">
                                        <Label class="capitalize">{key.replace(/_/g, " ")}</Label>
                                        <Input
                                            type="number"
                                            class="h-8"
                                            step="any"
                                            value={val}
                                            oninput={(e) =>
                                                setOption(
                                                    key,
                                                    Number(
                                                        (e.currentTarget as HTMLInputElement).value
                                                    )
                                                )} />
                                    </div>
                                {/if}
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}
        </Tabs.Content>

        <Tabs.Content value="tester" class="mt-3 space-y-3">
            <div class="border-border/60 bg-card/40 space-y-3 rounded-xl border p-4">
                <div class="space-y-1.5">
                    <Label for="test-title">Release title</Label>
                    <Input
                        id="test-title"
                        bind:value={testTitle}
                        placeholder="Paste a torrent name…"
                        class="font-mono text-xs" />
                </div>
                <div class="space-y-1.5">
                    <Label for="test-correct">Correct media title (optional)</Label>
                    <Input
                        id="test-correct"
                        bind:value={testCorrect}
                        placeholder="Improves similarity scoring" />
                </div>
                <form
                    method="POST"
                    action="/ranking?/test"
                    use:enhance={({ formData }) => {
                        commitPatternEditors();
                        commitLanguageEditors();
                        const payload = rankingPayloadForTest();
                        formData.set("raw_title", testTitle);
                        formData.set("correct_title", testCorrect);
                        formData.set("ranking", JSON.stringify(payload));
                        isTesting = true;
                        return async ({ result }) => {
                            handleTestResult(
                                result as {
                                    type: string;
                                    data?: {
                                        success?: boolean;
                                        result?: TestResult;
                                        error?: string;
                                    };
                                }
                            );
                        };
                    }}
                    class="flex flex-wrap gap-2">
                    <input type="hidden" name="raw_title" value={testTitle} />
                    <input type="hidden" name="correct_title" value={testCorrect} />
                    <input
                        type="hidden"
                        name="ranking"
                        value={JSON.stringify(rankingPayloadForTest())} />
                    <Button type="submit" size="sm" disabled={isTesting || !testTitle.trim()}>
                        {#if isTesting}
                            <Loader2 class="size-3.5 animate-spin" />
                            Testing…
                        {:else}
                            <FlaskConical class="size-3.5" />
                            Test with current edits
                        {/if}
                    </Button>
                </form>
                <p class="text-muted-foreground text-xs">
                    Uses unsaved edits — does not persist until you save.
                </p>
            </div>

            {#if testResult}
                {@const scrapeLink = scrapingLinkForDeny(testResult.deny_reason)}
                <div
                    class={`rounded-xl border p-4 ${
                        testResult.accepted
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-amber-500/30 bg-amber-500/10"
                    }`}>
                    <div class="flex items-start gap-2">
                        {#if testResult.accepted}
                            <Check class="mt-0.5 size-4 text-emerald-500" />
                        {:else}
                            <AlertCircle class="mt-0.5 size-4 text-amber-500" />
                        {/if}
                        <div class="min-w-0 space-y-1 text-sm">
                            <p class="font-semibold">
                                {testResult.accepted ? "Accepted" : "Rejected"}
                                {#if testResult.accepted}
                                    · rank {testResult.rank}
                                    · lev {testResult.lev_ratio.toFixed(3)}
                                    {#if testResult.title_similarity_threshold != null}
                                        · threshold {testResult.title_similarity_threshold.toFixed(
                                            2
                                        )}
                                    {/if}
                                {/if}
                            </p>
                            {#if !testResult.accepted && testResult.title_similarity_threshold != null}
                                <p class="text-muted-foreground text-xs">
                                    Title similarity threshold:
                                    {testResult.title_similarity_threshold.toFixed(2)}
                                    (raise aliases / lower threshold only to diagnose remakes)
                                </p>
                            {/if}
                            {#if testResult.deny_reason}
                                <p class="font-mono text-xs">
                                    deny key:
                                    <button
                                        type="button"
                                        class="text-primary underline-offset-2 hover:underline"
                                        onclick={() =>
                                            copyDenyKey(String(testResult?.deny_reason))}>
                                        {testResult.deny_reason}
                                    </button>
                                </p>
                            {/if}
                            {#if testResult.deny_help}
                                <p class="text-muted-foreground text-xs">{testResult.deny_help}</p>
                            {/if}
                            {#if testResult.scraping_hint}
                                <p class="text-xs">{testResult.scraping_hint}</p>
                            {/if}
                            {#if scrapeLink}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="mt-2 h-7 text-xs"
                                    onclick={() => openScrapingFocus(scrapeLink.path)}>
                                    <ExternalLink class="size-3.5" />
                                    Open Scraping: {scrapeLink.label}
                                </Button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}

            <div class="border-border/60 bg-card/40 space-y-3 rounded-xl border p-4">
                <div class="space-y-1">
                    <h3 class="text-sm font-semibold">Scrape funnel summary</h3>
                    <p class="text-muted-foreground text-xs">
                        Top deny buckets from the last scrape of an item (found / ranked / new /
                        rtn_top including title_mismatch). Cached after a scrape on this backend
                        process.
                    </p>
                </div>
                <form
                    method="POST"
                    action="/ranking?/funnel"
                    use:enhance={({ formData }) => {
                        formData.set("item_id", funnelItemId.trim());
                        funnelSummary = null;
                        isLoadingFunnel = true;
                        return async ({ result }) => {
                            handleFunnelResult(
                                result as {
                                    type: string;
                                    data?: FunnelSummary & { error?: string; success?: boolean };
                                }
                            );
                        };
                    }}
                    class="flex flex-wrap items-end gap-2">
                    <div class="space-y-1.5">
                        <Label for="funnel-item-id">Media item id</Label>
                        <Input
                            id="funnel-item-id"
                            class="h-8 w-36 font-mono text-xs"
                            bind:value={funnelItemId}
                            placeholder="e.g. 42" />
                    </div>
                    <input type="hidden" name="item_id" value={funnelItemId} />
                    <Button type="submit" size="sm" variant="outline" disabled={isLoadingFunnel}>
                        {#if isLoadingFunnel}
                            <Loader2 class="size-3.5 animate-spin" />
                            Loading…
                        {:else}
                            Load funnel
                        {/if}
                    </Button>
                </form>
                {#if funnelSummary?.found}
                    <div class="bg-muted/40 space-y-2 rounded-lg p-3 text-xs">
                        <p class="font-medium">
                            {funnelSummary.item_log ?? `Item ${funnelSummary.item_id}`}
                        </p>
                        <p>
                            found={funnelSummary.found_count} ranked={funnelSummary.ranked}
                            new={funnelSummary.new} already_known={funnelSummary.already_known}
                            blacklisted={funnelSummary.blacklisted}
                            rtn_rejected={funnelSummary.rtn_rejected}
                            content_filtered={funnelSummary.content_filtered}
                        </p>
                        {#if funnelSummary.rtn_top.length}
                            <div class="flex flex-wrap gap-1.5">
                                {#each funnelSummary.rtn_top as bucket (bucket.reason)}
                                    <Badge variant="outline" class="font-mono text-[10px]">
                                        {bucket.reason}:{bucket.count}
                                    </Badge>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </Tabs.Content>
    </Tabs.Root>
</div>

<AlertDialog.Root bind:open={showPresetConfirm}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Apply {pendingPreset?.label}?</AlertDialog.Title>
            <AlertDialog.Description>
                This updates Ranking settings only. Related Scraping soft-opt-ins are
                <strong class="text-foreground"> not</strong> changed automatically:
            </AlertDialog.Description>
        </AlertDialog.Header>
        <ul class="text-muted-foreground list-inside list-disc text-sm">
            {#each pendingPreset?.scrapingHints ?? [] as hint (hint.path)}
                <li>{hint.label}</li>
            {/each}
        </ul>
        <AlertDialog.Footer>
            <AlertDialog.Cancel
                onclick={() => {
                    pendingPreset = null;
                }}>Cancel</AlertDialog.Cancel>
            <Button type="button" variant="outline" onclick={confirmPresetRankingOnly}>
                Apply ranking only
            </Button>
            <AlertDialog.Action onclick={confirmPresetAndOpenScraping}>
                Apply & open Scraping
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
