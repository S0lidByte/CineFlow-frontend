<script lang="ts">
    import { tick, onDestroy } from "svelte";
    import type { Component } from "svelte";
    import { page } from "$app/state";
    import type { PageProps } from "./$types";
    import { fly } from "svelte/transition";
    import { resolve } from "$app/paths";
    import { cubicOut } from "svelte/easing";
    import * as Form from "$lib/components/ui/form/index.js";
    import { superForm } from "sveltekit-superforms";
    import { zod4Client } from "sveltekit-superforms/adapters";
    import { Input } from "$lib/components/ui/input/index.js";

    import ListItem from "$lib/components/list-item.svelte";
    import {
        itemsSearchSchema,
        typeOptions,
        stateOptions,
        sortOptions,
        type ItemsSearchSchema
    } from "$lib/schemas/items";
    import Trash from "@lucide/svelte/icons/trash";
    import Search from "@lucide/svelte/icons/search";
    import X from "@lucide/svelte/icons/x";
    import { Button } from "$lib/components/ui/button/index.js";
    import ListChecks from "@lucide/svelte/icons/list-checks";
    import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
    import * as Select from "$lib/components/ui/select/index.js";
    import { ItemStore } from "$lib/stores/library-items.svelte";
    import { reset_items, retry_items, remove_items, retry_library } from "./library.remote";
    import * as Pagination from "$lib/components/ui/pagination/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import Loading2Circle from "@lucide/svelte/icons/loader-2";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import { toast } from "svelte-sonner";
    import { goto, invalidate } from "$app/navigation";
    import PageShell from "$lib/components/page-shell.svelte";
    import { cn } from "$lib/utils";
    import { endPerfMark, perfCount, startPerfMark } from "$lib/perf";

    let { data }: PageProps = $props();

    // svelte-ignore state_referenced_locally
    const form = superForm(data.itemsSearchForm, {
        validators: zod4Client(itemsSearchSchema),
        resetForm: false
    });

    const { form: formData } = form;

    const itemsStore = new ItemStore();

    let actionInProgress = $state(false);
    let formElement: HTMLFormElement;

    // Live Search Logic
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let filterDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    const SEARCH_DEBOUNCE_MS = 300;
    const FILTER_DEBOUNCE_MS = 180;
    const DEFAULT_LIMIT = 24;
    const ALL_STATE = "All";
    const DEFAULT_TYPES: ItemsSearchSchema["type"] = ["movie", "show"];
    const DEFAULT_STATES: ItemsSearchSchema["states"] = [ALL_STATE];
    const DEFAULT_SORT: ItemsSearchSchema["sort"] = ["date_desc"];

    const sortLabelMap: Record<ItemsSearchSchema["sort"][number], string> = {
        date_desc: "Date ↓",
        date_asc: "Date ↑",
        title_asc: "Title A-Z",
        title_desc: "Title Z-A"
    };

    function stableUnique(values: string[]): string[] {
        return [...new Set(values)];
    }

    function normalizeTypeSelection(values: string[] | undefined): ItemsSearchSchema["type"] {
        const allowed = new Set(Object.keys(typeOptions));
        const normalized = stableUnique((values ?? []).filter((value) => allowed.has(value)));

        return normalized.length > 0
            ? (normalized as ItemsSearchSchema["type"])
            : [...DEFAULT_TYPES];
    }

    function normalizeSortSelection(values: string[] | undefined): ItemsSearchSchema["sort"] {
        const allowed = new Set(Object.keys(sortOptions));
        const normalized = stableUnique((values ?? []).filter((value) => allowed.has(value)));
        const selected = normalized[0];

        if (!selected) {
            return [...DEFAULT_SORT];
        }

        return [selected as ItemsSearchSchema["sort"][number]];
    }

    function normalizeStateSelection(
        values: string[] | undefined,
        previousValues: string[] | undefined
    ): ItemsSearchSchema["states"] {
        const allowed = new Set(Object.keys(stateOptions));
        const previous = previousValues ?? DEFAULT_STATES;
        const normalized = stableUnique((values ?? []).filter((value) => allowed.has(value)));

        if (normalized.length === 0) {
            return [...DEFAULT_STATES];
        }

        if (normalized.includes(ALL_STATE) && normalized.length > 1) {
            // All was already active and user selected specific state(s): remove All.
            if (previous.includes(ALL_STATE)) {
                return normalized.filter(
                    (value) => value !== ALL_STATE
                ) as ItemsSearchSchema["states"];
            }

            // Specific states were active and user selected All: All becomes exclusive.
            return [...DEFAULT_STATES];
        }

        return normalized as ItemsSearchSchema["states"];
    }

    function normalizeFilters() {
        const previousStates = $formData.states;
        $formData.type = normalizeTypeSelection($formData.type);
        $formData.states = normalizeStateSelection($formData.states, previousStates);
        $formData.sort = normalizeSortSelection($formData.sort);
    }

    function toDisplayLabel(value: string): string {
        if (!value) return value;
        const withSpaces = value.replace(/([A-Z])/g, " $1").trim();
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }

    function formatMultiSelectSummary(
        values: string[] | undefined,
        placeholder: string,
        defaultValues?: readonly string[]
    ): string {
        if (!values || values.length === 0 || sameStringArray(values, defaultValues)) {
            return placeholder;
        }

        return values.map((value) => toDisplayLabel(value)).join(", ");
    }

    function sameStringArray(
        a: readonly string[] | undefined,
        b: readonly string[] | undefined
    ): boolean {
        const sortedA = [...(a ?? [])].sort();
        const sortedB = [...(b ?? [])].sort();

        if (sortedA.length !== sortedB.length) {
            return false;
        }

        return sortedA.every((value, index) => value === sortedB[index]);
    }

    function buildQueryUrl(resetPage: boolean): URL {
        const url = new URL(page.url);

        if ($formData.search?.trim()) {
            url.searchParams.set("search", $formData.search.trim());
        } else {
            url.searchParams.delete("search");
        }

        url.searchParams.delete("type");
        if (!sameStringArray($formData.type, DEFAULT_TYPES)) {
            $formData.type?.forEach((value) => {
                url.searchParams.append("type", value);
            });
        }

        url.searchParams.delete("states");
        if (!sameStringArray($formData.states, DEFAULT_STATES)) {
            $formData.states?.forEach((value) => {
                url.searchParams.append("states", value);
            });
        }

        url.searchParams.delete("sort");
        if (!sameStringArray($formData.sort, DEFAULT_SORT)) {
            $formData.sort?.forEach((value) => {
                url.searchParams.append("sort", value);
            });
        }

        if (resetPage) {
            $formData.page = 1;
        }

        if (($formData.page ?? 1) > 1) {
            url.searchParams.set("page", String($formData.page));
        } else {
            url.searchParams.delete("page");
        }

        if (($formData.limit ?? DEFAULT_LIMIT) !== DEFAULT_LIMIT) {
            url.searchParams.set("limit", String($formData.limit));
        } else {
            url.searchParams.delete("limit");
        }

        return url;
    }

    function getSelectionScopeKey(): string {
        const search = ($formData.search ?? "").trim().toLowerCase();
        const type = [...($formData.type ?? DEFAULT_TYPES)].sort().join(",");
        const states = [...($formData.states ?? DEFAULT_STATES)].sort().join(",");
        const sort = [...($formData.sort ?? DEFAULT_SORT)].sort().join(",");
        const pageNumber = $formData.page ?? 1;
        const limitValue = $formData.limit ?? DEFAULT_LIMIT;

        return `${search}|${type}|${states}|${sort}|${pageNumber}|${limitValue}`;
    }

    const selectionScopeKey = $derived.by(() => getSelectionScopeKey());
    const currentSortLabel = $derived.by(() => {
        const currentSort = ($formData.sort?.[0] ??
            "date_desc") as ItemsSearchSchema["sort"][number];
        return sortLabelMap[currentSort] ?? sortLabelMap.date_desc;
    });
    const activeTypeFilters = $derived.by(() =>
        sameStringArray($formData.type, DEFAULT_TYPES) ? [] : ($formData.type ?? [])
    );
    const activeStateFilters = $derived.by(() =>
        ($formData.states ?? []).filter((value) => value !== ALL_STATE)
    );
    const hasCustomSort = $derived.by(() => !sameStringArray($formData.sort, DEFAULT_SORT));
    const hasAnyActiveFilters = $derived.by(
        () =>
            Boolean($formData.search?.trim()) ||
            activeTypeFilters.length > 0 ||
            activeStateFilters.length > 0 ||
            hasCustomSort
    );

    $effect(() => {
        itemsStore.syncScope(selectionScopeKey);
    });

    async function refreshLibraryData(action: string) {
        perfCount("library.refresh", 1, { action });
        await invalidate((url) => url.pathname === page.url.pathname);
    }

    let retryLibraryOpen = $state(false);
    let retryLibraryInProgress = $state(false);

    async function runRetryLibrary() {
        retryLibraryInProgress = true;
        const mark = startPerfMark("library.retry_library", {});
        try {
            const result = await retry_library({});
            if (result.count === 0) {
                toast.info(result.message || "No items needed a retry");
            } else {
                toast.success(result.message || `Retried ${result.count} items`);
            }
            await refreshLibraryData("retry_library");
            retryLibraryOpen = false;
        } catch (e) {
            if (e instanceof Error) toast.error(`Error: ${e.message}`);
            else toast.error("Failed to retry library items");
        } finally {
            retryLibraryInProgress = false;
            endPerfMark(mark, {});
        }
    }

    async function search(reason: "text" | "filters" | "clear" = "text") {
        normalizeFilters();

        const mark = startPerfMark("library.search.navigate", {
            reason,
            hasSearch: Boolean($formData.search),
            typeCount: $formData.type?.length ?? 0,
            stateCount: $formData.states?.length ?? 0,
            sortCount: $formData.sort?.length ?? 0
        });

        const url = buildQueryUrl(true);

        await goto(resolve((url.pathname + url.search) as unknown as "/"), {
            keepFocus: true,
            noScroll: true,
            replaceState: true,
            invalidate: [(target) => target.pathname === page.url.pathname]
        });

        endPerfMark(mark, {
            reason,
            hasSearch: Boolean($formData.search),
            typeCount: $formData.type?.length ?? 0,
            stateCount: $formData.states?.length ?? 0,
            sortCount: $formData.sort?.length ?? 0
        });
    }

    async function submitPagination() {
        normalizeFilters();
        const url = buildQueryUrl(false);

        await goto(resolve((url.pathname + url.search) as unknown as "/"), {
            keepFocus: true,
            noScroll: true,
            replaceState: true,
            invalidate: [(target) => target.pathname === page.url.pathname]
        });
    }

    function handleTypeChange(values: string[] | undefined) {
        $formData.type = normalizeTypeSelection(values);
        scheduleFilterSearch();
    }

    function handleStateChange(values: string[] | undefined) {
        const previousStates = $formData.states;
        $formData.states = normalizeStateSelection(values, previousStates);
        scheduleFilterSearch();
    }

    function handleSortChange(value: string) {
        $formData.sort = normalizeSortSelection(value ? [value] : undefined);
        scheduleFilterSearch();
    }

    async function clearAllFilters() {
        $formData.search = undefined;
        $formData.type = [...DEFAULT_TYPES];
        $formData.states = [...DEFAULT_STATES];
        $formData.sort = [...DEFAULT_SORT];
        $formData.page = 1;
        itemsStore.clear();
        itemsStore.resetScope();
        await search("clear");
    }

    async function clearSortFilter() {
        $formData.sort = [...DEFAULT_SORT];
        await search("filters");
    }

    async function removeSearchFilter() {
        $formData.search = undefined;
        await search("filters");
    }

    async function removeTypeFilter(value: ItemsSearchSchema["type"][number]) {
        const next = ($formData.type ?? []).filter((entry) => entry !== value);
        $formData.type = normalizeTypeSelection(next);
        await search("filters");
    }

    async function removeStateFilter(value: ItemsSearchSchema["states"][number]) {
        const next = ($formData.states ?? []).filter((entry) => entry !== value);
        $formData.states = normalizeStateSelection(next, $formData.states);
        await search("filters");
    }

    function scheduleFilterSearch() {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(() => {
            void search("filters");
        }, FILTER_DEBOUNCE_MS);
    }

    function handleSearchInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            void search("text");
        }, SEARCH_DEBOUNCE_MS);
    }

    onDestroy(() => {
        clearTimeout(debounceTimer);
        clearTimeout(filterDebounceTimer);
        debounceTimer = undefined;
        filterDebounceTimer = undefined;
    });
