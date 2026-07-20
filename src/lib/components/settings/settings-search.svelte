<script lang="ts">
    /**
     * Settings search command palette.
     *
     * Opens via Ctrl/Cmd+K or the search trigger button in the settings header.
     * Fuzzy-filters over the static SETTINGS_TABS metadata (label + description)
     * and navigates to the selected tab's URL on selection or Enter.
     */
    import type { Component } from "svelte";
    import * as Command from "$lib/components/ui/command/index.js";
    import { SETTINGS_TABS } from "./sections.js";
    import { ICON_MAP } from "./icon-map.js";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";

    interface Props {
        open: boolean;
        /** Prefer over direct goto so the parent can enforce unsaved-change guards. */
        onNavigate?: (tabId: string) => void;
    }

    let { open = $bindable(false), onNavigate }: Props = $props();

    let query = $state("");

    const filtered = $derived(
        query === ""
            ? SETTINGS_TABS
            : SETTINGS_TABS.filter(
                  (t) =>
                      t.label.toLowerCase().includes(query.toLowerCase()) ||
                      t.description.toLowerCase().includes(query.toLowerCase())
              )
    );

    function selectTab(tabId: string): void {
        open = false;
        query = "";
        if (onNavigate) {
            onNavigate(tabId);
        } else {
            goto(resolve(`/settings?tab=${tabId}`));
        }
    }
</script>

<Command.Dialog bind:open title="Settings Search" description="Jump to any settings section">
    <Command.Input placeholder="Search settings…" bind:value={query} />
    <Command.List>
        <Command.Empty>No matching sections.</Command.Empty>
        <Command.Group heading="Sections">
            {#each filtered as tab (tab.id)}
                {@const IconComponent = ICON_MAP[tab.icon] as Component | undefined}
                <Command.Item value={tab.id} onSelect={() => selectTab(tab.id)}>
                    <span class="flex items-center gap-2">
                        {#if IconComponent}
                            <IconComponent class="text-muted-foreground size-4 shrink-0" />
                        {/if}
                        <span class="font-medium">{tab.label}</span>
                    </span>
                    <Command.Shortcut class="max-w-[16rem] truncate text-right">
                        {tab.description}
                    </Command.Shortcut>
                </Command.Item>
            {/each}
        </Command.Group>
    </Command.List>
</Command.Dialog>
