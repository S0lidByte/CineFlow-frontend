<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/stores";
    import { onDestroy, untrack } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { toast } from "svelte-sonner";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import Plus from "@lucide/svelte/icons/plus";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import X from "@lucide/svelte/icons/x";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Filter from "@lucide/svelte/icons/filter";
    import SettingsPanelToolbar from "$lib/components/settings/settings-panel-toolbar.svelte";
    import SettingsStatusBadge from "$lib/components/settings/settings-status-badge.svelte";
    import SettingsPanelSurface from "$lib/components/settings/settings-panel-surface.svelte";
    import SettingsDetailsCard from "$lib/components/settings/settings-details-card.svelte";
    import SettingsEmptyState from "$lib/components/settings/settings-empty-state.svelte";
    import { clearCustomDirty, customDirtyStore } from "$lib/components/settings/settings-dirty";

    // ─── Types ───────────────────────────────────────────────────────────────
    interface FilterRules {
        content_types?: string[] | null;
        genres?: string[] | null;
        is_anime?: boolean | null;
        networks?: string[] | null;
        countries?: string[] | null;
        languages?: string[] | null;
        min_year?: number | null;
        max_year?: number | null;
        min_rating?: number | null;
        max_rating?: number | null;
        content_ratings?: string[] | null;
    }

    interface LibraryProfile {
        name: string;
        library_path: string;
        enabled: boolean;
        /** Optional scrape ranking pack override; null/omit = item.is_anime fallback */
        ranking_pack?: "ranking" | "ranking_anime" | null;
        filter_rules: FilterRules;
    }

    // ─── State ───────────────────────────────────────────────────────────────
    let { profiles = {} }: { profiles?: Record<string, LibraryProfile> } = $props();
    let localProfiles = $state<Record<string, LibraryProfile>>(
        structuredClone(untrack(() => profiles))
    );
    /** Baseline used for dirty detection; updated after a successful save. */
    let baselineJson = $state(JSON.stringify(untrack(() => profiles)));

    let expanded = $state<Record<string, boolean>>({});

    let showAddDialog = $state(false);
    let newKey = $state("");
    let newName = $state("");
    let newPath = $state("/");
    let newKeyError = $state("");

    let pendingDelete = $state<string | null>(null);
    let isSaving = $state(false);

    const isDirty = $derived(JSON.stringify(localProfiles) !== baselineJson);

    function discardChanges() {
        localProfiles = structuredClone(JSON.parse(baselineJson));
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

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function profileKeys(): string[] {
        return Object.keys(localProfiles);
    }

    function toggleProfile(key: string, val: boolean) {
        localProfiles[key] = { ...localProfiles[key], enabled: val };
    }

    function setField(key: string, field: keyof LibraryProfile, val: unknown) {
        (localProfiles[key] as unknown as Record<string, unknown>)[field] = val;
        localProfiles = { ...localProfiles };
    }

    function setFilter(key: string, field: keyof FilterRules, val: unknown) {
        localProfiles[key] = {
            ...localProfiles[key],
            filter_rules: { ...localProfiles[key].filter_rules, [field]: val }
        };
    }

    function addTag(key: string, field: keyof FilterRules, val: string) {
        const trimmed = val.trim();
        if (!trimmed) return;
        const existing =
            (localProfiles[key].filter_rules[field] as string[] | null | undefined) ?? [];
        if (!existing.includes(trimmed)) {
            setFilter(key, field, [...existing, trimmed]);
        }
    }

    function removeTag(key: string, field: keyof FilterRules, idx: number) {
        const existing =
            (localProfiles[key].filter_rules[field] as string[] | null | undefined) ?? [];
        setFilter(
            key,
            field,
            existing.filter((_, i) => i !== idx)
        );
    }

    function onTagKeydown(
        e: KeyboardEvent & { currentTarget: HTMLInputElement },
        key: string,
        field: keyof FilterRules
    ) {
        if (e.key === "Enter") {
            e.preventDefault();
            addTag(key, field, e.currentTarget.value);
            e.currentTarget.value = "";
        }
    }

    function validateKey(k: string): string {
        if (!k) return "Key is required";
        if (!/^[a-z0-9_]+$/.test(k)) return "Only lowercase letters, numbers, underscore";
        if (k === "default") return "'default' is reserved";
        if (localProfiles[k]) return "Key already exists";
        return "";
    }

    function addProfile() {
        const err = validateKey(newKey);
        if (err) {
            newKeyError = err;
            return;
        }
        if (!newPath.startsWith("/")) {
            newKeyError = "Library path must start with /";
            return;
        }
        localProfiles[newKey] = {
            name: newName || newKey,
            library_path: newPath,
            enabled: true,
            filter_rules: {}
        };
        expanded[newKey] = true;
        showAddDialog = false;
        newKey = "";
        newName = "";
        newPath = "/";
        newKeyError = "";
    }

    function deleteProfile(key: string) {
        const next = { ...localProfiles };
        delete next[key];
        localProfiles = next;
        pendingDelete = null;
    }

    function handleSaveResult(result: { type: string; data?: unknown }) {
        isSaving = false;
        const payload = (result.data ?? {}) as {
            success?: boolean;
            profiles?: Record<string, LibraryProfile>;
        };
        if (result.type === "success" || (result.type === "failure" && payload.success)) {
            if (payload.profiles && typeof payload.profiles === "object") {
                localProfiles = structuredClone(payload.profiles);
                baselineJson = JSON.stringify(payload.profiles);
            } else {
                baselineJson = JSON.stringify(localProfiles);
            }
            toast.success("Library profiles saved");
        } else {
            toast.error("Failed to save library profiles");
        }
    }

    const CONTENT_TYPES = ["movie", "show"];

    const RANKING_PACK_OPTIONS: {
        value: "" | "ranking" | "ranking_anime";
        label: string;
    }[] = [
        { value: "", label: "Auto (item anime flag)" },
        { value: "ranking", label: "Movies & Shows" },
        { value: "ranking_anime", label: "Anime" }
    ];

    function rankingPackValue(profile: LibraryProfile): "" | "ranking" | "ranking_anime" {
        return profile.ranking_pack ?? "";
    }

    /** Expand profiles when Cmd+K jumps to a library_profiles focus path. */
    $effect(() => {
        const focus = $page.url.searchParams.get("focus");
        if (!focus?.startsWith("library_profiles")) return;
        const keys = profileKeys();
        if (keys.length === 0) return;
        const next = { ...expanded };
        for (const k of keys) next[k] = true;
        expanded = next;
    });
</script>

<div class="space-y-3">
    <SettingsPanelToolbar>
        {#snippet left()}
            <SettingsStatusBadge variant="neutral" label="{profileKeys().length} profiles" />
            {#if isDirty}
                <SettingsStatusBadge variant="unsaved" label="Unsaved" />
            {:else}
                <SettingsStatusBadge variant="saved" label="Saved" />
            {/if}
            <div class="bg-border/60 mx-1 hidden h-4 w-px sm:block" aria-hidden="true"></div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                onclick={() => (showAddDialog = true)}>
                <Plus class="size-3.5" />
                Add Profile
            </Button>
        {/snippet}
        {#snippet actions()}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDirty || isSaving}
                onclick={discardChanges}>
                Discard
            </Button>
            <form
                method="POST"
                action="/library-profiles?/save"
                use:enhance={() => {
                    isSaving = true;
                    return async ({ result }) => {
                        handleSaveResult(result);
                    };
                }}
                class="contents">
                <input type="hidden" name="profiles" value={JSON.stringify(localProfiles)} />
                <Button
                    id="library-profiles-save-submit"
                    type="submit"
                    size="sm"
                    disabled={!isDirty || isSaving}>
                    {#if isSaving}
                        <Loader2 class="size-3.5 animate-spin" />
                        Saving…
                    {:else}
                        Save profiles
                    {/if}
                </Button>
            </form>
        {/snippet}
    </SettingsPanelToolbar>

    {#if profileKeys().length === 0}
        <SettingsEmptyState icon={BookOpen} title="No library profiles yet.">
            {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (showAddDialog = true)}>
                    <Plus class="size-4" /> Add your first profile
                </Button>
            {/snippet}
        </SettingsEmptyState>
    {:else}
        <div class="flex flex-col gap-3">
            {#each profileKeys() as key (key)}
                {@const profile = localProfiles[key]}
                {@const isExpanded = expanded[key] ?? false}
                {@const hasFilters = Object.values(profile.filter_rules ?? {}).some(
                    (v) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
                )}

                <SettingsPanelSurface class="p-0 transition-shadow hover:shadow-md md:p-0">
                    <button
                        type="button"
                        class="flex w-full items-center gap-3 px-3 py-3 text-left md:px-4 md:py-3.5"
                        onclick={() => (expanded[key] = !isExpanded)}>
                        <span
                            class="size-2 shrink-0 rounded-full {profile.enabled
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground/40'}"
                            title={profile.enabled ? "Enabled" : "Disabled"}></span>

                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-sm font-semibold">{profile.name}</span>
                                <code
                                    class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]"
                                    >{key}</code>
                                <Badge
                                    variant="outline"
                                    class="text-muted-foreground px-1.5 py-0 font-mono text-[10px]">
                                    {profile.library_path}
                                </Badge>
                                {#if hasFilters}
                                    <span
                                        class="text-muted-foreground flex items-center gap-1 text-[10px]">
                                        <Filter class="size-3" /> Filters active
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <ChevronDown
                            class="text-muted-foreground size-4 shrink-0 transition-transform {isExpanded
                                ? 'rotate-180'
                                : ''}" />
                    </button>

                    {#if isExpanded}
                        <div
                            class="border-border/40 space-y-3 border-t px-3 pt-3 pb-3 md:px-4 md:pb-4">
                            <div class="grid gap-4 md:grid-cols-2">
                                <div
                                    class="border-border/60 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2.5 md:col-span-2"
                                    data-settings-search-path="library_profiles.enabled">
                                    <div>
                                        <Label class="text-sm font-medium">Enabled</Label>
                                        <p class="text-muted-foreground text-xs">
                                            Include this profile when matching media
                                        </p>
                                    </div>
                                    <Switch
                                        checked={profile.enabled}
                                        onCheckedChange={(v) => toggleProfile(key, v)}
                                        aria-label="Enable profile" />
                                </div>

                                <div
                                    class="flex flex-col gap-1.5"
                                    data-settings-search-path="library_profiles.name">
                                    <Label class="text-sm font-semibold">Name</Label>
                                    <Input
                                        value={profile.name}
                                        oninput={(e) =>
                                            setField(key, "name", e.currentTarget.value)}
                                        placeholder="Human-readable profile name" />
                                </div>

                                <div
                                    class="flex flex-col gap-1.5"
                                    data-settings-search-path="library_profiles.library_path">
                                    <Label class="text-sm font-semibold">Library Path</Label>
                                    <Input
                                        value={profile.library_path}
                                        oninput={(e) =>
                                            setField(key, "library_path", e.currentTarget.value)}
                                        placeholder="/anime"
                                        class="font-mono" />
                                    <span class="text-muted-foreground text-[11px]"
                                        >VFS path prefix (e.g. <code class="bg-muted rounded px-1"
                                            >/anime</code
                                        >,
                                        <code class="bg-muted rounded px-1">/kids</code>)</span>
                                </div>

                                <div
                                    class="flex flex-col gap-1.5 md:col-span-2"
                                    data-settings-search-path="library_profiles.ranking_pack">
                                    <Label class="text-sm font-semibold">Ranking pack</Label>
                                    <select
                                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                                        value={rankingPackValue(profile)}
                                        onchange={(e) => {
                                            const v = e.currentTarget.value as
                                                | ""
                                                | "ranking"
                                                | "ranking_anime";
                                            setField(key, "ranking_pack", v === "" ? null : v);
                                        }}>
                                        {#each RANKING_PACK_OPTIONS as opt (opt.value)}
                                            <option value={opt.value}>{opt.label}</option>
                                        {/each}
                                    </select>
                                    <span class="text-muted-foreground text-[11px]">
                                        When this profile matches during scrape, use this Ranking
                                        Studio pack. Auto falls back to the item’s anime flag. First
                                        matching profile with a pack set wins.
                                    </span>
                                </div>

                                <div
                                    class="flex flex-col gap-2"
                                    data-settings-search-path="library_profiles.filter_rules.content_types">
                                    <Label class="text-sm font-semibold">Content Types</Label>
                                    <div class="flex gap-3">
                                        {#each CONTENT_TYPES as ct (ct)}
                                            {@const active = (
                                                profile.filter_rules?.content_types ?? []
                                            ).includes(ct)}
                                            <button
                                                type="button"
                                                onclick={() => {
                                                    const cur =
                                                        profile.filter_rules?.content_types ?? [];
                                                    setFilter(
                                                        key,
                                                        "content_types",
                                                        active
                                                            ? cur.filter((v) => v !== ct)
                                                            : [...cur, ct]
                                                    );
                                                }}
                                                class="rounded-md border px-3 py-1 text-xs font-medium transition-colors {active
                                                    ? 'border-primary bg-primary/15 text-primary'
                                                    : 'border-border/70 bg-muted/40 text-muted-foreground hover:border-border'}">
                                                {ct}
                                            </button>
                                        {/each}
                                        <span class="text-muted-foreground self-center text-[11px]"
                                            >None = all types</span>
                                    </div>
                                </div>

                                <div
                                    class="border-border/60 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2.5"
                                    data-settings-search-path="library_profiles.filter_rules.is_anime">
                                    <div>
                                        <Label class="text-sm font-medium">Anime only</Label>
                                        <p class="text-muted-foreground text-xs">
                                            Match only anime-flagged content
                                        </p>
                                    </div>
                                    <Switch
                                        checked={profile.filter_rules?.is_anime === true}
                                        onCheckedChange={(v) =>
                                            setFilter(key, "is_anime", v ? true : null)}
                                        aria-label="Anime only" />
                                </div>

                                <div
                                    class="flex flex-col gap-1.5 md:col-span-2"
                                    data-settings-search-path="library_profiles.filter_rules.genres">
                                    <Label class="text-sm font-semibold"
                                        >Genres <span class="text-muted-foreground/70 font-normal"
                                            >(prefix with ! to exclude)</span
                                        ></Label>
                                    <div
                                        class="border-border/60 bg-background/40 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2">
                                        {#each profile.filter_rules?.genres ?? [] as tag, i (tag)}
                                            <span
                                                class="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium {tag.startsWith(
                                                    '!'
                                                )
                                                    ? 'border-destructive/40 bg-destructive/15 text-destructive border'
                                                    : 'border-border/70 bg-muted/50 text-foreground border'}">
                                                {tag}
                                                <button
                                                    type="button"
                                                    onclick={() => removeTag(key, "genres", i)}
                                                    class="opacity-60 hover:opacity-100">
                                                    <X class="size-3" />
                                                </button>
                                            </span>
                                        {/each}
                                        <input
                                            type="text"
                                            placeholder="Add genre…"
                                            class="placeholder:text-muted-foreground/50 min-w-[8rem] flex-1 bg-transparent text-xs outline-none"
                                            onkeydown={(e) => onTagKeydown(e, key, "genres")} />
                                    </div>
                                </div>

                                <div class="md:col-span-2">
                                    <div data-settings-search-path="library_profiles.filter_rules">
                                        <SettingsDetailsCard
                                            title="Advanced filters"
                                            subtitle="ratings, year, networks, languages…"
                                            class="bg-background/20">
                                            <div class="grid gap-4 md:grid-cols-2">
                                                <div
                                                    class="flex flex-col gap-1.5"
                                                    data-settings-search-path="library_profiles.filter_rules.min_year">
                                                    <Label class="text-sm font-semibold"
                                                        >Year Range</Label>
                                                    <div class="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            placeholder="From"
                                                            value={profile.filter_rules?.min_year ??
                                                                ""}
                                                            oninput={(e) =>
                                                                setFilter(
                                                                    key,
                                                                    "min_year",
                                                                    e.currentTarget.value
                                                                        ? Number(
                                                                              e.currentTarget.value
                                                                          )
                                                                        : null
                                                                )}
                                                            class="w-24" />
                                                        <span class="text-muted-foreground text-xs"
                                                            >–</span>
                                                        <Input
                                                            type="number"
                                                            placeholder="To"
                                                            value={profile.filter_rules?.max_year ??
                                                                ""}
                                                            oninput={(e) =>
                                                                setFilter(
                                                                    key,
                                                                    "max_year",
                                                                    e.currentTarget.value
                                                                        ? Number(
                                                                              e.currentTarget.value
                                                                          )
                                                                        : null
                                                                )}
                                                            class="w-24" />
                                                    </div>
                                                </div>

                                                <div
                                                    class="flex flex-col gap-1.5"
                                                    data-settings-search-path="library_profiles.filter_rules.min_rating">
                                                    <Label class="text-sm font-semibold"
                                                        >Rating Range <span
                                                            class="text-muted-foreground/70 font-normal"
                                                            >(0–10)</span
                                                        ></Label>
                                                    <div class="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            placeholder="Min"
                                                            min="0"
                                                            max="10"
                                                            step="0.1"
                                                            value={profile.filter_rules
                                                                ?.min_rating ?? ""}
                                                            oninput={(e) =>
                                                                setFilter(
                                                                    key,
                                                                    "min_rating",
                                                                    e.currentTarget.value
                                                                        ? Number(
                                                                              e.currentTarget.value
                                                                          )
                                                                        : null
                                                                )}
                                                            class="w-24" />
                                                        <span class="text-muted-foreground text-xs"
                                                            >–</span>
                                                        <Input
                                                            type="number"
                                                            placeholder="Max"
                                                            min="0"
                                                            max="10"
                                                            step="0.1"
                                                            value={profile.filter_rules
                                                                ?.max_rating ?? ""}
                                                            oninput={(e) =>
                                                                setFilter(
                                                                    key,
                                                                    "max_rating",
                                                                    e.currentTarget.value
                                                                        ? Number(
                                                                              e.currentTarget.value
                                                                          )
                                                                        : null
                                                                )}
                                                            class="w-24" />
                                                    </div>
                                                </div>

                                                <div
                                                    class="flex flex-col gap-1.5 md:col-span-2"
                                                    data-settings-search-path="library_profiles.filter_rules.content_ratings">
                                                    <Label class="text-sm font-semibold"
                                                        >Content Ratings</Label>
                                                    <div
                                                        class="border-border/60 bg-background/40 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2">
                                                        {#each profile.filter_rules?.content_ratings ?? [] as tag, i (tag)}
                                                            <span
                                                                class="border-border/70 bg-muted/50 text-foreground flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onclick={() =>
                                                                        removeTag(
                                                                            key,
                                                                            "content_ratings",
                                                                            i
                                                                        )}
                                                                    class="opacity-60 hover:opacity-100"
                                                                    ><X class="size-3" /></button>
                                                            </span>
                                                        {/each}
                                                        <input
                                                            type="text"
                                                            placeholder="G, PG, PG-13, TV-MA…"
                                                            class="placeholder:text-muted-foreground/50 min-w-[10rem] flex-1 bg-transparent text-xs outline-none"
                                                            onkeydown={(e) =>
                                                                onTagKeydown(
                                                                    e,
                                                                    key,
                                                                    "content_ratings"
                                                                )} />
                                                    </div>
                                                </div>

                                                <div
                                                    class="flex flex-col gap-1.5"
                                                    data-settings-search-path="library_profiles.filter_rules.languages">
                                                    <Label class="text-sm font-semibold"
                                                        >Languages <span
                                                            class="text-muted-foreground/70 font-normal"
                                                            >(! to exclude)</span
                                                        ></Label>
                                                    <div
                                                        class="border-border/60 bg-background/40 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2">
                                                        {#each profile.filter_rules?.languages ?? [] as tag, i (tag)}
                                                            <span
                                                                class="border-border/70 bg-muted/50 text-foreground flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onclick={() =>
                                                                        removeTag(
                                                                            key,
                                                                            "languages",
                                                                            i
                                                                        )}
                                                                    class="opacity-60 hover:opacity-100"
                                                                    ><X class="size-3" /></button>
                                                            </span>
                                                        {/each}
                                                        <input
                                                            type="text"
                                                            placeholder="en, !zh…"
                                                            class="placeholder:text-muted-foreground/50 min-w-[6rem] flex-1 bg-transparent text-xs outline-none"
                                                            onkeydown={(e) =>
                                                                onTagKeydown(
                                                                    e,
                                                                    key,
                                                                    "languages"
                                                                )} />
                                                    </div>
                                                </div>

                                                <div
                                                    class="flex flex-col gap-1.5"
                                                    data-settings-search-path="library_profiles.filter_rules.countries">
                                                    <Label class="text-sm font-semibold"
                                                        >Countries <span
                                                            class="text-muted-foreground/70 font-normal"
                                                            >(! to exclude)</span
                                                        ></Label>
                                                    <div
                                                        class="border-border/60 bg-background/40 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2">
                                                        {#each profile.filter_rules?.countries ?? [] as tag, i (tag)}
                                                            <span
                                                                class="border-border/70 bg-muted/50 text-foreground flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onclick={() =>
                                                                        removeTag(
                                                                            key,
                                                                            "countries",
                                                                            i
                                                                        )}
                                                                    class="opacity-60 hover:opacity-100"
                                                                    ><X class="size-3" /></button>
                                                            </span>
                                                        {/each}
                                                        <input
                                                            type="text"
                                                            placeholder="US, GB, !CN…"
                                                            class="placeholder:text-muted-foreground/50 min-w-[6rem] flex-1 bg-transparent text-xs outline-none"
                                                            onkeydown={(e) =>
                                                                onTagKeydown(
                                                                    e,
                                                                    key,
                                                                    "countries"
                                                                )} />
                                                    </div>
                                                </div>

                                                <div
                                                    class="flex flex-col gap-1.5 md:col-span-2"
                                                    data-settings-search-path="library_profiles.filter_rules.networks">
                                                    <Label class="text-sm font-semibold"
                                                        >Networks <span
                                                            class="text-muted-foreground/70 font-normal"
                                                            >(! to exclude)</span
                                                        ></Label>
                                                    <div
                                                        class="border-border/60 bg-background/40 flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border p-2">
                                                        {#each profile.filter_rules?.networks ?? [] as tag, i (tag)}
                                                            <span
                                                                class="border-border/70 bg-muted/50 text-foreground flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onclick={() =>
                                                                        removeTag(
                                                                            key,
                                                                            "networks",
                                                                            i
                                                                        )}
                                                                    class="opacity-60 hover:opacity-100"
                                                                    ><X class="size-3" /></button>
                                                            </span>
                                                        {/each}
                                                        <input
                                                            type="text"
                                                            placeholder="HBO, Netflix, !Fox…"
                                                            class="placeholder:text-muted-foreground/50 min-w-[8rem] flex-1 bg-transparent text-xs outline-none"
                                                            onkeydown={(e) =>
                                                                onTagKeydown(e, key, "networks")} />
                                                    </div>
                                                </div>
                                            </div>
                                        </SettingsDetailsCard>
                                    </div>
                                </div>
                            </div>

                            <div class="border-border/60 flex justify-end border-t pt-3">
                                {#if pendingDelete === key}
                                    <div class="flex items-center gap-2">
                                        <span class="text-muted-foreground text-xs"
                                            >Delete <code class="bg-muted rounded px-1">{key}</code
                                            >?</span>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onclick={() => deleteProfile(key)}>Yes, delete</Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => (pendingDelete = null)}>Cancel</Button>
                                    </div>
                                {:else}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        onclick={() => (pendingDelete = key)}>
                                        <Trash2 class="size-3.5" /> Delete profile
                                    </Button>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </SettingsPanelSurface>
            {/each}
        </div>
    {/if}
</div>

<Dialog.Root bind:open={showAddDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Add Library Profile</Dialog.Title>
            <Dialog.Description
                >Create a new profile to route media into a separate library path.</Dialog.Description>
        </Dialog.Header>
        <div class="flex flex-col gap-4 py-2">
            <div class="flex flex-col gap-1.5">
                <Label
                    >Profile Key <span class="text-muted-foreground text-xs"
                        >(slug, cannot change later)</span
                    ></Label>
                <Input
                    bind:value={newKey}
                    placeholder="anime, kids_content…"
                    class="font-mono"
                    oninput={() => (newKeyError = "")} />
                {#if newKeyError}<p class="text-destructive text-xs">{newKeyError}</p>{/if}
                <p class="text-muted-foreground text-xs">
                    Lowercase letters, numbers, underscores only.
                </p>
            </div>
            <div class="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input bind:value={newName} placeholder="Anime, Kids & Family…" />
            </div>
            <div class="flex flex-col gap-1.5">
                <Label>Library Path</Label>
                <Input bind:value={newPath} placeholder="/anime" class="font-mono" />
                <p class="text-muted-foreground text-xs">VFS path prefix. Must start with /</p>
            </div>
        </div>
        <Dialog.Footer>
            <Button variant="outline" onclick={() => (showAddDialog = false)}>Cancel</Button>
            <Button onclick={addProfile}><Plus class="size-4" /> Create profile</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
