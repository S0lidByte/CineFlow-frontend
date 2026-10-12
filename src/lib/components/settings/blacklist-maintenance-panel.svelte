<script lang="ts">
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import SettingsPanelSurface from "./settings-panel-surface.svelte";
    import Ban from "@lucide/svelte/icons/ban";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Trash2 from "@lucide/svelte/icons/trash-2";

    type MaintenanceStatus = "idle" | "loading" | "clearing" | "error";

    let status = $state<MaintenanceStatus>("idle");
    let blacklistedCount = $state<number | null>(null);
    let showConfirm = $state<boolean>(false);

    async function fetchCount() {
        if (status === "clearing") return;
        status = "loading";
        try {
            const res = await fetch("/api/v1/settings/maintenance/blacklisted-streams/count");
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }
            const data = await res.json();
            blacklistedCount = typeof data.count === "number" ? data.count : 0;
            status = "idle";
        } catch {
            status = "error";
            toast.error("Failed to fetch blacklisted streams count");
        }
    }

    async function handleClear() {
        showConfirm = false;
        status = "clearing";
        try {
            const res = await fetch("/api/v1/settings/maintenance/blacklisted-streams/clear", {
                method: "POST"
            });
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }
            const data = await res.json();
            const clearedCount = typeof data.cleared_count === "number" ? data.cleared_count : 0;
            status = "idle";
            toast.success(
                `Successfully restored ${clearedCount} blacklisted stream candidate${clearedCount === 1 ? "" : "s"}.`
            );
            await fetchCount();
        } catch {
            status = "error";
            toast.error("Failed to clear blacklisted streams");
        }
    }

    onMount(() => {
        void fetchCount();
    });
</script>

<SettingsPanelSurface class="mt-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <div class="flex items-center gap-2">
                <Ban class="text-muted-foreground size-4" />
                <h3 class="text-sm font-semibold">Blacklisted Streams Maintenance</h3>
            </div>
            <p class="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                Restore previously blacklisted torrent and stream candidates across the entire
                library. Restored candidates become immediately eligible for future ranking and
                selection without altering existing media files, active stream selections, or
                triggering library-wide re-scrapes.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={status === "loading" || status === "clearing"}
                onclick={() => void fetchCount()}
                aria-label="Refresh blacklisted streams count">
                {#if status === "loading"}
                    <Loader2 class="size-3.5 animate-spin" />
                {:else}
                    <RefreshCw class="size-3.5" />
                {/if}
                Refresh
            </Button>

            <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={status !== "idle" || blacklistedCount === null || blacklistedCount === 0}
                onclick={() => (showConfirm = true)}>
                {#if status === "clearing"}
                    <Loader2 class="size-3.5 animate-spin" />
                    Clearing…
                {:else}
                    <Trash2 class="size-3.5" />
                    Clear All Blacklisted Streams
                {/if}
            </Button>
        </div>
    </div>

    <div class="flex items-center gap-2 pt-1 text-xs">
        <span class="text-muted-foreground">Currently blacklisted candidates:</span>
        {#if status === "loading" && blacklistedCount === null}
            <span class="text-muted-foreground flex items-center gap-1 font-medium">
                <Loader2 class="size-3 animate-spin" /> Loading…
            </span>
        {:else if blacklistedCount !== null}
            <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold {blacklistedCount >
                0
                    ? 'border border-amber-500/20 bg-amber-500/10 text-amber-500'
                    : 'bg-muted text-muted-foreground'}">
                {blacklistedCount.toLocaleString()} candidate{blacklistedCount === 1 ? "" : "s"}
            </span>
        {:else}
            <span class="text-destructive font-medium">Unavailable</span>
        {/if}
    </div>
</SettingsPanelSurface>

<AlertDialog.Root bind:open={showConfirm}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Clear All Blacklisted Streams?</AlertDialog.Title>
            <AlertDialog.Description class="space-y-2 text-xs leading-relaxed">
                <span>
                    This action will clear all <strong>{blacklistedCount ?? 0}</strong> blacklisted torrent
                    and stream candidate entries across your entire library and restore them as eligible
                    candidate streams.
                </span>
                <span class="text-muted-foreground block">
                    • Existing media states, completed downloads, and active streaming selections
                    will remain untouched.<br />
                    • No automated downloads or library re-scrapes will be triggered.<br />
                    • Per-media and per-episode manual blacklist controls continue functioning normally.
                </span>
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={status === "clearing"}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={status === "clearing"}
                onclick={handleClear}>
                {#if status === "clearing"}
                    <Loader2 class="mr-1.5 size-3.5 animate-spin" />
                    Clearing…
                {:else}
                    Clear Blacklisted Streams
                {/if}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
