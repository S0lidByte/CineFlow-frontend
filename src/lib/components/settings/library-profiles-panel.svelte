<script lang="ts">
    import { enhance } from "$app/forms";
    import { browser } from "$app/environment";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import { untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import Plus from "@lucide/svelte/icons/plus";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import X from "@lucide/svelte/icons/x";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Filter from "@lucide/svelte/icons/filter";

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
        filter_rules: FilterRules;
    }

    // ─── State ───────────────────────────────────────────────────────────────
    let { profiles = {} }: { profiles?: Record<string, LibraryProfile> } = $props();
    let localProfiles = $state<Record<string, LibraryProfile>>(
        structuredClone(untrack(() => profiles))
    );
    /** Baseline used for dirty detection; updated after a successful save. */
    let baselineJson = $state(JSON.stringify(untrack(() => profiles)));

    // Track which cards are expanded
    let expanded = $state<Record<string, boolean>>({});
    let filtersOpen = $state<Record<string, boolean>>({});

    // Add-profile dialog
    let showAddDialog = $state(false);
    let newKey = $state("");
    let newName = $state("");
    let newPath = $state("/");
    let newKeyError = $state("");

    // Confirm-delete state: key pending deletion
    let pendingDelete = $state<string | null>(null);

    // Saving state
    let isSaving = $state(false);

    // Dirty tracking
    const isDirty = $derived(JSON.stringify(localProfiles) !== baselineJson);
    const saveShortcutLabel = $derived(
        browser && typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
            ? "⌘S"
            : "Ctrl+S"
    );

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

    // Tag list helpers
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

    // Tag input handler (Enter key)
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

    // ─── Add profile ─────────────────────────────────────────────────────────
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

    // ─── Save ─────────────────────────────────────────────────────────────────
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

    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (isDirty && !isSaving) {
                document.getElementById("save-form-submit")?.click();
            }
        }
    }

    // Content type options
    const CONTENT_TYPES = ["movie", "show"];
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <title>Library Profiles - Riven</title>
</svelte:head>

