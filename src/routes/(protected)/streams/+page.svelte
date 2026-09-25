<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { playbackTelemetryStore } from "$lib/stores/playback-telemetry.svelte";
    import StreamCard from "$lib/components/telemetry/StreamCard.svelte";
    import Radio from "@lucide/svelte/icons/radio";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Zap from "@lucide/svelte/icons/zap";
    import HardDrive from "@lucide/svelte/icons/hard-drive";
    import Film from "@lucide/svelte/icons/film";
    import Activity from "@lucide/svelte/icons/activity";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import ArrowRight from "@lucide/svelte/icons/arrow-right";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import { resolve } from "$app/paths";

    const { activeStreams, aggregate, isLoading, error, connectionStatus } = $derived({
        activeStreams: playbackTelemetryStore.activeStreams,
        aggregate: playbackTelemetryStore.aggregate,
        isLoading: playbackTelemetryStore.isLoading,
        error: playbackTelemetryStore.error,
        connectionStatus: playbackTelemetryStore.connectionStatus
    });

    onMount(() => {
        void playbackTelemetryStore.fetchSnapshot();
        playbackTelemetryStore.connect();
    });

    onDestroy(() => {
        playbackTelemetryStore.disconnect();
    });

    function formatBytes(bytes: number): string {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    function formatThroughput(mbps: number): string {
        return `${(mbps || 0).toFixed(2)} MB/s`;
    }

    async function handleRefresh() {
        await playbackTelemetryStore.fetchSnapshot();
    }
</script>

<svelte:head>
    <title>Stream Monitor - CineFlow</title>
</svelte:head>

<PageShell class="h-full">
    <div class="flex h-full min-h-0 flex-col gap-6">
        <!-- Header -->
        <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
                <div class="flex items-center gap-3">
                    <div
                        class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg border border-white/5">
                        <Radio class="size-5 text-emerald-400" />
                    </div>
                    <div>
                        <div class="flex items-center gap-2.5">
                            <h1 class="text-3xl font-bold tracking-tight">Stream Monitor</h1>
                            <span
                                class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-400">
                                {activeStreams.length}
                                {activeStreams.length === 1 ? "stream" : "streams"}
                            </span>
                        </div>
                        <p class="text-muted-foreground mt-0.5 text-sm">
                            Real-time playback telemetry, user sessions, streaming decisions, and
                            VFS transfer throughput.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Header Actions -->
            <div class="flex flex-wrap items-center gap-3">
                <!-- Live Connection Badge -->
                <div
                    class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                    role="status"
                    aria-live="polite"
                    aria-label={`Live stream connection status: ${connectionStatus}`}>
                    <div
                        class="size-2 rounded-full {connectionStatus === 'connected'
                            ? 'animate-pulse bg-emerald-500'
                            : connectionStatus === 'connecting'
                              ? 'animate-pulse bg-amber-500'
                              : 'bg-rose-500'}"
                        aria-hidden="true">
                    </div>
                    <span class="text-muted-foreground font-medium capitalize"
                        >{connectionStatus}</span>
                </div>

                <!-- Refresh Button -->
                <Button
                    variant="outline"
                    size="sm"
                    class="cursor-pointer border-white/10 bg-white/5 text-xs hover:bg-white/10"
                    onclick={handleRefresh}
                    disabled={isLoading}>
                    <RefreshCw class="mr-1.5 size-3.5 {isLoading ? 'animate-spin' : ''}" />
                    Refresh
                </Button>

                <!-- Link to Activity Page -->
                <a
                    href={resolve("/activity")}
                    class="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                    <Activity class="size-3.5 text-sky-400" />
                    <span>Activity Ledger</span>
                    <ArrowRight class="size-3 text-white/40" />
                </a>
            </div>
        </div>

        <!-- Metric Summary Strip -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Metric 1: Active Streams -->
            <div
                class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
                <div
                    class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                    <span class="flex items-center gap-1.5">
                        <Film class="text-primary size-3.5" />
                        Active Concurrency
                    </span>
                    <span
                        class="size-2 rounded-full {activeStreams.length > 0
                            ? 'animate-pulse bg-emerald-500'
                            : 'bg-zinc-600'}">
                    </span>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                        {aggregate?.active_streams_count ?? activeStreams.length}
                    </span>
                    <span class="text-muted-foreground font-mono text-xs">
                        / {aggregate?.total_streams_count ?? activeStreams.length} total
                    </span>
                </div>
            </div>

            <!-- Metric 2: Live Transfer Throughput -->
            <div
                class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
                <div
                    class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                    <span class="flex items-center gap-1.5">
                        <Zap class="size-3.5 text-amber-400" />
                        Total Transfer Rate
                    </span>
                    <span class="text-muted-foreground font-mono text-[10px]">5s avg</span>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                        {formatThroughput(aggregate?.current_total_throughput_mbps ?? 0)}
                    </span>
                </div>
            </div>

            <!-- Metric 3: Total Transferred -->
            <div
                class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
                <div
                    class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                    <span class="flex items-center gap-1.5">
                        <HardDrive class="size-3.5 text-sky-400" />
                        Total Streamed
                    </span>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                        {formatBytes(aggregate?.total_bytes_transferred ?? 0)}
                    </span>
                </div>
            </div>

            <!-- Metric 4: Cache Hit Efficiency -->
            <div
                class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
                <div
                    class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                    <span class="flex items-center gap-1.5">
                        <ShieldCheck class="size-3.5 text-emerald-400" />
                        Cache Efficiency
                    </span>
                    <span class="text-muted-foreground font-mono text-[10px]">
                        {aggregate?.total_cache_hits ?? 0} hits
                    </span>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                        {(aggregate?.aggregate_cache_hit_rate_pct ?? 0).toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>

        <!-- Error Banner -->
        {#if error}
            <div
                class="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400"
                role="alert">
                <AlertCircle class="size-5 shrink-0" />
                <span>{error}</span>
            </div>
        {/if}

        <!-- Active Streams Grid / Empty State -->
        {#if activeStreams.length > 0}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {#each activeStreams as stream (stream.stream_id)}
                    <StreamCard {stream} />
                {/each}
            </div>
        {:else}
            <!-- Empty State -->
            <div
                class="bg-card/30 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-12 text-center backdrop-blur-sm">
                <div
                    class="relative flex size-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                    <Radio class="size-8 text-emerald-400" />
                    <div
                        class="absolute inset-0 animate-ping rounded-full border border-emerald-500/30 opacity-25">
                    </div>
                </div>
                <h3 class="text-foreground mt-4 text-lg font-semibold">No active streams</h3>
                <p class="text-muted-foreground mt-1.5 max-w-sm text-sm">
                    There are currently no media playback sessions active. Streams will appear
                    automatically in real-time when clients begin playing media via VFS or HTTP
                    streams.
                </p>
            </div>
        {/if}
    </div>
</PageShell>
