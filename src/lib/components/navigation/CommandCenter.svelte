<script lang="ts">
    /**
     * CineFlow Universal Cmd+K Command Center (VIS-003)
     * High-speed ambient command palette unifying navigation, local library search,
     * external TMDB discovery, operational diagnostics, and keyboard navigation.
     */
    import { onMount, type Component } from "svelte";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import { cn } from "$lib/utils.js";
    import * as Command from "$lib/components/ui/command/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as Kbd from "$lib/components/ui/kbd/index.js";
    import { commandCenterStore } from "$lib/stores/command-center.svelte";

    // Domain logic and types
    import {
        getStaticNavigationItems,
        getDiagnosticActions,
        filterActions,
        searchLibraryItems,
        searchTmdbCatalog,
        formatItemDetails,
        formatTmdbDetails,
        resolveItemHref,
        type CommandCategory,
        type CommandActionItem,
        type CommandLibraryItem,
        type CommandTmdbItem
    } from "./command-center";

    // Lucide Icons
    import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
    import Compass from "@lucide/svelte/icons/compass";
    import Film from "@lucide/svelte/icons/film";
    import Tv from "@lucide/svelte/icons/tv";
    import Activity from "@lucide/svelte/icons/activity";
    import Flame from "@lucide/svelte/icons/flame";
    import Settings from "@lucide/svelte/icons/settings";
    import Terminal from "@lucide/svelte/icons/terminal";
    import CircleAlert from "@lucide/svelte/icons/circle-alert";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Clock from "@lucide/svelte/icons/clock";
    import Radio from "@lucide/svelte/icons/radio";
    import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
    import Search from "@lucide/svelte/icons/search";
    import DownloadCloud from "@lucide/svelte/icons/cloud-download";
    import FolderTree from "@lucide/svelte/icons/folder-tree";
    import Clapperboard from "@lucide/svelte/icons/clapperboard";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import Sparkles from "@lucide/svelte/icons/sparkles";

    const ICON_COMPONENT_MAP: Record<string, Component> = {
        LayoutDashboard,
        Compass,
        Film,
        Tv,
        Activity,
        Flame,
        Settings,
        Terminal,
        AlertCircle: CircleAlert,
        CircleAlert,
        RefreshCw,
        Clock,
        Radio,
        SlidersHorizontal,
        Search,
        DownloadCloud,
        FolderTree,
        Clapperboard,
        Sparkles
    };

    const CATEGORIES: { id: CommandCategory | "all"; label: string }[] = [
        { id: "all", label: "All" },
        { id: "navigation", label: "Pages" },
        { id: "library", label: "Library" },
        { id: "tmdb", label: "Discover" },
        { id: "diagnostics", label: "Diagnostics" }
    ];

    // Reactive State
    let searchQuery = $state("");
    let activeCategory = $state<CommandCategory | "all">("all");
    let isLoading = $state(false);

    let libraryResults = $state<CommandLibraryItem[]>([]);
    let tmdbResults = $state<CommandTmdbItem[]>([]);

    const staticNavItems = getStaticNavigationItems();
    const diagActionItems = getDiagnosticActions();

    // Filtered static items
    const filteredNav = $derived(filterActions(staticNavItems, searchQuery));
    const filteredDiag = $derived(filterActions(diagActionItems, searchQuery));

    // Visibilities by category
    const showNav = $derived(
        (activeCategory === "all" || activeCategory === "navigation") && filteredNav.length > 0
    );
    const showDiag = $derived(
        (activeCategory === "all" || activeCategory === "diagnostics") && filteredDiag.length > 0
    );
    const showLibrary = $derived(
        (activeCategory === "all" || activeCategory === "library") && libraryResults.length > 0
    );
    const showTmdb = $derived(
        (activeCategory === "all" || activeCategory === "tmdb") && tmdbResults.length > 0
    );

    const hasAnyResults = $derived(showNav || showDiag || showLibrary || showTmdb);

    // Abort controller for debounced searches
    let searchAbortController: AbortController | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Reactively trigger remote search when query or category changes
    $effect(() => {
        const query = searchQuery.trim();
        const category = activeCategory;

        if (debounceTimer) clearTimeout(debounceTimer);
        if (searchAbortController) {
            searchAbortController.abort();
            searchAbortController = null;
        }

        if (query.length < 2 || category === "navigation" || category === "diagnostics") {
            libraryResults = [];
            tmdbResults = [];
            isLoading = false;
            return;
        }

        isLoading = true;
        debounceTimer = setTimeout(async () => {
            const controller = new AbortController();
            searchAbortController = controller;

            try {
                const searchLib = category === "all" || category === "library";
                const searchCat = category === "all" || category === "tmdb";

                const [libRes, catRes] = await Promise.all([
                    searchLib ? searchLibraryItems(query, controller.signal) : Promise.resolve([]),
                    searchCat ? searchTmdbCatalog(query, controller.signal) : Promise.resolve([])
                ]);

                if (!controller.signal.aborted) {
                    libraryResults = libRes;
                    tmdbResults = catRes;
                    isLoading = false;
                }
            } catch (err: unknown) {
                if ((err as Error)?.name !== "AbortError") {
                    isLoading = false;
                }
            }
        }, 220);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (searchAbortController) searchAbortController.abort();
        };
    });

    // Reset query and category when opening/closing
    $effect(() => {
        if (!commandCenterStore.isOpen) {
            searchQuery = "";
            activeCategory = "all";
            libraryResults = [];
            tmdbResults = [];
            isLoading = false;
        }
    });

    function handleNavigate(url: string) {
        commandCenterStore.close();
        void goto(resolve(url as "/"));
    }

    function handleActionSelect(action: CommandActionItem) {
        if (action.href) {
            handleNavigate(action.href);
        }
    }

    function handleLibrarySelect(item: CommandLibraryItem) {
        const href = resolveItemHref(item);
        handleNavigate(href);
    }

    function handleTmdbSelect(item: CommandTmdbItem) {
        const href = resolveItemHref(item);
        handleNavigate(href);
    }

    function cycleCategory(forward = true) {
        const currentIndex = CATEGORIES.findIndex((c) => c.id === activeCategory);
        let nextIndex: number;
        if (forward) {
            nextIndex = (currentIndex + 1) % CATEGORIES.length;
        } else {
            nextIndex = (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length;
        }
        activeCategory = CATEGORIES[nextIndex].id;
    }

    function onKeydown(e: KeyboardEvent) {
        // Global toggle: Cmd+K or Ctrl+K (unless on /settings which has its own palette)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            if (page.url.pathname.startsWith("/settings")) return;
            e.preventDefault();
            commandCenterStore.toggle();
            return;
        }

        // Tab cycling when open
        if (commandCenterStore.isOpen && e.key === "Tab") {
            e.preventDefault();
            cycleCategory(!e.shiftKey);
        }
    }

    onMount(() => {
        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    });