<div class="h-full w-full">
    <Tooltip.Provider>
        <div class="w-full">
            <!-- ── Header ─────────────────────────────────────────────────── -->
            <header
                class="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-start md:justify-between">
                <div>
                    <!-- Breadcrumbs removed since it's already in settings context -->
                    <div class="mt-1 flex flex-wrap items-center gap-2">
                        <h2 class="text-xl font-bold tracking-tight">Library Profiles</h2>
                        <Badge class="border-neutral-700 bg-neutral-800 text-xs text-neutral-400"
                            >{profileKeys().length} profiles</Badge>
                    </div>
                    <p class="text-muted-foreground mt-2 max-w-3xl text-sm md:text-[0.92rem]">
                        Organize media into separate library folders based on metadata rules. Each
                        profile filters by genre, content type, rating, and more — creating a
                        dedicated VFS path.
                    </p>
                </div>

                <div class="mt-2 flex items-center gap-2 md:mt-0">
                    {#if isDirty}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                            <AlertCircle class="size-3.5" />Unsaved changes
                        </div>
                    {:else}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                            <Check class="size-3.5" />All changes saved
                        </div>
                    {/if}

                    <Button variant="outline" size="sm" onclick={() => (showAddDialog = true)}>
                        <Plus class="size-4" /> Add Profile
                    </Button>

                    <!-- Hidden save form -->
                    <form
                        method="POST"
                        action="/library-profiles?/save"
                        use:enhance={() => {
                            isSaving = true;
                            return async ({ result }) => {
                                handleSaveResult(result);
                            };
                        }}>
                        <input
                            type="hidden"
                            name="profiles"
                            value={JSON.stringify(localProfiles)} />
                        <Tooltip.Root>
                            <Tooltip.Trigger>
                                <Button
                                    id="save-form-submit"
                                    type="submit"
                                    class="min-w-[9rem]"
                                    disabled={!isDirty || isSaving}>
                                    {#if isSaving}
                                        <Loader2 class="size-4 animate-spin" /> Saving...
                                    {:else if isDirty}
                                        <Check class="size-4" /> Save changes
                                    {:else}
                                        <Check class="size-4" /> All changes saved
                                    {/if}
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content side="bottom">
                                Save ({navigator?.platform?.includes("Mac") ? "⌘S" : "Ctrl+S"})
                            </Tooltip.Content>
                        </Tooltip.Root>
                    </form>
                </div>
            </header>

            <Separator class="mb-6 md:mb-8" />

            <!-- ── Profile cards ──────────────────────────────────────────── -->
            {#if profileKeys().length === 0}
                <div
                    class="border-border/50 bg-card/30 flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                    <BookOpen class="text-muted-foreground size-8 opacity-50" />
                    <p class="text-muted-foreground text-sm">No library profiles yet.</p>
                    <Button variant="outline" size="sm" onclick={() => (showAddDialog = true)}>
                        <Plus class="size-4" /> Add your first profile
                    </Button>
                </div>
            {:else}
                <div class="flex flex-col gap-3">
                    {#each profileKeys() as key (key)}
                        {@const profile = localProfiles[key]}
                        {@const isExpanded = expanded[key] ?? false}
                        {@const filtersVisible = filtersOpen[key] ?? false}
                        {@const hasFilters = Object.values(profile.filter_rules ?? {}).some(
                            (v) =>
                                v !== null &&
                                v !== undefined &&
                                (Array.isArray(v) ? v.length > 0 : true)
                        )}

                        <div
                            class="border-border/70 bg-card/35 rounded-xl border transition-shadow hover:shadow-md">
                            <!-- Card header row -->
                            <button
                                type="button"
                                class="flex w-full items-center gap-3 px-4 py-4 text-left"
                                onclick={() => (expanded[key] = !isExpanded)}>
                                <!-- Enabled indicator -->
                                <span
                                    class="size-2 shrink-0 rounded-full {profile.enabled
                                        ? 'bg-emerald-500'
                                        : 'bg-neutral-600'}"
                                    title={profile.enabled ? "Enabled" : "Disabled"}></span>

                                <div class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="font-semibold text-neutral-100"
                                            >{profile.name}</span>
                                        <code
                                            class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400"
                                            >{key}</code>
                                        <Badge
                                            variant="outline"
                                            class="border-neutral-700 px-1.5 py-0 font-mono text-[10px] text-neutral-400">
                                            {profile.library_path}
                                        </Badge>
                                        {#if hasFilters}
                                            <span
                                                class="flex items-center gap-1 text-[10px] text-neutral-500">
                                                <Filter class="size-3" /> Filters active
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <ChevronDown
                                    class="size-4 shrink-0 text-neutral-500 transition-transform {isExpanded
                                        ? 'rotate-180'
                                        : ''}" />
                            </button>

                            <!-- Expanded body -->
                            {#if isExpanded}
                                <div class="border-border/40 border-t px-4 pt-4 pb-4">
                                    <div class="grid gap-5 md:grid-cols-2">
                                        <!-- Enabled toggle -->
                                        <div
                                            class="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 md:col-span-2">
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

                                        <!-- Name -->
                                        <div class="flex flex-col gap-1.5">
                                            <Label
                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                >Name</Label>
                                            <Input
                                                value={profile.name}
                                                oninput={(e) =>
                                                    setField(key, "name", e.currentTarget.value)}
                                                placeholder="Human-readable profile name"
                                                class="bg-neutral-900/50" />
                                        </div>

                                        <!-- Library path -->
                                        <div class="flex flex-col gap-1.5">
                                            <Label
                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                >Library Path</Label>
                                            <Input
                                                value={profile.library_path}
                                                oninput={(e) =>
                                                    setField(
                                                        key,
                                                        "library_path",
                                                        e.currentTarget.value
                                                    )}
                                                placeholder="/anime"
                                                class="bg-neutral-900/50 font-mono" />
                                            <span class="text-muted-foreground text-[11px]"
                                                >VFS path prefix (e.g. <code
                                                    class="rounded bg-neutral-800 px-1">/anime</code
                                                >,
                                                <code class="rounded bg-neutral-800 px-1"
                                                    >/kids</code
                                                >)</span>
                                        </div>

                                        <!-- Content types -->
                                        <div class="flex flex-col gap-2">
                                            <Label
                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                >Content Types</Label>
                                            <div class="flex gap-3">
                                                {#each CONTENT_TYPES as ct (ct)}
                                                    {@const active = (
                                                        profile.filter_rules?.content_types ?? []
                                                    ).includes(ct)}
                                                    <button
                                                        type="button"
                                                        onclick={() => {
                                                            const cur =
                                                                profile.filter_rules
                                                                    ?.content_types ?? [];
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
                                                            : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-500'}">
                                                        {ct}
                                                    </button>
                                                {/each}
                                                <span
                                                    class="text-muted-foreground self-center text-[11px]"
                                                    >None = all types</span>
                                            </div>
                                        </div>

                                        <!-- Anime -->
                                        <div
                                            class="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
                                            <div>
                                                <Label class="text-sm font-medium"
                                                    >Anime only</Label>
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

                                        <!-- Genres -->
                                        <div class="flex flex-col gap-1.5 md:col-span-2">
                                            <Label
                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                >Genres <span
                                                    class="font-normal text-neutral-600 normal-case"
                                                    >(prefix with ! to exclude)</span
                                                ></Label>
                                            <div
                                                class="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                                                {#each profile.filter_rules?.genres ?? [] as tag, i (tag)}
                                                    <span
                                                        class="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium {tag.startsWith(
                                                            '!'
                                                        )
                                                            ? 'border border-red-800/50 bg-red-900/40 text-red-400'
                                                            : 'border border-neutral-700 bg-neutral-800 text-neutral-300'}">
                                                        {tag}
                                                        <button
                                                            type="button"
                                                            onclick={() =>
                                                                removeTag(key, "genres", i)}
                                                            class="opacity-60 hover:opacity-100">
                                                            <X class="size-3" />
                                                        </button>
                                                    </span>
                                                {/each}
                                                <input
                                                    type="text"
                                                    placeholder="Add genre…"
                                                    class="min-w-[8rem] flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600"
                                                    onkeydown={(e) =>
                                                        onTagKeydown(e, key, "genres")} />
                                            </div>
                                        </div>

                                        <!-- Advanced filters toggle -->
                                        <div class="md:col-span-2">
                                            <Collapsible.Root
                                                open={filtersVisible}
                                                onOpenChange={(v) => (filtersOpen[key] = v)}>
                                                <Collapsible.Trigger
                                                    class="flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
                                                    <ChevronRight
                                                        class="size-3.5 transition-transform {filtersVisible
                                                            ? 'rotate-90'
                                                            : ''}" />
                                                    Advanced filters (ratings, year, networks, languages…)
                                                </Collapsible.Trigger>
                                                <Collapsible.Content>
                                                    <div class="mt-3 grid gap-4 md:grid-cols-2">
                                                        <!-- Year range -->
                                                        <div class="flex flex-col gap-1.5">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Year Range</Label>
                                                            <div class="flex items-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="From"
                                                                    value={profile.filter_rules
                                                                        ?.min_year ?? ""}
                                                                    oninput={(e) =>
                                                                        setFilter(
                                                                            key,
                                                                            "min_year",
                                                                            e.currentTarget.value
                                                                                ? Number(
                                                                                      e
                                                                                          .currentTarget
                                                                                          .value
                                                                                  )
                                                                                : null
                                                                        )}
                                                                    class="w-24 bg-neutral-900/50" />
                                                                <span
                                                                    class="text-xs text-neutral-500"
                                                                    >–</span>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="To"
                                                                    value={profile.filter_rules
                                                                        ?.max_year ?? ""}
                                                                    oninput={(e) =>
                                                                        setFilter(
                                                                            key,
                                                                            "max_year",
                                                                            e.currentTarget.value
                                                                                ? Number(
                                                                                      e
                                                                                          .currentTarget
                                                                                          .value
                                                                                  )
                                                                                : null
                                                                        )}
                                                                    class="w-24 bg-neutral-900/50" />
                                                            </div>
                                                        </div>

                                                        <!-- Rating range -->
                                                        <div class="flex flex-col gap-1.5">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Rating Range <span
                                                                    class="font-normal text-neutral-600 normal-case"
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
                                                                                      e
                                                                                          .currentTarget
                                                                                          .value
                                                                                  )
                                                                                : null
                                                                        )}
                                                                    class="w-24 bg-neutral-900/50" />
                                                                <span
                                                                    class="text-xs text-neutral-500"
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
                                                                                      e
                                                                                          .currentTarget
                                                                                          .value
                                                                                  )
                                                                                : null
                                                                        )}
                                                                    class="w-24 bg-neutral-900/50" />
                                                            </div>
                                                        </div>

                                                        <!-- Content ratings (G, PG, etc.) -->
                                                        <div
                                                            class="flex flex-col gap-1.5 md:col-span-2">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Content Ratings</Label>
                                                            <div
                                                                class="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                                                                {#each profile.filter_rules?.content_ratings ?? [] as tag, i (tag)}
                                                                    <span
                                                                        class="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300">
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
                                                                            ><X
                                                                                class="size-3" /></button>
                                                                    </span>
                                                                {/each}
                                                                <input
                                                                    type="text"
                                                                    placeholder="G, PG, PG-13, TV-MA…"
                                                                    class="min-w-[10rem] flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600"
                                                                    onkeydown={(e) =>
                                                                        onTagKeydown(
                                                                            e,
                                                                            key,
                                                                            "content_ratings"
                                                                        )} />
                                                            </div>
                                                        </div>

                                                        <!-- Languages -->
                                                        <div class="flex flex-col gap-1.5">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Languages <span
                                                                    class="font-normal text-neutral-600 normal-case"
                                                                    >(! to exclude)</span
                                                                ></Label>
                                                            <div
                                                                class="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                                                                {#each profile.filter_rules?.languages ?? [] as tag, i (tag)}
                                                                    <span
                                                                        class="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300">
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
                                                                            ><X
                                                                                class="size-3" /></button>
                                                                    </span>
                                                                {/each}
                                                                <input
                                                                    type="text"
                                                                    placeholder="en, !zh…"
                                                                    class="min-w-[6rem] flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600"
                                                                    onkeydown={(e) =>
                                                                        onTagKeydown(
                                                                            e,
                                                                            key,
                                                                            "languages"
                                                                        )} />
                                                            </div>
                                                        </div>

                                                        <!-- Countries -->
                                                        <div class="flex flex-col gap-1.5">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Countries <span
                                                                    class="font-normal text-neutral-600 normal-case"
                                                                    >(! to exclude)</span
                                                                ></Label>
                                                            <div
                                                                class="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                                                                {#each profile.filter_rules?.countries ?? [] as tag, i (tag)}
                                                                    <span
                                                                        class="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300">
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
                                                                            ><X
                                                                                class="size-3" /></button>
                                                                    </span>
                                                                {/each}
                                                                <input
                                                                    type="text"
                                                                    placeholder="US, GB, !CN…"
                                                                    class="min-w-[6rem] flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600"
                                                                    onkeydown={(e) =>
                                                                        onTagKeydown(
                                                                            e,
                                                                            key,
                                                                            "countries"
                                                                        )} />
                                                            </div>
                                                        </div>

                                                        <!-- Networks -->
                                                        <div
                                                            class="flex flex-col gap-1.5 md:col-span-2">
                                                            <Label
                                                                class="text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                                                                >Networks <span
                                                                    class="font-normal text-neutral-600 normal-case"
                                                                    >(! to exclude)</span
                                                                ></Label>
                                                            <div
                                                                class="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2">
                                                                {#each profile.filter_rules?.networks ?? [] as tag, i (tag)}
                                                                    <span
                                                                        class="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300">
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
                                                                            ><X
                                                                                class="size-3" /></button>
                                                                    </span>
                                                                {/each}
                                                                <input
                                                                    type="text"
                                                                    placeholder="HBO, Netflix, !Fox…"
                                                                    class="min-w-[8rem] flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600"
                                                                    onkeydown={(e) =>
                                                                        onTagKeydown(
                                                                            e,
                                                                            key,
                                                                            "networks"
                                                                        )} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Collapsible.Content>
                                            </Collapsible.Root>
                                        </div>
                                    </div>

                                    <!-- Delete -->
                                    <div
                                        class="mt-4 flex justify-end border-t border-neutral-800 pt-4">
                                        {#if pendingDelete === key}
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs text-neutral-400"
                                                    >Delete <code
                                                        class="rounded bg-neutral-800 px-1"
                                                        >{key}</code
                                                    >?</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onclick={() => deleteProfile(key)}
                                                    >Yes, delete</Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => (pendingDelete = null)}
                                                    >Cancel</Button>
                                            </div>
                                        {:else}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="text-neutral-500 hover:bg-red-400/10 hover:text-red-400"
                                                onclick={() => (pendingDelete = key)}>
                                                <Trash2 class="size-3.5" /> Delete profile
                                            </Button>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- ── Sticky save bar ──────────────────────────────────────── -->
            {#if isDirty}
                <div
                    class="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-4 border-t px-4 py-3 shadow-lg backdrop-blur md:right-4 md:bottom-4 md:left-auto md:max-w-sm md:rounded-lg md:border md:shadow-xl"
                    role="status"
                    aria-live="polite">
                    <div class="min-w-0">
                        <span class="text-sm font-medium text-amber-500">Unsaved changes</span>
                        <p class="text-muted-foreground truncate text-xs">
                            Save to persist your profiles.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onclick={() => document.getElementById("save-form-submit")?.click()}
                        disabled={isSaving}>
                        {#if isSaving}<Loader2 class="size-4 animate-spin" /> Saving...{:else}Save ({saveShortcutLabel}){/if}
                    </Button>
                </div>
            {/if}
        </div>
    </Tooltip.Provider>
</div>

<!-- ── Add Profile Dialog ─────────────────────────────────────────────────── -->
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
                    >Profile Key <span class="text-xs text-neutral-500"
                        >(slug, cannot change later)</span
                    ></Label>
                <Input
                    bind:value={newKey}
                    placeholder="anime, kids_content…"
                    class="font-mono"
                    oninput={() => (newKeyError = "")} />
                {#if newKeyError}<p class="text-xs text-red-400">{newKeyError}</p>{/if}
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
