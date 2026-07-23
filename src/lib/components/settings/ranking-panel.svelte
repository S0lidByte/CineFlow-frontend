<script lang="ts">
    /**
     * Custom Ranking / RTN settings panel.
     * Matrix of Fetch|Custom|Rank per attribute, presets, and release tester.
     */
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import { toast } from "svelte-sonner";
    import { enhance } from "$app/forms";
    import { untrack } from "svelte";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import Copy from "@lucide/svelte/icons/copy";
    import FlaskConical from "@lucide/svelte/icons/flask-conical";
    import {
        RANKING_PRESETS,
        applyRankingPreset,
        countRejecting,
        denyKeyFor,
        humanizeAttr,
        type RankingSettings,
        type CustomRankValue
    } from "./ranking-presets";

    interface RankingMeta {
        deny_keys: Record<string, string>;
        attribute_titles: Record<string, string>;
        categories: Record<string, string>;
    }

    interface TestResult {
        accepted: boolean;
        rank: number;
        lev_ratio: number;
        fetch: boolean;
        deny_reason?: string | null;
        deny_help?: string | null;
        message?: string;
    }

    interface Props {
        ranking?: RankingSettings;
        meta?: RankingMeta;
    }

    let { ranking = {}, meta = { deny_keys: {}, attribute_titles: {}, categories: {} } }: Props =
        $props();

    let localRanking = $state(structuredClone(untrack(() => ranking)) as RankingSettings);
    let baselineJson = $state(JSON.stringify(untrack(() => ranking)));
    let isDirty = $derived(JSON.stringify(localRanking) !== baselineJson);
    let isSaving = $state(false);
    let isTesting = $state(false);
    let panelTab = $state("filters");
    let activeCategory = $state("audio");
    let testTitle = $state(
        "The.Movie.2024.2160p.WEB-DL.DDP5.1.Atmos.H.265-GROUP"
    );
    let testCorrect = $state("");
    let testResult = $state<TestResult | null>(null);

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

    function applyPreset(id: string) {
        const preset = RANKING_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        localRanking = applyRankingPreset(localRanking, preset);
        toast.success(`Applied preset: ${preset.label}`);
    }

    async function copyDenyKey(key: string) {
        try {
            await navigator.clipboard.writeText(key);
            toast.success(`Copied ${key}`);
        } catch {
            toast.error("Could not copy");
        }
    }

    function handleSaveResult(result: {
        type: string;
        data?: { success?: boolean; ranking?: RankingSettings; error?: string };
    }) {
        isSaving = false;
        if (result.type === "success" && result.data?.success && result.data.ranking) {
            localRanking = structuredClone(result.data.ranking);
            baselineJson = JSON.stringify(result.data.ranking);
            toast.success("Ranking settings saved");
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

    function onKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (isDirty && !isSaving) {
                document.getElementById("ranking-save-submit")?.click();
            }
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="space-y-3">
    <!-- Compact toolbar: status + presets + save -->
    <div class="flex flex-wrap items-center gap-2">
        <Badge variant="outline" class="text-xs">
            {rejectingCount} rejecting
        </Badge>
        {#if isDirty}
            <Badge
                class="border-amber-500/30 bg-amber-500/15 text-xs text-amber-600 dark:text-amber-400">
                Unsaved
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
                class="h-7 text-xs"
                title={preset.description}
                onclick={() => applyPreset(preset.id)}>
                {preset.label}
            </Button>
        {/each}

        <div class="ml-auto flex flex-wrap gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDirty || isSaving}
                onclick={() => {
                    localRanking = structuredClone(JSON.parse(baselineJson));
                }}>
                Discard
            </Button>
            <form
                method="POST"
                action="/ranking?/save"
                use:enhance={() => {
                    isSaving = true;
                    return async ({ result }) => {
                        handleSaveResult(
                            result as {
                                type: string;
                                data?: {
                                    success?: boolean;
                                    ranking?: RankingSettings;
                                    error?: string;
                                };
                            }
                        );
                    };
                }}
                class="contents">
                <input type="hidden" name="ranking" value={JSON.stringify(localRanking)} />
                <Button
                    id="ranking-save-submit"
                    type="submit"
                    size="sm"
                    disabled={!isDirty || isSaving}>
                    {#if isSaving}
                        <Loader2 class="size-3.5 animate-spin" />
                        Saving…
                    {:else}
                        Save ranking
                    {/if}
                </Button>
            </form>
        </div>
    </div>

    <Tabs.Root bind:value={panelTab} class="w-full">
        <Tabs.List class="grid w-full max-w-md grid-cols-2">
            <Tabs.Trigger value="filters">Filters & ranks</Tabs.Trigger>
            <Tabs.Trigger value="tester">
                <FlaskConical class="mr-1.5 size-3.5" />
                Release tester
            </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="filters" class="mt-3 space-y-3">
            <div
                class="bg-background/80 sticky top-0 z-10 -mx-1 flex flex-wrap gap-1.5 px-1 py-1.5 backdrop-blur-sm">
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

            {#if localRanking.resolutions}
                <details class="border-border/60 group rounded-xl border p-3 md:p-4">
                    <summary
                        class="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                        Resolutions
                        <span class="text-muted-foreground ml-2 text-xs font-normal"
                            >optional filters</span>
                    </summary>
                    <div class="mt-3 flex flex-wrap gap-3">
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
                </details>
            {/if}

            {#if localRanking.options && typeof localRanking.options === "object"}
                <details class="border-border/60 rounded-xl border p-3 md:p-4">
                    <summary
                        class="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                        Options
                        <span class="text-muted-foreground ml-2 text-xs font-normal"
                            >RTN extras</span>
                    </summary>
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                        {#each Object.entries(localRanking.options) as [key, val] (key)}
                            {#if typeof val === "boolean"}
                                <label class="flex items-center justify-between gap-3 text-sm">
                                    <span class="capitalize">{key.replace(/_/g, " ")}</span>
                                    <Switch
                                        checked={val}
                                        onCheckedChange={(v) => {
                                            localRanking = {
                                                ...localRanking,
                                                options: { ...localRanking.options, [key]: v }
                                            };
                                        }} />
                                </label>
                            {:else if typeof val === "number"}
                                <div class="space-y-1">
                                    <Label class="capitalize">{key.replace(/_/g, " ")}</Label>
                                    <Input
                                        type="number"
                                        class="h-8"
                                        step="any"
                                        value={val}
                                        oninput={(e) => {
                                            localRanking = {
                                                ...localRanking,
                                                options: {
                                                    ...localRanking.options,
                                                    [key]: Number(
                                                        (e.currentTarget as HTMLInputElement).value
                                                    )
                                                }
                                            };
                                        }} />
                                </div>
                            {/if}
                        {/each}
                    </div>
                </details>
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
                    use:enhance={() => {
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
                    <input type="hidden" name="ranking" value={JSON.stringify(localRanking)} />
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
                                {/if}
                            </p>
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
                        </div>
                    </div>
                </div>
            {/if}
        </Tabs.Content>
    </Tabs.Root>
</div>
