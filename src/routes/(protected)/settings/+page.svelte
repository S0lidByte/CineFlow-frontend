<script lang="ts">
    /**
     * Settings page shell.
     *
     * Responsibilities:
     * - Tab navigation with per-section icons and descriptions
     * - Breadcrumb (Admin › Settings › Section)
     * - Header save-status indicator and primary Save button
     * - Sticky save bar with Ctrl/Cmd+S keyboard shortcut
     * - Unsaved-changes guard when switching tabs (alert dialog)
     * - Loading overlay while navigating between sections
     *
     * The form itself is rendered by {@link SettingsFormContent} which is keyed
     * by `activeTabId` so it fully remounts (and refetches) on tab change.
     */
    import type { Component } from "svelte";
    import type { FormState } from "@sjsf/form";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle
    } from "$lib/components/ui/alert-dialog/index.js";
    import SettingsFormContent from "$lib/components/settings/settings-form-content.svelte";
    import SettingsTabGuide from "$lib/components/settings/settings-tab-guide.svelte";
    import LibraryProfilesPanel from "$lib/components/settings/library-profiles-panel.svelte";
    import { cn } from "$lib/utils";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { navigating, page } from "$app/stores";
    import { writable } from "svelte/store";
    import { ICON_MAP } from "$lib/components/settings/icon-map";
    import { SECTION_GROUPS, getTabsByGroup, LIBRARY_PROFILES_TAB_ID, type SectionGroup } from "$lib/components/settings/sections";
    import SettingsSearch from "$lib/components/settings/settings-search.svelte";
    import Kbd from "$lib/components/ui/kbd/kbd.svelte";
    import SearchIcon from "@lucide/svelte/icons/search";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { highlightAndScrollToField } from "$lib/components/settings/settings-field-index";
    import { onMount, tick } from "svelte";
    import { SvelteURLSearchParams } from "svelte/reactivity";

    // Lucide icons used in the tab nav and header
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Info from "@lucide/svelte/icons/info";

    /** Maps the icon name stored in {@link SectionTab.icon} to a Svelte component. */
    // Imported ICON_MAP from $lib/components/settings/icon-map

    /**
     * Shared store for the active form state.
     * Written by {@link SettingsFormContent} via `formStore.set` so the page shell
     * can query `form.isChanged` and call `form.reset()` without prop drilling.
     */
    const formStore = writable<FormState<unknown> | null>(null);
    const form = $derived($formStore);

    /** Target tab id while a discard-and-switch is being confirmed. */
    let tabSwitchTarget: string | null = null;
    let tabSwitchFocus: string | null = null;
    let showDiscardConfirm = $state(false);
    let pendingFocusPath = $state<string | null>(null);
    let rankingDenyHelpOpen = $state(false);

    /**
     * Tracks which sidebar groups are expanded.
     * Persisted to sessionStorage so the sidebar state survives tab navigation
     * but resets between browser sessions.
     */
    const SESSION_KEY = "settings-sidebar-groups";
    function loadGroupState(): Record<SectionGroup, boolean> {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) return JSON.parse(raw) as Record<SectionGroup, boolean>;
        } catch { /* ignore */ }
        // Read active tab from URL (always available at init; $page.data may not be resolved yet)
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const activeTabId = params.get("tab") ?? "general";
        const activeGroup = $page.data.tabs?.find(
            (t: { id: string; group?: string }) => t.id === activeTabId
        )?.group as SectionGroup | undefined ?? "core";
        return {
            core: activeGroup === "core",
            "media-stack": activeGroup === "media-stack",
            acquisition: activeGroup === "acquisition",
            tuning: activeGroup === "tuning"
        };
    }
    let groupOpen = $state<Record<SectionGroup, boolean>>(loadGroupState());

    function toggleGroup(group: SectionGroup): void {
        groupOpen = { ...groupOpen, [group]: !groupOpen[group] };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(groupOpen)); } catch { /* ignore */ }
    }

    /** Ensure the group containing the newly active tab is always visible. */
    $effect(() => {
        const activeGroup = $page.data.tabs?.find(
            (t: { id: string; group?: string }) => t.id === $page.data.activeTabId
        )?.group as SectionGroup | undefined;
        if (activeGroup && !groupOpen[activeGroup]) {
            groupOpen = { ...groupOpen, [activeGroup]: true };
            try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(groupOpen)); } catch { /* ignore */ }
        }
    });

    /** Programmatically submits the SJSF-managed `<form>` inside `.settings-form-host`. */
    function submitSettingsForm(): void {
        if ($navigating) return;
        const formEl =
            document.querySelector<HTMLFormElement>("form.settings-form") ??
            document.querySelector<HTMLFormElement>(".settings-form-host form") ??
            document.querySelector<HTMLFormElement>(".settings-form form") ??
            document.querySelector<HTMLFormElement>("form[action]");
        if (formEl) {
            formEl.requestSubmit();
        }
    }

    /**
     * Handles a tab button click or search selection.
     * If the form has unsaved changes, opens a confirmation dialog instead of
     * navigating immediately.
     */
    function handleTabClick(tabId: string, focusPath?: string): void {
        const sameTab = tabId === $page.data.activeTabId;
        if (sameTab) {
            if (focusPath) {
                pendingFocusPath = focusPath;
                const url = new URL($page.url);
                url.searchParams.set("focus", focusPath);
                history.replaceState({}, "", url);
                void tryFocusField(focusPath);
            }
            return;
        }

        if (form?.isChanged) {
            tabSwitchTarget = tabId;
            tabSwitchFocus = focusPath ?? null;
            showDiscardConfirm = true;
            return;
        }

        navigateToTab(tabId, focusPath);
    }

    function navigateToTab(tabId: string, focusPath?: string): void {
        formStore.set(null);
        const params = new SvelteURLSearchParams();
        params.set("tab", tabId);
        if (focusPath) {
            params.set("focus", focusPath);
            pendingFocusPath = focusPath;
        } else {
            pendingFocusPath = null;
        }
        goto(resolve(`/settings?${params.toString()}`));
    }

    /** Confirms the discard-and-switch dialog: navigates first, then resets the form.
     * Resetting after navigation (not before) ensures form data is not wiped if goto() throws.
     */
    function confirmDiscardAndSwitch(): void {
        if (tabSwitchTarget) {
            const target = tabSwitchTarget;
            const focus = tabSwitchFocus ?? undefined;
            tabSwitchTarget = null;
            tabSwitchFocus = null;
            formStore.set(null);
            navigateToTab(target, focus);
            // reset() is called optimistically — SJSF reset is synchronous and safe here
            // because navigateToTab calls goto() which schedules the route change asynchronously.
            form?.reset();
        }
        showDiscardConfirm = false;
    }

    /** Cancels the discard-and-switch dialog and keeps the user on the current tab. */
    function cancelTabSwitch(): void {
        tabSwitchTarget = null;
        tabSwitchFocus = null;
        showDiscardConfirm = false;
    }

    async function tryFocusField(focusPath: string): Promise<void> {
        for (let attempt = 0; attempt < 12; attempt++) {
            await tick();
            if (highlightAndScrollToField(focusPath)) {
                pendingFocusPath = null;
                return;
            }
            await new Promise((r) => setTimeout(r, 50));
        }
    }

    /**
     * `form.isChanged` is the SJSF equivalent of `isDirty`.
     * Used for the save bar, header status, and tab-switch guard.
     */
    const isDirty = $derived(form?.isChanged ?? false);

    /**
     * True while SvelteKit is navigating (loading a new tab's data).
     * Disables save/discard controls during in-flight requests.
     */
    const isNavigating = $derived(Boolean($navigating));

    $effect(() => {
        const fromUrl = $page.data.focusPath as string | null | undefined;
        const target = pendingFocusPath ?? fromUrl ?? null;
        if (!target || isNavigating) return;
        void tryFocusField(target);
    });

    onMount(() => {
        const fromUrl = $page.data.focusPath as string | null | undefined;
        if (fromUrl) {
            pendingFocusPath = fromUrl;
            void tryFocusField(fromUrl);
        }
    });

    /**
     * The active tab metadata, resolved from `$page.data.tabs`.
     * Defensive: `$page.data.tabs` can be undefined during navigation transitions.
     */
    const activeTab = $derived(
        $page.data.tabs?.find(
            (t: { id: string; label: string; restartRequired?: boolean }) =>
                t.id === $page.data.activeTabId
        )
    );

    let searchOpen = $state(false);

    /**
     * Platform-aware keyboard shortcut label.
     * Derived once; avoids repeating navigator?.platform?.includes("Mac") throughout the template.
     */
    const isMac = $derived(
        typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
    );
    const saveShortcut = $derived(isMac ? "⌘S" : "Ctrl+S");
    const searchShortcut = $derived(isMac ? "⌘K" : "Ctrl+K");

    /**
     * Global keyboard shortcut handler.
     * Ctrl+S (Windows/Linux) or Cmd+S (macOS) saves when the form is dirty.
     * Ctrl+K (Windows/Linux) or Cmd+K (macOS) opens the settings search palette.
     */
    function handleKeydown(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (isDirty && !isNavigating) {
                submitSettingsForm();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            searchOpen = !searchOpen;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

<PageShell class="relative h-full px-4 md:px-6 lg:px-8">
    <div
        class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent"
        aria-hidden="true"></div>
    <Tooltip.Provider>
        <div class="relative w-full">
            <!-- ── Page header ─────────────────────────────────────────────── -->
            <header
                class="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-start md:justify-between">
                <div>
                    <!-- Breadcrumb: Admin › Settings › {Section} -->
                    <nav
                        class="text-muted-foreground flex items-center gap-1 text-sm font-medium"
                        aria-label="Breadcrumb">
                        <span>Admin</span>
                        <ChevronRight class="size-3.5 shrink-0 opacity-60" />
                        <span>Settings</span>
                        {#if activeTab}
                            <ChevronRight class="size-3.5 shrink-0 opacity-60" />
                            <span class="text-foreground">{activeTab.label}</span>
                        {/if}
                    </nav>

                    <div class="mt-1 flex flex-wrap items-center gap-2">
                        <h1 class="text-foreground text-3xl font-bold tracking-tight">
                            Settings
                        </h1>
                        {#if activeTab?.restartRequired}
                            <Badge
                                class="border-amber-500/30 bg-amber-500/20 text-xs font-medium text-amber-600 dark:text-amber-400">
                                Restart required
                            </Badge>
                        {/if}
                    </div>

                    <!-- Section description (falls back to generic copy) -->
                    <p class="text-muted-foreground mt-2 max-w-3xl text-sm md:text-[0.92rem]">
                        {#if activeTab?.description}
                            {activeTab.description}
                        {:else}
                            Configure CineFlow by section — each tab includes a guide with how-to
                            steps. Save before switching tabs.
                        {/if}
                    </p>
                </div>

                <!-- Save status + primary Save button (SJSF tabs only) -->
                <div class="mt-2 flex items-center gap-2 md:mt-0">
                    {#if !activeTab?.custom}
                        {#if isNavigating || !form}
                            <div
                                class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                                <Loader2 class="size-3.5 animate-spin" />
                                {isNavigating ? "Loading section…" : "Preparing form…"}
                            </div>
                        {:else if isDirty}
                            <Tooltip.Root>
                                <Tooltip.Trigger>
                                    {#snippet child({ props })}
                                        <Button
                                            {...props}
                                            type="button"
                                            size="sm"
                                            class="h-8 gap-1.5 px-3 text-xs"
                                            onclick={submitSettingsForm}
                                            disabled={isNavigating}
                                            aria-live="polite">
                                            <AlertCircle class="size-3.5" />
                                            Save changes
                                        </Button>
                                    {/snippet}
                                </Tooltip.Trigger>
                                <Tooltip.Content side="bottom">
                                    Save <Kbd
                                        class="border-primary-foreground/20 text-primary-foreground ml-1 bg-transparent"
                                        >{saveShortcut}</Kbd>
                                </Tooltip.Content>
                            </Tooltip.Root>
                        {:else}
                            <div
                                class="flex items-center gap-1.5 text-xs font-medium text-emerald-500"
                                aria-live="polite">
                                <Check class="size-3.5" />
                                All changes saved
                            </div>
                        {/if}
                    {/if}

                    <!-- Single search button — rendered once, visible on all screen sizes -->
                    <button
                        class="text-muted-foreground hover:text-foreground border-border/50 bg-background/50 hover:bg-muted/50 flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors"
                        onclick={() => (searchOpen = true)}>
                        <SearchIcon class="size-3.5" />
                        <span class="hidden sm:inline">Search settings</span>
                        <Kbd class="ml-1 hidden sm:inline-flex">{searchShortcut}</Kbd>
                    </button>
                </div>
            </header>

            <Separator class="mb-6 md:mb-8" />

            <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <!-- ── Two-level grouped sidebar nav ───────────────────────── -->
                <nav
                    class="flex shrink-0 flex-row flex-wrap gap-1 lg:w-56 lg:flex-col lg:flex-nowrap lg:gap-0 xl:w-64"
                    aria-label="Settings sections">
                    <!-- Mobile: flat pill strip (groups collapsed) -->
                    <div class="flex flex-wrap gap-1 lg:hidden">
                        {#each $page.data.tabs as tab (tab.id)}
                            {@const IconComponent = ICON_MAP[tab.icon] as Component | undefined}
                            <button
                                class={cn(
                                    "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                                    $page.data.activeTabId === tab.id
                                        ? "border-primary/40 bg-primary/12 text-primary"
                                        : "border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                                onclick={() => handleTabClick(tab.id)}
                                aria-current={$page.data.activeTabId === tab.id ? "true" : undefined}>
                                {#if IconComponent}
                                    <IconComponent class="size-3.5 shrink-0" />
                                {/if}
                                {tab.label}
                            </button>
                        {/each}
                    </div>

                    <!-- Desktop: two-level grouped sidebar -->
                    <div class="hidden w-full flex-col gap-0.5 lg:flex">
                        {#each Object.entries(SECTION_GROUPS) as [groupId, groupMeta] (groupId)}
                            {@const group = groupId as import("$lib/components/settings/sections").SectionGroup}
                            {@const GroupIcon = ICON_MAP[groupMeta.icon] as Component | undefined}
                            {@const groupTabs = getTabsByGroup(group)}
                            {@const isGroupOpen = groupOpen[group]}
                            {@const hasActiveTab = groupTabs.some(t => t.id === $page.data.activeTabId)}

                            <div class="mb-1">
                                <!-- Group header button -->
                                <button
                                    class={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
                                        hasActiveTab
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                    onclick={() => toggleGroup(group)}
                                    aria-expanded={isGroupOpen}>
                                    {#if GroupIcon}
                                        <GroupIcon class="size-3.5 shrink-0 opacity-70" />
                                    {/if}
                                    <span class="flex-1">{groupMeta.label}</span>
                                    <ChevronDown
                                        class={cn(
                                            "size-3.5 shrink-0 opacity-60 transition-transform duration-200",
                                            isGroupOpen && "rotate-180"
                                        )} />
                                </button>

                                <!-- Leaf tabs inside the group -->
                                {#if isGroupOpen}
                                    <div class="mt-0.5 flex flex-col gap-0.5 pl-2">
                                        {#each groupTabs as tab (tab.id)}
                                            {@const IconComponent = ICON_MAP[tab.icon] as Component | undefined}
                                            <Tooltip.Root>
                                                <Tooltip.Trigger
                                                    class={cn(
                                                        "flex w-full cursor-pointer items-center gap-2 rounded-md border-l-2 py-1.5 pr-3 pl-2 text-left text-sm transition-all",
                                                        $page.data.activeTabId === tab.id
                                                            ? "border-primary bg-primary/12 text-primary font-medium shadow-sm"
                                                            : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground font-normal"
                                                    )}
                                                    onclick={() => handleTabClick(tab.id)}
                                                    aria-current={$page.data.activeTabId === tab.id ? "true" : undefined}>
                                                    {#if IconComponent}
                                                        <IconComponent class="size-3.5 shrink-0" />
                                                    {/if}
                                                    <span class="flex-1 truncate">{tab.label}</span>
                                                    {#if tab.restartRequired}
                                                        <span
                                                            class="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                                                            title="Requires backend restart">
                                                            ↻
                                                        </span>
                                                    {/if}
                                                </Tooltip.Trigger>
                                                <Tooltip.Content side="right" sideOffset={8}>
                                                    {tab.description}
                                                </Tooltip.Content>
                                            </Tooltip.Root>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </nav>

                <!-- ── Form panel (single visual container) ───────────────── -->
                <!--
                    No inner Card — SettingsFormContent renders a bare form block.
                    This panel is the only bordered container so there is no nested-card look.
                -->
                <div
                    class="border-border/70 bg-card/50 ring-primary/8 relative min-w-0 flex-1 rounded-xl border p-4 shadow-md ring-1 md:p-6"
                    aria-busy={isNavigating}>
                    <!-- Panel section chrome -->
                    <div
                        class="border-primary/15 from-primary/8 mb-4 flex items-center justify-between gap-3 border-b bg-gradient-to-r to-transparent pb-3">
                        <div class="min-w-0">
                            <div
                                class="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                                <RefreshCw
                                    class={cn(
                                        "text-primary size-3.5 shrink-0 opacity-80",
                                        isNavigating && "animate-spin"
                                    )} />
                                <span>{activeTab?.label ?? "Settings"}</span>
                            </div>
                        </div>
                    </div>

                    {#if activeTab}
                        <SettingsTabGuide tab={activeTab} />
                    {/if}

                    {#if $page.data.activeTabId === "ranking"}
                        <div
                            class="border-primary/25 from-primary/8 mb-4 rounded-lg border bg-gradient-to-br to-transparent px-3 py-2.5">
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Info class="text-primary size-3.5 shrink-0" />
                                <span class="text-muted-foreground text-xs">
                                    Rejects map as
                                    <code class="text-foreground/90"
                                        >denied by: category_attribute</code>
                                    ·
                                    <kbd
                                        class="bg-background/80 rounded border px-1 py-0.5 text-[10px]"
                                        >Ctrl+K</kbd>
                                    to jump
                                </span>
                                <button
                                    type="button"
                                    class="text-primary hover:text-primary/80 ml-auto inline-flex items-center gap-1 text-xs font-semibold"
                                    aria-expanded={rankingDenyHelpOpen}
                                    onclick={() => (rankingDenyHelpOpen = !rankingDenyHelpOpen)}>
                                    Deny-key reference
                                    <ChevronDown
                                        class={cn(
                                            "size-3.5 transition-transform",
                                            rankingDenyHelpOpen && "rotate-180"
                                        )} />
                                </button>
                            </div>
                            {#if rankingDenyHelpOpen}
                                <ul
                                    class="text-muted-foreground mt-2 list-disc space-y-1 border-t border-primary/15 pt-2 pl-5 text-xs leading-relaxed">
                                    <li>
                                        Examples:
                                        <code class="text-foreground/90">audio_dolby_digital_plus</code>,
                                        <code class="text-foreground/90">quality_remux</code>,
                                        <code class="text-foreground/90">extras_dubbed</code>
                                    </li>
                                    <li>
                                        When <strong class="text-foreground">Fetch</strong> is off, RTN
                                        rejects outright — no rank score is applied.
                                    </li>
                                    <li>
                                        Disney+/Amazon WEB-DL often needs
                                        <strong class="text-foreground">audio_dolby_digital_plus</strong>
                                        fetch enabled.
                                    </li>
                                </ul>
                            {/if}
                        </div>
                    {/if}

                    <!-- Loading overlay shown while navigating to a new tab -->
                    {#if $navigating}
                        <div
                            class="bg-background/60 absolute inset-0 z-10 flex items-center justify-center rounded-xl backdrop-blur-[1px]"
                            aria-live="polite">
                            <span
                                class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                                <Loader2 class="size-4 animate-spin" />
                                Loading section…
                            </span>
                        </div>
                    {/if}

                    <!-- Keyed so components fully remount on tab change -->
                    {#key $page.data.activeTabId}
                        {#if activeTab?.custom && $page.data.activeTabId === LIBRARY_PROFILES_TAB_ID}
                            <LibraryProfilesPanel
                                profiles={$page.data.customData?.profiles ?? {}} />
                        {:else if $page.data.form}
                            <SettingsFormContent
                                {formStore}
                                pageData={$page.data as import("./$types").PageData}
                                actionData={$page.form ?? undefined}
                                activeTabId={$page.data.activeTabId} />
                        {:else}
                            <!-- Render nothing while SvelteKit finishes transitioning to /settings -->
                            <div class="h-full w-full opacity-0"></div>
                        {/if}
                    {/key}
                </div>
            </div>

            <!-- ── Sticky save bar (shown only when SJSF form is dirty and not on custom tabs) ─────────── -->
            {#if isDirty && !activeTab?.custom}
                <div
                    class="border-primary/30 bg-card/95 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-4 border-t px-4 py-3 shadow-lg backdrop-blur md:right-4 md:bottom-4 md:left-auto md:max-w-md md:rounded-lg md:border md:shadow-xl"
                    role="status"
                    aria-live="polite">
                    <div class="min-w-0">
                        <span class="text-sm font-medium text-amber-500">Unsaved changes</span>
                        <p class="text-muted-foreground truncate text-xs">
                            Review and save this section to persist updates.
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => form?.reset()}
                            disabled={isNavigating}>
                            Discard changes
                        </Button>
                        <Button size="sm" onclick={submitSettingsForm} disabled={isNavigating}>
                            {#if isNavigating}
                                <Loader2 class="size-4 animate-spin" />
                                Loading...
                            {:else}
                                Save ({saveShortcut})
                            {/if}
                        </Button>
                    </div>
                </div>
            {/if}
        </div>

        <!-- ── Discard-and-switch confirmation dialog ────────────────────── -->
        <AlertDialog bind:open={showDiscardConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Discard and switch tabs?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onclick={cancelTabSwitch}>Stay</AlertDialogCancel>
                    <AlertDialogAction onclick={confirmDiscardAndSwitch}>
                        Discard and switch
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <!-- ── Settings Command Palette ────────────────────────────────────── -->
        <SettingsSearch
            bind:open={searchOpen}
            onNavigate={handleTabClick}
            entries={$page.data.searchIndex ?? []} />
    </Tooltip.Provider>
</PageShell>
