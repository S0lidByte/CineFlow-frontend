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
    import { cn } from "$lib/utils";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { navigating, page } from "$app/stores";
    import { writable } from "svelte/store";

    // Lucide icons used in the tab nav and header
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Settings from "@lucide/svelte/icons/settings";
    import FolderTree from "@lucide/svelte/icons/folder-tree";
    import Library from "@lucide/svelte/icons/library";
    import Download from "@lucide/svelte/icons/download";
    import FileText from "@lucide/svelte/icons/file-text";
    import ScanSearch from "@lucide/svelte/icons/scan-search";
    import Server from "@lucide/svelte/icons/server";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import BookOpen from "@lucide/svelte/icons/book-open";

    /** Maps the icon name stored in {@link SectionTab.icon} to a Svelte component. */
    const ICON_MAP: Record<string, Component> = {
        settings: Settings,
        "folder-tree": FolderTree,
        library: Library,
        download: Download,
        "file-text": FileText,
        "scan-search": ScanSearch,
        server: Server,
        "book-open": BookOpen
    };

    /**
     * Shared store for the active form state.
     * Written by {@link SettingsFormContent} via `formStore.set` so the page shell
     * can query `form.isChanged` and call `form.reset()` without prop drilling.
     */
    const formStore = writable<FormState<unknown> | null>(null);
    const form = $derived($formStore);

    /** Target tab id while a discard-and-switch is being confirmed. */
    let tabSwitchTarget: string | null = null;
    let showDiscardConfirm = $state(false);

    /** Programmatically submits the SJSF-managed `<form>` inside `.settings-form`. */
    function submitSettingsForm(): void {
        if ($navigating) return;
        const formEl = document.querySelector(".settings-form form");
        (formEl as HTMLFormElement)?.requestSubmit();
    }

    /**
     * Handles a tab button click.
     * If the form has unsaved changes, opens a confirmation dialog instead of
     * navigating immediately.
     */
    function handleTabClick(tabId: string): void {
        if (tabId === $page.data.activeTabId) return;
        if (form?.isChanged) {
            tabSwitchTarget = tabId;
            showDiscardConfirm = true;
        } else {
            goto(resolve(`/settings?tab=${tabId}`));
        }
    }

    /** Confirms the discard-and-switch dialog: resets the form and navigates. */
    function confirmDiscardAndSwitch(): void {
        if (tabSwitchTarget) {
            form?.reset();
            goto(resolve(`/settings?tab=${tabSwitchTarget}`));
            tabSwitchTarget = null;
        }
        showDiscardConfirm = false;
    }

    /** Cancels the discard-and-switch dialog and keeps the user on the current tab. */
    function cancelTabSwitch(): void {
        tabSwitchTarget = null;
        showDiscardConfirm = false;
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

    /**
     * Global keyboard shortcut handler.
     * Ctrl+S (Windows/Linux) or Cmd+S (macOS) saves when the form is dirty.
     */
    function handleKeydown(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (isDirty && !isNavigating) {
                submitSettingsForm();
            }
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

<PageShell class="h-full px-4 md:px-6 lg:px-8">
    <Tooltip.Provider>
        <div class="w-full">
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
                        <h1 class="text-3xl font-bold tracking-tight text-neutral-50">Settings</h1>
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
                            Configure backend behavior with production-safe defaults. Keep changes
                            focused, then save once to apply the current section.
                        {/if}
                    </p>
                </div>

                <!-- Save status + primary Save button -->
                <div class="mt-2 flex items-center gap-2 md:mt-0">
                    {#if isDirty}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                            <AlertCircle class="size-3.5" />
                            Unsaved changes
                        </div>
                    {:else}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                            <Check class="size-3.5" />
                            All changes saved
                        </div>
                    {/if}

                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <Button
                                type="button"
                                class="min-w-[11rem]"
                                onclick={submitSettingsForm}
                                disabled={!isDirty || isNavigating}
                                aria-live="polite">
                                {#if isNavigating}
                                    <Loader2 class="size-4 animate-spin" />
                                    Saving...
                                {:else if isDirty}
                                    <AlertCircle class="size-4" />
                                    Save changes
                                {:else}
                                    <Check class="size-4" />
                                    All changes saved
                                {/if}
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content side="bottom">
                            Save ({navigator?.platform?.includes("Mac") ? "⌘S" : "Ctrl+S"})
                        </Tooltip.Content>
                    </Tooltip.Root>
                </div>
            </header>

            <Separator class="mb-6 md:mb-8" />

            <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <!-- ── Tab navigation ──────────────────────────────────────── -->
                <nav
                    class="flex shrink-0 flex-row flex-wrap gap-1 lg:w-52 lg:flex-col lg:flex-nowrap lg:gap-0.5 xl:w-60"
                    aria-label="Settings sections">
                    {#each $page.data.tabs as tab (tab.id)}
                        {@const IconComponent = ICON_MAP[tab.icon] as Component | undefined}
                        {@const isActive = tab.href
                            ? $page.url.pathname === resolve(tab.href)
                            : $page.data.activeTabId === tab.id}
                        {#if tab.href}
                            <a
                                href={resolve(tab.href)}
                                class={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                                aria-current={isActive ? "page" : undefined}>
                                {#if IconComponent}
                                    <IconComponent class="size-4 shrink-0" />
                                {/if}
                                <span>{tab.label}</span>
                            </a>
                        {:else}
                            <button
                                type="button"
                                class={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                                onclick={() => handleTabClick(tab.id)}
                                aria-current={isActive ? "true" : undefined}>
                                {#if IconComponent}
                                    <IconComponent class="size-4 shrink-0" />
                                {/if}
                                <span>{tab.label}</span>
                                {#if tab.restartRequired}
                                    <span
                                        class="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                                        title="Changes require a backend restart">
                                        Restart
                                    </span>
                                {/if}
                            </button>
                        {/if}
                    {/each}
                </nav>

                <!-- ── Form panel (single visual container) ───────────────── -->
                <!--
                    No inner Card — SettingsFormContent renders a bare form block.
                    This panel is the only bordered container so there is no nested-card look.
                -->
                <div
                    class="border-border/70 bg-card/35 relative min-w-0 flex-1 rounded-xl border p-4 md:p-6"
                    aria-busy={isNavigating}>
                    <!-- Panel title row with refresh/loading indicator -->
                    <div
                        class="border-border/60 mb-4 flex items-center gap-1.5 border-b pb-4 text-sm font-semibold text-neutral-200">
                        <RefreshCw
                            class={cn("size-3.5 shrink-0", isNavigating && "animate-spin")} />
                        {activeTab?.label ?? "Settings"}
                    </div>

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

                    <!-- Keyed so SettingsFormContent fully remounts on tab change -->
                    {#key $page.data.activeTabId}
                        <SettingsFormContent {formStore} />
                    {/key}
                </div>
            </div>

            <!-- ── Sticky save bar (shown only when form is dirty) ─────────── -->
            {#if isDirty}
                <div
                    class="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-4 border-t px-4 py-3 shadow-lg backdrop-blur md:right-4 md:bottom-4 md:left-auto md:max-w-md md:rounded-lg md:border md:shadow-xl"
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
                                Saving...
                            {:else}
                                Save (Ctrl+S)
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
    </Tooltip.Provider>
</PageShell>