</script>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <!-- Immersive Background -->
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
        <div
            class="bg-primary/5 absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]">
        </div>
        <div
            class="absolute right-[-5%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[100px]">
        </div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-8">
        <!-- Header Section -->
        <header class="flex flex-col justify-between gap-6 pt-32 md:flex-row md:items-end md:pt-0">
            <div class="space-y-2">
                <h1
                    class="font-serif text-5xl font-medium tracking-tight text-white/90 md:text-7xl">
                    Library
                </h1>
                <div class="flex flex-wrap items-center gap-3 text-zinc-400">
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-xs tracking-widest uppercase">Index</span>
                        <span class="h-px w-8 bg-zinc-800"></span>
                        <span class="text-primary font-mono text-sm"
                            >{data.totalItems.toLocaleString()} items</span>
                    </div>
                    <AlertDialog.Root bind:open={retryLibraryOpen}>
                        <AlertDialog.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    variant="secondary"
                                    size="sm"
                                    disabled={retryLibraryInProgress}
                                    class="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                                    {#if retryLibraryInProgress}
                                        <Loading2Circle class="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    {:else}
                                        <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
                                    {/if}
                                    Retry all failed
                                </Button>
                            {/snippet}
                        </AlertDialog.Trigger>
                        <AlertDialog.Content
                            class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
                            <AlertDialog.Header>
                                <AlertDialog.Title>Retry all failed items?</AlertDialog.Title>
                                <AlertDialog.Description>
                                    This queues every failed library item for another
                                    scrape/download attempt. Selection-based Retry is unchanged.
                                </AlertDialog.Description>
                            </AlertDialog.Header>
                            <AlertDialog.Footer>
                                <AlertDialog.Cancel disabled={retryLibraryInProgress}
                                    >Cancel</AlertDialog.Cancel>
                                <AlertDialog.Action
                                    disabled={retryLibraryInProgress}
                                    onclick={runRetryLibrary}>
                                    {#if retryLibraryInProgress}
                                        <Loading2Circle class="mr-1 inline-block animate-spin" />
                                    {/if}
                                    Retry all failed
                                </AlertDialog.Action>
                            </AlertDialog.Footer>
                        </AlertDialog.Content>
                    </AlertDialog.Root>
                </div>
            </div>

            <!-- Compact Filter Bar -->
            <form
                method="GET"
                bind:this={formElement}
                class="flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-zinc-900/40 p-2 shadow-2xl backdrop-blur-md md:gap-3">
                <!-- Search Input -->
                <div class="group relative">
                    <Search
                        class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-white" />
                    <Form.Field {form} name="search" class="w-full space-y-0 md:w-64">
                        <Form.Control>
                            {#snippet children({ props })}
                                <Input
                                    {...props}
                                    bind:value={$formData.search}
                                    placeholder="Search..."
                                    oninput={handleSearchInput}
                                    class="h-10 rounded-xl border-transparent bg-transparent pl-9 transition-all placeholder:text-zinc-600 hover:bg-white/5 focus:bg-white/10" />
                            {/snippet}
                        </Form.Control>
                    </Form.Field>
                </div>

                <div class="mx-1 hidden h-6 w-px bg-white/10 md:block"></div>

                <!-- Filters -->
                <Form.Field {form} name="type" class="min-w-[100px] space-y-0">
                    <Form.Control>
                        {#snippet children({ props })}
                            <Select.Root
                                type="multiple"
                                bind:value={$formData.type}
                                onValueChange={handleTypeChange}
                                name={props.name}>
                                <Select.Trigger
                                    {...props}
                                    class="h-9 border-0 bg-transparent text-zinc-400 hover:bg-white/5 data-[state=open]:bg-white/10 data-[value]:text-white">
                                    {formatMultiSelectSummary(
                                        $formData.type,
                                        "Type",
                                        DEFAULT_TYPES
                                    )}
                                </Select.Trigger>
                                <Select.Content class="border-zinc-800 bg-zinc-900">
                                    {#each Object.keys(typeOptions) as option (option)}
                                        <Select.Item
                                            value={option}
                                            label={toDisplayLabel(option)} />
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        {/snippet}
                    </Form.Control>
                </Form.Field>

                <Form.Field {form} name="states" class="min-w-[100px] space-y-0">
                    <Form.Control>
                        {#snippet children({ props })}
                            <Select.Root
                                type="multiple"
                                bind:value={$formData.states}
                                onValueChange={handleStateChange}
                                name={props.name}>
                                <Select.Trigger
                                    {...props}
                                    class="h-9 border-0 bg-transparent text-zinc-400 hover:bg-white/5 data-[state=open]:bg-white/10 data-[value]:text-white">
                                    {formatMultiSelectSummary(
                                        $formData.states,
                                        "State",
                                        DEFAULT_STATES
                                    )}
                                </Select.Trigger>
                                <Select.Content class="border-zinc-800 bg-zinc-900">
                                    {#each Object.keys(stateOptions) as option (option)}
                                        <Select.Item
                                            value={option}
                                            label={toDisplayLabel(option)} />
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        {/snippet}
                    </Form.Control>
                </Form.Field>

                <Form.Field {form} name="sort" class="min-w-[140px] space-y-0">
                    <Form.Control>
                        {#snippet children({ props })}
                            <Select.Root
                                type="single"
                                value={$formData.sort?.[0] ?? DEFAULT_SORT[0]}
                                onValueChange={handleSortChange}
                                name={props.name}>
                                <Select.Trigger
                                    {...props}
                                    class="h-9 border-0 bg-transparent text-zinc-400 hover:bg-white/5 data-[state=open]:bg-white/10 data-[value]:text-white">
                                    <ArrowUpDown class="h-3.5 w-3.5" />
                                    <span>{currentSortLabel}</span>
                                </Select.Trigger>
                                <Select.Content class="border-zinc-800 bg-zinc-900">
                                    {#each Object.entries(sortLabelMap) as [value, label] (value)}
                                        <Select.Item {value} {label}>{label}</Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        {/snippet}
                    </Form.Control>
                </Form.Field>
                <!-- Hidden inputs for pagination -->
                <input type="hidden" name="page" value={$formData.page} />
                <input type="hidden" name="limit" value={$formData.limit} />
            </form>
        </header>

        {#if hasAnyActiveFilters}
            <div class="-mt-4 flex flex-wrap items-center gap-2">
                {#if $formData.search?.trim()}
                    <Button
                        variant="secondary"
                        size="sm"
                        onclick={removeSearchFilter}
                        class="h-8 gap-1 border border-white/10 bg-zinc-900/60 text-xs hover:bg-white/10">
                        Search: {$formData.search.trim()}
                        <X class="h-3 w-3" />
                    </Button>
                {/if}

                {#each activeTypeFilters as type (type)}
                    <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => removeTypeFilter(type as ItemsSearchSchema["type"][number])}
                        class="h-8 gap-1 border border-white/10 bg-zinc-900/60 text-xs hover:bg-white/10">
                        Type: {toDisplayLabel(type)}
                        <X class="h-3 w-3" />
                    </Button>
                {/each}

                {#each activeStateFilters as state (state)}
                    <Button
                        variant="secondary"
                        size="sm"
                        onclick={() =>
                            removeStateFilter(state as ItemsSearchSchema["states"][number])}
                        class="h-8 gap-1 border border-white/10 bg-zinc-900/60 text-xs hover:bg-white/10">
                        State: {toDisplayLabel(state)}
                        <X class="h-3 w-3" />
                    </Button>
                {/each}

                {#if hasCustomSort}
                    <Button
                        variant="secondary"
                        size="sm"
                        onclick={clearSortFilter}
                        class="h-8 gap-1 border border-white/10 bg-zinc-900/60 text-xs hover:bg-white/10">
                        Sort: {currentSortLabel}
                        <X class="h-3 w-3" />
                    </Button>
                {/if}

                <Button
                    variant="ghost"
                    size="sm"
                    onclick={clearAllFilters}
                    class="h-8 text-xs text-zinc-300 hover:bg-white/10 hover:text-white">
                    Clear all
                </Button>
            </div>
        {/if}

        <!-- Content Grid -->
        {#if data.totalItems > 0}
            <div
                class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {#each data.items as item, i (item.riven_id)}
                    <div
                        class="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-700"
                        style="animation-delay: {i * 30}ms">
                        <ListItem
                            data={item}
                            indexer={item.indexer}
                            type={item.type}
                            isSelectable
                            selectStore={itemsStore}
                            class="aspect-[2/3] w-full" />
                    </div>
                {/each}
            </div>

            <!-- Pagination -->
            <div class="flex justify-center pt-12 pb-24">
                <Pagination.Root
                    count={data.totalItems}
                    perPage={$formData.limit}
                    bind:page={$formData.page}>
                    {#snippet children({ pages, currentPage })}
                        <Pagination.Content>
                            <Pagination.Item>
                                <Pagination.PrevButton
                                    onclick={async () => {
                                        await tick();
                                        await submitPagination();
                                    }}
                                    class="border-white/10 hover:bg-white/10" />
                            </Pagination.Item>
                            {#each pages as page (page.key)}
                                {#if page.type === "ellipsis"}
                                    <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
                                {:else}
                                    <Pagination.Item>
                                        <Pagination.Link
                                            {page}
                                            isActive={currentPage === page.value}
                                            onclick={async () => {
                                                await tick();
                                                await submitPagination();
                                            }}
                                            class="data-[selected]:bg-primary data-[selected]:text-primary-foreground border-transparent hover:bg-white/10">
                                            {page.value}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                {/if}
                            {/each}
                            <Pagination.Item>
                                <Pagination.NextButton
                                    onclick={async () => {
                                        await tick();
                                        await submitPagination();
                                    }}
                                    class="border-white/10 hover:bg-white/10" />
                            </Pagination.Item>
                        </Pagination.Content>
                    {/snippet}
                </Pagination.Root>
            </div>
        {:else}
            <div
                class="flex min-h-[50vh] flex-1 flex-col items-center justify-center space-y-4 text-center">
                <div
                    class="flex h-24 w-24 items-center justify-center rounded-full border border-white/5 bg-zinc-900/50">
                    <Search class="h-10 w-10 text-zinc-600" />
                </div>
                <div>
                    <h3 class="text-xl font-medium text-white">No items found</h3>
                    <p class="mx-auto mt-2 max-w-sm text-zinc-500">
                        We couldn't find anything matching your search. Try adjusting the filters or
                        search term.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onclick={clearAllFilters}
                    class="border-white/10 hover:bg-white/5">
                    Clear all filters
                </Button>
            </div>
        {/if}

        <!-- Floating Selection Bar -->
        {#if itemsStore.count > 0}
            <div
                transition:fly={{ y: 100, duration: 400, easing: cubicOut }}
                class="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-3xl border border-white/10 bg-zinc-900/80 p-2 pl-4 shadow-2xl backdrop-blur-xl">
                <div class="mr-4 flex items-center gap-3">
                    <div
                        class="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold">
                        {itemsStore.count}
                    </div>
                    <span class="text-sm font-medium text-zinc-300">Selected</span>
                </div>

                <div class="mx-1 h-8 w-px bg-white/10"></div>

                <div class="flex items-center gap-1">
                    {#snippet actionButton(
                        label: string,
                        /** Svelte 5 component object passed as { component: SomeComponent } */
                        icon: { component: Component },
                        onClick: () => Promise<void>,
                        variant: "default" | "destructive" = "default"
                    )}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionInProgress}
                            onclick={onClick}
                            class={cn(
                                "h-9 gap-2 rounded-xl px-3 transition-all",
                                variant === "destructive"
                                    ? "hover:bg-red-500/20 hover:text-red-400"
                                    : "hover:bg-white/10"
                            )}>
                            {#if actionInProgress}
                                <Loading2Circle class="h-3.5 w-3.5 animate-spin" />
                            {:else}
                                <icon.component class="h-3.5 w-3.5" />
                            {/if}
                            {label}
                        </Button>
                    {/snippet}

                    <!-- Actions -->
                    {@render actionButton("Reset", { component: ListChecks }, async () => {
                        actionInProgress = true;
                        const mark = startPerfMark("library.bulk_action", {
                            action: "reset",
                            count: itemsStore.count
                        });
                        try {
                            await reset_items({ ids: itemsStore.items.map((id) => id.toString()) });
                            toast.success(`Reset ${itemsStore.count} items`);
                            itemsStore.clear();
                            await refreshLibraryData("reset");
                        } catch (e) {
                            if (e instanceof Error) toast.error(`Error: ${e.message}`);
                            else toast.error("An unknown error occurred");
                        } finally {
                            actionInProgress = false;
                            endPerfMark(mark, {
                                action: "reset",
                                count: itemsStore.count
                            });
                        }
                    })}

                    {@render actionButton("Retry", { component: Loading2Circle }, async () => {
                        actionInProgress = true;
                        const mark = startPerfMark("library.bulk_action", {
                            action: "retry",
                            count: itemsStore.count
                        });
                        try {
                            await retry_items({ ids: itemsStore.items.map((id) => id.toString()) });
                            toast.success(`Retrying ${itemsStore.count} items`);
                            itemsStore.clear();
                            await refreshLibraryData("retry");
                        } catch (e) {
                            if (e instanceof Error) toast.error(`Error: ${e.message}`);
                            else toast.error("An unknown error occurred");
                        } finally {
                            actionInProgress = false;
                            endPerfMark(mark, {
                                action: "retry",
                                count: itemsStore.count
                            });
                        }
                    })}

                    {@render actionButton(
                        "Remove",
                        { component: Trash },
                        async () => {
                            actionInProgress = true;
                            const mark = startPerfMark("library.bulk_action", {
                                action: "remove",
                                count: itemsStore.count
                            });
                            try {
                                await remove_items({
                                    ids: itemsStore.items.map((id) => id.toString())
                                });
                                toast.success(`Removed ${itemsStore.count} items`);
                                itemsStore.clear();
                                await refreshLibraryData("remove");
                            } catch (e) {
                                if (e instanceof Error) toast.error(`Error: ${e.message}`);
                                else toast.error("An unknown error occurred");
                            } finally {
                                actionInProgress = false;
                                endPerfMark(mark, {
                                    action: "remove",
                                    count: itemsStore.count
                                });
                            }
                        },
                        "destructive"
                    )}

                    <div class="mx-1 h-8 w-px bg-white/10"></div>

                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-9 w-9 rounded-xl hover:bg-white/10"
                        onclick={() => itemsStore.clear()}>
                        <X class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        {/if}
    </div>
</PageShell>

<style>
    .fill-mode-backwards {
        animation-fill-mode: backwards;
    }
</style>