</script>

<Command.Dialog
    bind:open={commandCenterStore.isOpen}
    title="Universal Command Center"
    description="Search navigation, media library, TMDB catalog, and outbox diagnostics"
    shouldFilter={false}
    class="overflow-hidden border border-white/10 bg-zinc-950/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-2xl">
    <!-- Header Input with Search & Loading Spinner -->
    <div class="relative border-b border-white/10">
        <Command.Input
            placeholder="Search pages, library items, discover catalog, or outbox actions…"
            bind:value={searchQuery}
            class="h-13 text-base text-zinc-100 placeholder:text-zinc-500" />
        {#if isLoading}
            <div class="pointer-events-none absolute top-3.5 right-4 text-white/50">
                <LoaderCircle class="size-5 animate-spin text-white/70" />
            </div>
        {/if}
    </div>

    <!-- Category Filter Tabs -->
    <div
        class="flex scrollbar-none items-center gap-1.5 overflow-x-auto border-b border-white/5 px-3 py-2">
        {#each CATEGORIES as cat (cat.id)}
            <button
                type="button"
                onclick={() => (activeCategory = cat.id)}
                class={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    activeCategory === cat.id
                        ? "bg-white/15 text-white shadow-xs ring-1 ring-white/20"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}>
                <span>{cat.label}</span>
                {#if cat.id === "navigation" && filteredNav.length > 0}
                    <span class="py-0.2 rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300">
                        {filteredNav.length}
                    </span>
                {:else if cat.id === "library" && libraryResults.length > 0}
                    <span class="py-0.2 rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300">
                        {libraryResults.length}
                    </span>
                {:else if cat.id === "tmdb" && tmdbResults.length > 0}
                    <span class="py-0.2 rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300">
                        {tmdbResults.length}
                    </span>
                {:else if cat.id === "diagnostics" && filteredDiag.length > 0}
                    <span class="py-0.2 rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-300">
                        {filteredDiag.length}
                    </span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- Results List -->
    <Command.List class="max-h-[60vh] overflow-y-auto px-2 py-2">
        {#if !hasAnyResults && !isLoading}
            <Command.Empty class="py-10 text-center text-sm text-zinc-400">
                <p class="font-medium text-zinc-300">No matching items found</p>
                <p class="mt-1 text-xs text-zinc-500">
                    Try refining your search query or switching categories.
                </p>
            </Command.Empty>
        {/if}

        <!-- 1. Navigation Pages -->
        {#if showNav}
            <Command.Group heading="Pages & Navigation" class="text-xs font-semibold text-zinc-400">
                {#each filteredNav as item (item.id)}
                    {@const IconComp = ICON_COMPONENT_MAP[item.icon] || Compass}
                    <Command.Item
                        value={item.id}
                        onSelect={() => handleActionSelect(item)}
                        class="group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition-colors aria-selected:bg-white/10 aria-selected:text-white">
                        <div class="flex min-w-0 items-center gap-3">
                            <div
                                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 group-aria-selected:bg-white/15">
                                <IconComp
                                    class="size-4 text-zinc-300 group-aria-selected:text-white" />
                            </div>
                            <div class="flex min-w-0 flex-col">
                                <div class="flex items-center gap-2">
                                    <span class="truncate font-medium">{item.title}</span>
                                    {#if item.badge}
                                        <Badge
                                            variant={item.badge.variant ?? "secondary"}
                                            class="px-1.5 py-0 text-[10px]">
                                            {item.badge.text}
                                        </Badge>
                                    {/if}
                                </div>
                                {#if item.description}
                                    <span class="truncate text-xs text-zinc-400">
                                        {item.description}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        {#if item.shortcut}
                            <div class="flex shrink-0 items-center gap-1">
                                {#each item.shortcut.split(" ") as key, idx (`${item.id}-shortcut-${idx}`)}
                                    <Kbd.Root
                                        class="border-white/10 bg-white/5 text-[10px] text-zinc-300">
                                        {key}
                                    </Kbd.Root>
                                {/each}
                            </div>
                        {/if}
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}

        <!-- 2. Local Library Media -->
        {#if showLibrary}
            <Command.Group heading="Media Library" class="text-xs font-semibold text-zinc-400">
                {#each libraryResults as item (item.id)}
                    <Command.Item
                        value={`library-${item.id}`}
                        onSelect={() => handleLibrarySelect(item)}
                        class="group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition-colors aria-selected:bg-white/10 aria-selected:text-white">
                        <div class="flex min-w-0 items-center gap-3">
                            {#if item.poster_path}
                                <img
                                    src={item.poster_path}
                                    alt={item.title}
                                    class="size-8 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                                    loading="lazy" />
                            {:else}
                                <div
                                    class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 group-aria-selected:bg-white/15">
                                    <Clapperboard
                                        class="size-4 text-zinc-300 group-aria-selected:text-white" />
                                </div>
                            {/if}
                            <div class="flex min-w-0 flex-col">
                                <span class="truncate font-medium">{item.title}</span>
                                <span class="truncate text-xs text-zinc-400">
                                    {formatItemDetails(item)}
                                </span>
                            </div>
                        </div>

                        {#if item.badge}
                            <Badge
                                variant={item.badge.variant}
                                class="shrink-0 px-1.5 py-0 text-[10px] capitalize">
                                {item.badge.text}
                            </Badge>
                        {/if}
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}

        <!-- 3. Discover Catalog (TMDB) -->
        {#if showTmdb}
            <Command.Group heading="Discover Media" class="text-xs font-semibold text-zinc-400">
                {#each tmdbResults as item (item.id)}
                    <Command.Item
                        value={`tmdb-${item.id}`}
                        onSelect={() => handleTmdbSelect(item)}
                        class="group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition-colors aria-selected:bg-white/10 aria-selected:text-white">
                        <div class="flex min-w-0 items-center gap-3">
                            {#if item.poster_path}
                                <img
                                    src={item.poster_path}
                                    alt={item.title}
                                    class="size-8 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                                    loading="lazy" />
                            {:else}
                                <div
                                    class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 group-aria-selected:bg-white/15">
                                    <Film
                                        class="size-4 text-zinc-300 group-aria-selected:text-white" />
                                </div>
                            {/if}
                            <div class="flex min-w-0 flex-col">
                                <span class="truncate font-medium">{item.title}</span>
                                <span class="truncate text-xs text-zinc-400">
                                    {formatTmdbDetails(item)}
                                </span>
                            </div>
                        </div>

                        <Badge
                            variant="outline"
                            class="shrink-0 border-white/10 bg-white/5 px-1.5 py-0 text-[10px] text-zinc-300">
                            Discover
                        </Badge>
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}

        <!-- 4. Diagnostics & Outbox Actions -->
        {#if showDiag}
            <Command.Group
                heading="Diagnostics & Outbox"
                class="text-xs font-semibold text-zinc-400">
                {#each filteredDiag as item (item.id)}
                    {@const IconComp = ICON_COMPONENT_MAP[item.icon] || CircleAlert}
                    <Command.Item
                        value={item.id}
                        onSelect={() => handleActionSelect(item)}
                        class="group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition-colors aria-selected:bg-white/10 aria-selected:text-white">
                        <div class="flex min-w-0 items-center gap-3">
                            <div
                                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 group-aria-selected:bg-white/15">
                                <IconComp
                                    class="size-4 text-zinc-300 group-aria-selected:text-white" />
                            </div>
                            <div class="flex min-w-0 flex-col">
                                <div class="flex items-center gap-2">
                                    <span class="truncate font-medium">{item.title}</span>
                                    {#if item.badge}
                                        <Badge
                                            variant={item.badge.variant ?? "secondary"}
                                            class="px-1.5 py-0 text-[10px]">
                                            {item.badge.text}
                                        </Badge>
                                    {/if}
                                </div>
                                {#if item.description}
                                    <span class="truncate text-xs text-zinc-400">
                                        {item.description}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <span
                            class="text-xs text-zinc-500 opacity-0 transition-opacity group-aria-selected:opacity-100">
                            Jump &rarr;
                        </span>
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}
    </Command.List>

    <!-- Footer Bar with Shortcut Hints -->
    <div
        class="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] text-zinc-400">
        <div class="flex items-center gap-3">
            <span class="flex items-center gap-1">
                <Kbd.Root class="border-white/10 bg-white/5 px-1 py-0.5 text-[9px] text-zinc-300"
                    >↑↓</Kbd.Root>
                <span>Navigate</span>
            </span>
            <span class="flex items-center gap-1">
                <Kbd.Root class="border-white/10 bg-white/5 px-1 py-0.5 text-[9px] text-zinc-300"
                    >↵</Kbd.Root>
                <span>Select</span>
            </span>
            <span class="flex items-center gap-1">
                <Kbd.Root class="border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-300"
                    >Tab</Kbd.Root>
                <span>Filter</span>
            </span>
        </div>

        <div class="flex items-center gap-1.5 text-zinc-500">
            <span>Universal Command</span>
            <Kbd.Root class="border-white/10 bg-white/5 px-1 py-0.5 text-[9px] text-zinc-400"
                >ESC</Kbd.Root>
        </div>
    </div>
</Command.Dialog>
