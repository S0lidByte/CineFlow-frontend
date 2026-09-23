<script lang="ts">
    import { playbackTelemetryStore } from "$lib/stores/playback-telemetry.svelte";
    import Activity from "@lucide/svelte/icons/activity";
    import Zap from "@lucide/svelte/icons/zap";
    import HardDrive from "@lucide/svelte/icons/hard-drive";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Radio from "@lucide/svelte/icons/radio";
    import Film from "@lucide/svelte/icons/film";
    import User from "@lucide/svelte/icons/user";

    const { aggregate, activeStreams, recentEvents } = $derived({
        aggregate: playbackTelemetryStore.aggregate,
        activeStreams: playbackTelemetryStore.activeStreams,
        recentEvents: playbackTelemetryStore.recentEvents
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

    function formatTime(isoStr?: string | null): string {
        if (!isoStr) return "-";
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
        } catch {
            return isoStr;
        }
    }

    function getEventBadgeClass(type: string): string {
        switch (type) {
            case "STREAM_START":
                return "bg-sky-500/15 text-sky-400 border-sky-500/30";
            case "STREAM_COMPLETE":
                return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
            case "CACHE_HIT":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            case "CACHE_MISS":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "CDN_REFRESH":
                return "bg-purple-500/15 text-purple-400 border-purple-500/30 animate-pulse";
            case "STREAM_ERROR":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            default:
                return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
        }
    }
</script>

<div class="flex flex-col gap-4">
    <!-- Top Row: Metrics Overview Grid -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Card 1: Active Streams & Concurrency -->
        <div
            class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
            <div
                class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span class="flex items-center gap-1.5">
                    <Film class="text-primary size-3.5" />
                    Active Streams
                </span>
                <span
                    class="size-2 rounded-full {activeStreams.length > 0
                        ? 'animate-pulse bg-emerald-500'
                        : 'bg-zinc-600'}"
                    title={activeStreams.length > 0 ? "Active streaming sessions" : "Idle"}>
                </span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                    {aggregate?.active_streams_count ?? 0}
                </span>
                <span class="text-muted-foreground text-xs">
                    / {aggregate?.total_streams_count ?? 0} total
                </span>
            </div>
            <div class="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
                <span>Transferred:</span>
                <span class="text-foreground font-mono font-medium">
                    {formatBytes(aggregate?.total_bytes_transferred ?? 0)}
                </span>
            </div>
        </div>

        <!-- Card 2: Transfer Throughput -->
        <div
            class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
            <div
                class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span class="flex items-center gap-1.5">
                    <Zap class="size-3.5 text-amber-400" />
                    Transfer Rate
                </span>
                <span class="text-muted-foreground font-mono text-[10px]">5s window</span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                    {formatThroughput(aggregate?.current_total_throughput_mbps ?? 0)}
                </span>
            </div>
            <div class="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
                <span>Active Pool Conns:</span>
                <span class="text-foreground font-mono font-medium">
                    {aggregate?.active_pool_connections ?? 0}
                </span>
            </div>
        </div>

        <!-- Card 3: Cache Hit Ratio & Performance -->
        <div
            class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
            <div
                class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span class="flex items-center gap-1.5">
                    <HardDrive class="size-3.5 text-emerald-400" />
                    Cache Hit Rate
                </span>
                <span class="font-mono text-[11px] text-emerald-400">
                    {aggregate?.aggregate_cache_hit_rate_pct ?? 0}%
                </span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                    {aggregate?.total_cache_hits ?? 0}
                </span>
                <span class="text-muted-foreground text-xs">
                    hits / {aggregate?.total_chunk_requests ?? 0} chunks
                </span>
            </div>
            <div class="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
                <span>Chunks in Cache:</span>
                <span class="text-foreground font-mono font-medium">
                    {aggregate?.cached_chunks_in_memory ?? 0} RAM / {aggregate?.cached_chunks_on_disk ??
                        0} Disk
                </span>
            </div>
        </div>

        <!-- Card 4: CDN Health & Stability -->
        <div
            class="bg-card/70 flex flex-col justify-between rounded-xl border border-white/5 p-4 shadow-sm backdrop-blur-md">
            <div
                class="text-muted-foreground flex items-center justify-between text-xs font-medium">
                <span class="flex items-center gap-1.5">
                    <RefreshCw class="size-3.5 text-purple-400" />
                    CDN Refreshes & Errors
                </span>
                <span class="text-muted-foreground font-mono text-[10px]">Durable</span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                    {aggregate?.cdn_refresh_count ?? 0}
                </span>
                <span class="text-muted-foreground text-xs">refreshes</span>
            </div>
            <div class="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
                <span>Stream Errors:</span>
                <span
                    class="font-mono font-medium {aggregate?.stream_error_count
                        ? 'text-rose-400'
                        : 'text-foreground'}">
                    {aggregate?.stream_error_count ?? 0}
                </span>
            </div>
        </div>
    </div>

    <!-- Active Streams & Real-time Playback Sessions (if any active) -->
    {#if activeStreams.length > 0}
        <div
            class="bg-card/70 overflow-hidden rounded-xl border border-white/5 shadow-sm backdrop-blur-md">
            <div
                class="bg-muted/20 flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                <div
                    class="text-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                    <Radio class="size-3.5 animate-pulse text-emerald-400" />
                    <span>Live Stream Sessions ({activeStreams.length})</span>
                </div>
                <div class="text-muted-foreground font-mono text-[11px]">
                    Instant Throughput (MB/s)
                </div>
            </div>
            <div class="divide-y divide-white/5">
                {#each activeStreams as stream (stream.stream_id)}
                    <div
                        class="flex flex-col justify-between gap-3 p-3.5 transition-colors hover:bg-white/[0.02] md:flex-row md:items-center">
                        <div class="flex min-w-0 flex-1 flex-col gap-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span
                                    class="text-foreground max-w-[400px] truncate text-sm font-semibold">
                                    {stream.title}
                                </span>
                                {#if stream.provider}
                                    <span
                                        class="text-muted-foreground rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                                        {stream.provider}
                                    </span>
                                {/if}
                                {#if stream.cdn_url_refreshed}
                                    <span
                                        class="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 font-mono text-[10px] text-purple-400">
                                        CDN Refreshed
                                    </span>
                                {/if}
                            </div>
                            <div
                                class="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                                {#if stream.client_user_agent}
                                    <span
                                        class="flex items-center gap-1 font-mono text-[11px] opacity-80">
                                        <User class="size-3" />
                                        {stream.client_user_agent}
                                    </span>
                                {/if}
                                {#if stream.client_ip}
                                    <span class="font-mono text-[11px] opacity-70">
                                        {stream.client_ip}
                                    </span>
                                {/if}
                                <span class="text-[11px]">
                                    Started: {formatTime(stream.started_at)}
                                </span>
                            </div>
                        </div>

                        <!-- Right Stream Metrics -->
                        <div
                            class="flex shrink-0 items-center justify-between gap-6 md:justify-end">
                            <div class="flex flex-col text-right font-mono text-xs">
                                <span class="text-foreground text-sm font-semibold">
                                    {formatThroughput(stream.current_throughput_mbps)}
                                </span>
                                <span class="text-muted-foreground text-[11px]">
                                    {formatBytes(stream.bytes_transferred)} transferred
                                </span>
                            </div>
                            <div class="flex w-20 flex-col text-right font-mono text-xs">
                                <span class="font-semibold text-emerald-400">
                                    {stream.cache_hit_rate_pct}%
                                </span>
                                <span class="text-muted-foreground text-[10px]"> cache hit </span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Recent Playback Activity Events Ring Buffer (latest events) -->
    {#if recentEvents.length > 0}
        <div
            class="bg-card/70 overflow-hidden rounded-xl border border-white/5 shadow-sm backdrop-blur-md">
            <div
                class="bg-muted/20 flex items-center justify-between border-b border-white/5 px-4 py-2">
                <div
                    class="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                    <Activity class="text-primary size-3.5" />
                    <span>Playback Telemetry Events (Ring Buffer)</span>
                </div>
                <span class="text-muted-foreground font-mono text-[11px]">
                    Latest {recentEvents.length} events
                </span>
            </div>
            <div class="max-h-48 divide-y divide-white/5 overflow-y-auto">
                {#each recentEvents.slice(0, 10) as ev (ev.event_id)}
                    <div
                        class="flex items-center justify-between gap-3 px-4 py-2 text-xs hover:bg-white/[0.02]">
                        <div class="flex min-w-0 flex-1 items-center gap-2.5">
                            <span
                                class="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase {getEventBadgeClass(
                                    ev.event_type
                                )}">
                                {ev.event_type}
                            </span>
                            <span class="text-foreground truncate text-xs font-medium">
                                {ev.title}
                            </span>
                        </div>
                        <div
                            class="text-muted-foreground flex shrink-0 items-center gap-3 font-mono text-[11px]">
                            <span>{formatTime(ev.timestamp)}</span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
