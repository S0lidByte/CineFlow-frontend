<script lang="ts">
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import SettingsPanelSurface from "./settings-panel-surface.svelte";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";

    type RuntimeStats = Record<string, Record<string, unknown>>;
    type LoadState = "loading" | "ready" | "error";

    interface Metric {
        path: string[];
        value: string;
    }

    const SENSITIVE_KEY = /(api[_-]?key|token|secret|password|credential|path)/i;
    let loadState = $state<LoadState>("loading");
    let metrics = $state<Metric[]>([]);
    let errorMessage = $state<string | null>(null);
    let lastRefreshedAt = $state<Date | null>(null);

    function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function isRuntimeStats(value: unknown): value is RuntimeStats {
        return isRecord(value) && isRecord(value.stats);
    }

    function formatKey(key: string): string {
        return key
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    function formatValue(value: unknown): string {
        if (value === null || value === undefined) return "Unavailable";
        if (typeof value === "number")
            return Number.isFinite(value) ? value.toLocaleString() : "Unavailable";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "string") return value || "Unavailable";
        if (Array.isArray(value)) {
            const values = value
                .filter((entry) => ["string", "number", "boolean"].includes(typeof entry))
                .map((entry) => formatValue(entry));
            return values.length > 0 ? values.join(", ") : "Unavailable";
        }
        return "Unsupported value";
    }

    function collectMetrics(value: unknown, path: string[] = [], depth = 0): Metric[] {
        if (path.some((key) => SENSITIVE_KEY.test(key))) return [];
        if (!isRecord(value) || depth >= 3) {
            return path.length > 0 ? [{ path, value: formatValue(value) }] : [];
        }

        return Object.entries(value).flatMap(([key, child]) =>
            collectMetrics(child, [...path, key], depth + 1)
        );
    }

    async function loadStats(): Promise<void> {
        loadState = "loading";
        errorMessage = null;

        try {
            const response = await fetch("/api/v1/vfs_stats", {
                headers: { accept: "application/json" }
            });
            const payload: unknown = await response.json().catch(() => null);

            if (!response.ok || !isRuntimeStats(payload)) {
                throw new Error("The VFS statistics response was unavailable.");
            }

            metrics = collectMetrics(payload.stats);
            lastRefreshedAt = new Date();
            loadState = "ready";
        } catch {
            metrics = [];
            loadState = "error";
            errorMessage =
                "Could not load VFS runtime statistics. Your filesystem settings are unchanged.";
        }
    }

    onMount(() => {
        void loadStats();
    });
</script>

<SettingsPanelSurface class="mt-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h3 class="text-sm font-semibold">VFS runtime statistics</h3>
            <p class="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                Read-only counters reported by the virtual filesystem. VFS availability does not
                confirm that a connected media server, such as Plex, Jellyfin, or Emby, has indexed
                an item.
            </p>
        </div>
        <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loadState === "loading"}
            onclick={() => void loadStats()}>
            {#if loadState === "loading"}
                <Loader2 class="size-3.5 animate-spin" />
                Refreshing…
            {:else}
                <RefreshCw class="size-3.5" />
                Refresh
            {/if}
        </Button>
    </div>

    {#if loadState === "loading" && metrics.length === 0}
        <div class="text-muted-foreground flex items-center gap-2 py-3 text-sm" aria-live="polite">
            <Loader2 class="size-4 animate-spin" />
            Loading VFS statistics…
        </div>
    {:else if loadState === "error"}
        <p
            class="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            role="alert">
            {errorMessage}
        </p>
    {:else if metrics.length === 0}
        <p class="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
            No VFS runtime statistics are available yet.
        </p>
    {:else}
        <dl class="divide-border/60 overflow-hidden rounded-lg border">
            {#each metrics as metric (metric.path.join("."))}
                <div
                    class="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                    <dt class="text-muted-foreground min-w-0 text-xs">
                        {metric.path.map(formatKey).join(" · ")}
                    </dt>
                    <dd class="font-mono text-sm break-all sm:text-right">{metric.value}</dd>
                </div>
            {/each}
        </dl>
    {/if}

    {#if lastRefreshedAt}
        <p class="text-muted-foreground text-xs">
            Last refreshed {lastRefreshedAt.toLocaleTimeString()}.
        </p>
    {/if}
</SettingsPanelSurface>
