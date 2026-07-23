<script lang="ts">
    /**
     * Settings search command palette.
     *
     * Opens via Ctrl/Cmd+K or the search trigger button in the settings header.
     * Filters over sections and schema fields; selecting a field navigates to its
     * tab and focuses the matching form card.
     */
    import type { Component } from "svelte";
    import * as Command from "$lib/components/ui/command/index.js";
    import { ICON_MAP } from "./icon-map.js";
    import { getTabById } from "./sections.js";
    import { filterSearchEntries, type SettingsSearchEntry } from "./settings-field-index.js";

    interface Props {
        open: boolean;
        /** Prefer over direct goto so the parent can enforce unsaved-change guards. */
        onNavigate?: (tabId: string, focusPath?: string) => void;
        /** Prebuilt section + field index from the page loader. */
        entries?: SettingsSearchEntry[];
    }

    let { open = $bindable(false), onNavigate, entries = [] }: Props = $props();

    let query = $state("");

    const filtered = $derived(filterSearchEntries(entries, query));

    const sections = $derived(filtered.filter((e) => e.kind === "section"));
    const fields = $derived(filtered.filter((e) => e.kind === "field").slice(0, 40));

    /**
     * Pre-built tabId → icon map derived once per `entries` change.
     * Replaces the per-render O(n) `getTabById` lookup with an O(1) Map access.
     */
    const tabIconMap = $derived(
        new Map(
            entries
                .map((e) => e.tabId)
                .filter((id, i, arr) => arr.indexOf(id) === i) // unique tab IDs
                .map((tabId) => {
                    const tab = getTabById(tabId);
                    return [
                        tabId,
                        tab ? (ICON_MAP[tab.icon] as Component | undefined) : undefined
                    ] as const;
                })
        )
    );

    function selectEntry(entry: SettingsSearchEntry): void {
        open = false;
        query = "";
        onNavigate?.(entry.tabId, entry.path);
    }
</script>

<Command.Dialog
    bind:open
    title="Settings Search"
    description="Jump to any settings section or field">
    <Command.Input placeholder="Search settings, deny keys, fields…" bind:value={query} />
    <Command.List>
        <Command.Empty>No matching settings.</Command.Empty>

        {#if sections.length > 0}
            <Command.Group heading="Sections">
                {#each sections as entry (entry.id)}
                    {@const IconComponent = tabIconMap.get(entry.tabId)}
                    <Command.Item value={entry.id} onSelect={() => selectEntry(entry)}>
                        <span class="flex min-w-0 items-center gap-2">
                            {#if IconComponent}
                                <IconComponent class="text-muted-foreground size-4 shrink-0" />
                            {/if}
                            <span class="font-medium">{entry.label}</span>
                        </span>
                        <Command.Shortcut class="max-w-[16rem] truncate text-right">
                            {entry.description}
                        </Command.Shortcut>
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}

        {#if fields.length > 0}
            <Command.Group heading="Fields">
                {#each fields as entry (entry.id)}
                    <Command.Item value={entry.id} onSelect={() => selectEntry(entry)}>
                        <span class="flex min-w-0 flex-col gap-0.5 text-left">
                            <span class="font-medium">{entry.label}</span>
                            <span class="text-muted-foreground truncate text-xs">
                                {entry.path ?? entry.tabId}
                            </span>
                        </span>
                        <Command.Shortcut class="max-w-[14rem] truncate text-right text-xs">
                            {entry.description || entry.tabId}
                        </Command.Shortcut>
                    </Command.Item>
                {/each}
            </Command.Group>
        {/if}
    </Command.List>
</Command.Dialog>
