<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Film from "@lucide/svelte/icons/film";
    import User from "@lucide/svelte/icons/user";
    import Monitor from "@lucide/svelte/icons/monitor";
    import Zap from "@lucide/svelte/icons/zap";
    import HardDrive from "@lucide/svelte/icons/hard-drive";
    import Clock from "@lucide/svelte/icons/clock";
    import Play from "@lucide/svelte/icons/play";
    import Pause from "@lucide/svelte/icons/pause";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Radio from "@lucide/svelte/icons/radio";
    import type { StreamSessionMetric } from "$lib/stores/playback-telemetry.svelte";

    interface Props {
        stream: StreamSessionMetric;
    }

    let { stream }: Props = $props();

    let now = $state(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;

    onMount(() => {
        timer = setInterval(() => {
            now = Date.now();
        }, 1000);
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
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

    function formatDuration(startedAt: string | Date | undefined): string {
        if (!startedAt) return "0s";
        try {
            const startMs =
                typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
            if (isNaN(startMs)) return "-";
            const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
            const hours = Math.floor(diffSec / 3600);
            const minutes = Math.floor((diffSec % 3600) / 60);
            const seconds = diffSec % 60;

            if (hours > 0) {
                return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
            }
            return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
        } catch {
            return "-";
        }
    }

    function formatProvider(provider: string | null | undefined): string {
        if (!provider) return "Direct Stream";
        const clean = provider.toLowerCase();
        if (clean === "realdebrid") return "Real-Debrid";
        if (clean === "alldebrid") return "AllDebrid";
        if (clean === "torbox") return "TorBox";
        if (clean === "premiumize") return "Premiumize";
        if (clean === "debridlink") return "Debrid-Link";
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    const stateInfo = $derived.by(() => {
        const state = (stream.playback_state || "unknown").toLowerCase();
        switch (state) {
            case "playing":
                return {
                    label: "PLAYING",
                    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    dotClass: "bg-emerald-400 animate-pulse",
                    icon: Play
                };
            case "paused":
                return {
                    label: "PAUSED",
                    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                    dotClass: "bg-amber-400",
                    icon: Pause
                };
            case "buffering":
                return {
                    label: "BUFFERING",
                    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
                    dotClass: "bg-sky-400 animate-spin",
                    icon: Loader2
                };
            case "stopped":
                return {
                    label: "STOPPED",
                    badgeClass: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
                    dotClass: "bg-zinc-400",
                    icon: Radio
                };
            default:
                return {
                    label: "ACTIVE",
                    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    dotClass: "bg-emerald-400",
                    icon: Play
                };
        }
    });

    const decisionInfo = $derived.by(() => {
        const decision = (stream.decision || "").toLowerCase();
        if (decision === "direct_play" || decision === "direct") {
            return {
                label: "DIRECT PLAY",
                badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            };
        }
        if (decision === "direct_stream") {
            return {
                label: "DIRECT STREAM",
                badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            };
        }
        if (decision === "transcode") {
            return {
                label: "TRANSCODE",
                badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30"
            };
        }
        return null;
    });

    const cacheInfo = $derived.by(() => {
        const hitRate = stream.cache_hit_rate_pct ?? 0;
        const bytesCached = stream.bytes_from_cache ?? 0;
        if (hitRate >= 50 || bytesCached > 0) {
            return {
                label: `Cache HIT (${hitRate.toFixed(0)}%)`,
                badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            };
        }
        return {
            label: "Cache MISS",
            badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20"
        };
    });

    const displayUser = $derived(stream.user_name || stream.client_ip || "Anonymous User");
    const displayDevice = $derived(
        stream.player_device || stream.client_user_agent || "Generic Player"
    );
    const displayTitle = $derived(stream.title || "Unknown Media Title");
</script>

<div
    class="bg-card/70 relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 p-5 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:shadow-xl"
    data-stream-id={stream.stream_id}>
    <!-- Top Header: Title & Playback State Badge -->
    <div>
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <Film class="text-primary size-4 shrink-0" />
                    <h2
                        class="text-foreground truncate text-base font-semibold tracking-tight"
                        title={displayTitle}>
                        {displayTitle}
                    </h2>
                </div>

                <!-- Attribution Row: User & Device -->
                <div
                    class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span class="flex items-center gap-1.5 font-medium text-white/90">
                        <User class="size-3.5 text-white/60" />
                        {displayUser}
                    </span>
                    <span class="hidden text-white/30 sm:inline">•</span>
                    <span class="flex items-center gap-1.5">
                        <Monitor class="size-3.5 text-white/60" />
                        {displayDevice}
                    </span>
                </div>
            </div>

            <!-- State Badge (Playing, Paused, etc.) -->
            <div
                class="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wider uppercase {stateInfo.badgeClass}"
                role="status"
                aria-label={`Playback state: ${stateInfo.label}`}>
                <span class="size-2 rounded-full {stateInfo.dotClass}"></span>
                <span>{stateInfo.label}</span>
            </div>
        </div>

        <!-- Badges Row: Quality, Decision, Provider, Cache -->
        <div class="mt-4 flex flex-wrap items-center gap-2">
            {#if stream.quality_profile}
                <span
                    class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-bold text-white/90">
                    {stream.quality_profile}
                </span>
            {/if}

            {#if decisionInfo}
                <span
                    class="rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold uppercase {decisionInfo.badgeClass}">
                    {decisionInfo.label}
                </span>
            {/if}

            <span
                class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/80">
                {formatProvider(stream.provider)}
            </span>

            <span
                class="rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium {cacheInfo.badgeClass}">
                {cacheInfo.label}
            </span>

            {#if stream.cdn_url_refreshed}
                <span
                    class="rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                    CDN Refreshed
                </span>
            {/if}
        </div>
    </div>

    <!-- Bottom Section: Transfer Rates, Total Streamed, Duration -->
    <div class="mt-5 border-t border-white/5 pt-4">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <!-- Metric 1: Transfer Rate -->
            <div class="flex flex-col">
                <span class="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                    <Zap class="size-3 text-amber-400" />
                    Transfer Rate
                </span>
                <span class="text-foreground mt-0.5 font-mono text-sm font-bold">
                    {formatThroughput(stream.current_throughput_mbps)}
                </span>
            </div>

            <!-- Metric 2: Bytes Streamed -->
            <div class="flex flex-col">
                <span class="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                    <HardDrive class="size-3 text-sky-400" />
                    Transferred
                </span>
                <span class="text-foreground mt-0.5 font-mono text-sm font-bold">
                    {formatBytes(stream.bytes_transferred)}
                </span>
            </div>

            <!-- Metric 3: Duration -->
            <div class="col-span-2 flex flex-col sm:col-span-1">
                <span class="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                    <Clock class="size-3 text-emerald-400" />
                    Duration
                </span>
                <span class="text-foreground mt-0.5 font-mono text-sm font-bold">
                    {formatDuration(stream.started_at)}
                </span>
            </div>
        </div>

        <!-- Footer Stream ID -->
        <div class="text-muted-foreground/60 mt-3 flex items-center justify-between text-[10px]">
            <span class="max-w-[200px] truncate font-mono" title={stream.stream_id}>
                ID: {stream.stream_id}
            </span>
            <span>Live Telemetry</span>
        </div>
    </div>
</div>
