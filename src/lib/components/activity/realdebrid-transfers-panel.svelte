<script lang="ts">
    import { onMount } from "svelte";
    import { resolve } from "$app/paths";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { toast } from "svelte-sonner";
    import {
        realDebridTransfersStore,
        type RealDebridTransferItem
    } from "$lib/stores/realdebrid-transfers.svelte";

    interface Props {
        canManage?: boolean;
    }

    let { canManage = true }: Props = $props();

    import Cloud from "@lucide/svelte/icons/cloud";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Copy from "@lucide/svelte/icons/copy";
    import Check from "@lucide/svelte/icons/check";
    import ExternalLink from "@lucide/svelte/icons/external-link";
    import Gauge from "@lucide/svelte/icons/gauge";
    import Users from "@lucide/svelte/icons/users";
    import HardDrive from "@lucide/svelte/icons/hard-drive";
    import XCircle from "@lucide/svelte/icons/x-circle";
    import Layers from "@lucide/svelte/icons/layers";
    import Film from "@lucide/svelte/icons/film";
    import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
    import Plus from "@lucide/svelte/icons/plus";
    import Link2 from "@lucide/svelte/icons/link-2";
    import Search from "@lucide/svelte/icons/search";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import providers from "$lib/providers";
    import { createScopedLogger } from "$lib/logger";
    import { calculateSimilarity } from "$lib/utils/string";
    import { getAttachSearchQuery, type AttachParsedMetadata } from "./attach-search";

    const logger = createScopedLogger("rd-transfers-panel");

    let expandedRows = $state<Record<string, boolean>>({});
    let copiedHash = $state<string | null>(null);
    let confirmCancelOpen = $state(false);
    let pendingCancelItem = $state<RealDebridTransferItem | null>(null);
    let addTransferOpen = $state(false);
    let submitMagnet = $state("");
    let submitMediaId = $state("");
    let isSubmitting = $state(false);

    let attachModalOpen = $state(false);
    let pendingAttachItem = $state<RealDebridTransferItem | null>(null);
    let attachSearchQuery = $state("");
    let searchingMedia = $state(false);
    let isAttaching = $state(false);
    let parsedTorrent = $state<AttachParsedMetadata | null>(null);
    let searchResults = $state<
        Array<{
            id: number;
            title: string;
            year?: number;
            type: string;
            state: string;
        }>
    >([]);
    let selectedMediaItem = $state<{
        id: number;
        title: string;
        year?: number;
        type: string;
        state: string;
    } | null>(null);

    const {
        transfers,
        stats,
        rdEnabled,
        isLoading,
        error,
        selectedStatus,
        searchQuery,
        cancellingId,
        retryingId,
        detailsMap,
        loadingDetailId
    } = $derived({
        transfers: realDebridTransfersStore.transfers,
        stats: realDebridTransfersStore.stats,
        rdEnabled: realDebridTransfersStore.rdEnabled,
        isLoading: realDebridTransfersStore.isLoading,
        error: realDebridTransfersStore.error,
        selectedStatus: realDebridTransfersStore.selectedStatus,
        searchQuery: realDebridTransfersStore.searchQuery,
        cancellingId: realDebridTransfersStore.cancellingId,
        retryingId: realDebridTransfersStore.retryingId,
        detailsMap: realDebridTransfersStore.detailsMap,
        loadingDetailId: realDebridTransfersStore.loadingDetailId
    });

    onMount(() => {
        void realDebridTransfersStore.fetchTransfers();
    });

    function toggleRow(item: RealDebridTransferItem) {
        expandedRows[item.id] = !expandedRows[item.id];
        if (expandedRows[item.id] && !detailsMap[item.id]) {
            void realDebridTransfersStore.fetchDetail(item.id);
        }
    }

    async function copyInfohash(hash: string) {
        try {
            await navigator.clipboard.writeText(hash);
            copiedHash = hash;
            toast.success("Infohash copied to clipboard");
            setTimeout(() => {
                if (copiedHash === hash) {
                    copiedHash = null;
                }
            }, 2000);
        } catch {
            toast.error("Failed to copy infohash");
        }
    }

    function promptCancel(item: RealDebridTransferItem) {
        if (!canManage) {
            toast.error("Permission denied: Requires administrator privileges.");
            return;
        }
        if (!item.is_cineflow_managed) {
            toast.error("Cannot cancel unmanaged external Real-Debrid transfer.");
            return;
        }
        if (item.status === "downloaded") {
            toast.error("Cannot cancel completed transfer.");
            return;
        }
        pendingCancelItem = item;
        confirmCancelOpen = true;
    }

    async function executeCancel() {
        if (!pendingCancelItem) return;
        const item = pendingCancelItem;
        confirmCancelOpen = false;

        try {
            await realDebridTransfersStore.cancelTransfer(item.id);
            toast.success(`Transfer for '${item.filename}' cancelled successfully.`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to cancel transfer";
            toast.error(msg);
        } finally {
            pendingCancelItem = null;
        }
    }

    async function handleRetry(item: RealDebridTransferItem) {
        if (!canManage) {
            toast.error("Permission denied: Requires administrator privileges.");
            return;
        }
        if (!item.is_cineflow_managed) {
            toast.error("Cannot retry unmanaged external Real-Debrid transfer.");
            return;
        }

        try {
            await realDebridTransfersStore.retryTransfer(item.id);
            toast.success(`Transfer for '${item.filename}' re-queued for processing.`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to retry transfer";
            toast.error(msg);
        }
    }

    async function handleManualSubmit() {
        if (!submitMagnet.trim()) {
            toast.error("Please enter a valid magnet URI or infohash");
            return;
        }

        try {
            isSubmitting = true;
            const mediaIdNum = submitMediaId.trim()
                ? parseInt(submitMediaId.trim(), 10)
                : undefined;
            const tid = await realDebridTransfersStore.submitTransfer(
                submitMagnet.trim(),
                mediaIdNum
            );
            toast.success(`Transfer ${tid} queued for Real-Debrid cloud download!`);
            addTransferOpen = false;
            submitMagnet = "";
            submitMediaId = "";
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to submit transfer";
            toast.error(msg);
        } finally {
            isSubmitting = false;
        }
    }

    async function promptAttach(item: RealDebridTransferItem) {
        pendingAttachItem = item;
        selectedMediaItem = null;
        attachModalOpen = true;
        searchingMedia = true;
        searchResults = [];
        parsedTorrent = null;

        try {
            const parseRes = await providers.riven.POST("/api/v1/scrape/parse", {
                body: [item.filename]
            });
            const parsed = parseRes.data?.data?.[0];
            if (parsed) {
                parsedTorrent = parsed as AttachParsedMetadata;
                const query = getAttachSearchQuery(item.filename, parsedTorrent);
                attachSearchQuery = query;
                await searchMediaItems(query, parsedTorrent);
            } else {
                attachSearchQuery = item.filename;
                await searchMediaItems(item.filename);
            }
        } catch (e) {
            logger.error("Failed to parse torrent filename for attach:", e);
            attachSearchQuery = item.filename;
            await searchMediaItems(item.filename);
        } finally {
            searchingMedia = false;
        }
    }

    async function searchMediaItems(query: string, parsedInfo?: AttachParsedMetadata) {
        if (!query.trim()) return;
        searchingMedia = true;
        try {
            const res = await providers.riven.GET("/api/v1/items", {
                params: {
                    query: {
                        search: query.trim(),
                        limit: 20
                    }
                }
            });
            const rawItems = res.data?.items ?? [];
            const pYear = parsedInfo?.year ?? parsedTorrent?.year;
            const pEpisodes = parsedInfo?.episodes ?? parsedTorrent?.episodes;
            const pSeasons = parsedInfo?.seasons ?? parsedTorrent?.seasons;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scored = rawItems.map((item: any) => {
                let score = 0;
                const sim = calculateSimilarity(
                    query.toLowerCase(),
                    (item.title || "").toLowerCase()
                );
                score += sim * 50;

                if (pYear && item.year) {
                    if (Math.abs(item.year - pYear) === 0) score += 40;
                    else if (Math.abs(item.year - pYear) <= 1) score += 20;
                    else score -= 30;
                }

                if (pEpisodes || pSeasons) {
                    if (item.type !== "movie") score += 20;
                    else score -= 40;
                } else if (item.type === "movie") {
                    score += 10;
                }

                return {
                    item: {
                        id: item.id as number,
                        title: item.title as string,
                        year: item.year as number | undefined,
                        type: item.type as string,
                        state: item.state as string
                    },
                    score
                };
            });

            scored.sort((a, b) => b.score - a.score);
            searchResults = scored.map((s) => s.item);

            if (scored.length > 0 && scored[0].score >= 70) {
                selectedMediaItem = scored[0].item;
            }
        } catch (e) {
            logger.error("Search media items failed:", e);
            searchResults = [];
        } finally {
            searchingMedia = false;
        }
    }

    async function handleExecuteAttach() {
        if (!pendingAttachItem || !selectedMediaItem) return;
        try {
            isAttaching = true;
            await realDebridTransfersStore.attachTransfer(
                pendingAttachItem.id,
                selectedMediaItem.id
            );
            toast.success(
                `Attached '${pendingAttachItem.filename}' to '${selectedMediaItem.title}'!`
            );
            attachModalOpen = false;
            pendingAttachItem = null;
            selectedMediaItem = null;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to attach transfer";
            toast.error(msg);
        } finally {
            isAttaching = false;
        }
    }

    function handleStatusTabKeydown(event: KeyboardEvent, currentIndex: number) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }

        event.preventDefault();
        const tabs = Array.from(
            (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
                '[role="tab"]'
            ) ?? []
        );
        if (tabs.length === 0) return;

        const nextIndex =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                    tabs.length;
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
    }

    function formatBytes(bytes?: number | null, decimals: number = 2): string {
        if (!bytes || bytes <= 0) return "0 B";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function formatSpeed(bytesPerSec?: number | null): string {
        if (!bytesPerSec || bytesPerSec <= 0) return "-";
        return `${formatBytes(bytesPerSec, 1)}/s`;
    }

    function formatDate(dateStr?: string | null): string {
        if (!dateStr) return "-";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    }
</script>

<div class="flex flex-col gap-6">
    <!-- Real-Debrid Not Enabled Warning Banner -->
    {#if !rdEnabled}
        <div
            role="alert"
            class="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-300">
            <AlertCircle class="size-5 shrink-0" />
            <div class="text-sm">
                <span class="font-semibold">Real-Debrid Disabled:</span>
                Real-Debrid downloader is not enabled or credentials are missing in Settings &rarr; Downloaders.
            </div>
        </div>
    {/if}

    <!-- Summary Statistics Grid -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <!-- Active Downloads -->
        <div
            class="bg-card/50 flex flex-col justify-between rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-xs font-medium">Active Downloads</span>
                <span
                    class="flex size-2 rounded-full {stats.active > 0
                        ? 'animate-pulse bg-cyan-500'
                        : 'bg-zinc-600'}"></span>
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight"
                    >{stats.active}</span>
                <span class="text-muted-foreground text-xs">in progress</span>
            </div>
        </div>

        <!-- Queued Downloads -->
        <div
            class="bg-card/50 flex flex-col justify-between rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-xs font-medium">Queued</span>
                <Layers class="size-4 text-sky-400 opacity-70" />
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight"
                    >{stats.queued}</span>
                <span class="text-muted-foreground text-xs">waiting</span>
            </div>
        </div>

        <!-- RD Completed -->
        <div
            class="bg-card/50 flex flex-col justify-between rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-xs font-medium">RD Completed</span>
                <CheckCircle2 class="size-4 text-emerald-400 opacity-70" />
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight"
                    >{stats.downloaded}</span>
                <span class="text-muted-foreground text-xs">on cloud</span>
            </div>
        </div>

        <!-- Failed -->
        <div
            class="bg-card/50 flex flex-col justify-between rounded-xl border border-white/5 p-4 backdrop-blur-md">
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-xs font-medium">Failed</span>
                <XCircle class="size-4 text-rose-400 opacity-70" />
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight"
                    >{stats.failed}</span>
                <span class="text-muted-foreground text-xs">errors</span>
            </div>
        </div>

        <!-- Active Slots Usage -->
        <div
            class="bg-card/50 col-span-2 flex flex-col justify-between rounded-xl border border-white/5 p-4 backdrop-blur-md sm:col-span-1">
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-xs font-medium">Active Slot Usage</span>
                <HardDrive class="size-4 text-indigo-400 opacity-70" />
            </div>
            <div class="mt-2 flex items-baseline gap-2">
                <span class="text-foreground font-mono text-2xl font-bold tracking-tight">
                    {stats.active_slots_used}
                    <span class="text-muted-foreground text-sm font-normal"
                        >/ {stats.active_slots_limit}</span>
                </span>
                <span class="text-muted-foreground text-[11px]">
                    ({Math.round(
                        (stats.active_slots_used / Math.max(stats.active_slots_limit, 1)) * 100
                    )}%)
                </span>
            </div>
        </div>
    </div>

    <!-- Filter Controls Bar -->
    <div
        class="bg-card/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 p-3 backdrop-blur-md">
        <!-- Status Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5">
            <span id="rd-status-filter-label" class="text-muted-foreground text-xs font-medium"
                >Status:</span>
            <div
                class="flex items-center gap-1"
                role="tablist"
                aria-labelledby="rd-status-filter-label">
                {#each [{ label: "All", value: null }, { label: "Active", value: "active" }, { label: "Queued", value: "queued" }, { label: "RD Completed", value: "downloaded" }, { label: "Failed", value: "failed" }] as tab, index (tab.label)}
                    <Button
                        variant={selectedStatus === tab.value ? "secondary" : "ghost"}
                        size="sm"
                        class="h-7 px-2.5 text-xs font-medium"
                        role="tab"
                        id={`rd-status-tab-${tab.value ?? "all"}`}
                        aria-selected={selectedStatus === tab.value}
                        aria-controls="rd-transfers-list"
                        tabindex={selectedStatus === tab.value ? 0 : -1}
                        onkeydown={(event) => handleStatusTabKeydown(event, index)}
                        onclick={() => {
                            realDebridTransfersStore.selectedStatus = tab.value;
                        }}>
                        {tab.label}
                    </Button>
                {/each}
            </div>
        </div>

        <!-- Search & Refresh -->
        <div class="flex min-w-[240px] flex-1 items-center justify-end gap-2">
            <Input
                placeholder="Search by filename, hash, or title..."
                aria-label="Search Real-Debrid transfers"
                value={searchQuery}
                oninput={(e) => {
                    realDebridTransfersStore.searchQuery = (e.target as HTMLInputElement).value;
                }}
                onkeydown={(e) => {
                    if (e.key === "Enter") {
                        void realDebridTransfersStore.fetchTransfers();
                    }
                }}
                class="h-8 max-w-sm font-mono text-xs" />
            <Button
                variant="ghost"
                size="sm"
                class="h-8 px-3 text-xs"
                aria-label="Apply search filter"
                onclick={() => void realDebridTransfersStore.fetchTransfers()}>
                Filter
            </Button>
            <Button
                variant="outline"
                size="sm"
                class="h-8 gap-1.5 border-white/10 text-xs"
                aria-label="Refresh transfers from Real-Debrid"
                disabled={isLoading}
                onclick={() => void realDebridTransfersStore.fetchTransfers(true)}>
                <RefreshCw class="size-3.5 {isLoading ? 'animate-spin' : ''}" />
                <span>Refresh</span>
            </Button>
            {#if canManage}
                <Button
                    variant="default"
                    size="sm"
                    class="h-8 gap-1.5 text-xs"
                    aria-label="Submit magnet or infohash to Real-Debrid"
                    onclick={() => {
                        addTransferOpen = true;
                    }}>
                    <Plus class="size-3.5" />
                    <span>Add Transfer</span>
                </Button>
            {/if}
        </div>
    </div>

    <!-- Transfers List Container -->
    <div
        id="rd-transfers-list"
        role="region"
        aria-label="Real-Debrid Transfers List"
        class="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/5 shadow-sm">
        <div
            class="bg-muted/20 text-muted-foreground flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-xs font-medium">
            <div aria-live="polite" aria-atomic="true">
                TRANSFERS ({transfers.length})
            </div>
            <div class="flex items-center gap-6">
                <span>METRICS</span>
                <span>ACTIONS</span>
            </div>
        </div>

        {#if error}
            <div
                role="alert"
                class="bg-destructive/10 border-destructive/20 m-4 rounded-lg border p-4">
                <div class="text-destructive flex items-center gap-2 text-sm font-semibold">
                    <AlertCircle class="size-4" />
                    <span>Transfers Alert</span>
                </div>
                <p class="text-destructive/80 mt-1 font-mono text-xs">{error}</p>
            </div>
        {/if}

        {#if transfers.length === 0 && !isLoading}
            <div
                role="status"
                class="flex h-64 flex-col items-center justify-center p-8 text-center">
                <Cloud class="text-muted-foreground mb-3 size-10 opacity-30" />
                <p class="text-muted-foreground text-sm font-medium">
                    No Real-Debrid transfers found
                </p>
                <p class="text-muted-foreground/70 mt-1 text-xs">
                    Torrents cached or queued on Real-Debrid will appear here for monitoring and
                    management.
                </p>
            </div>
        {:else}
            <div class="divide-y divide-white/5 overflow-y-auto">
                {#each transfers as item (item.id)}
                    <div class="transition-colors hover:bg-white/[0.02]">
                        <div
                            class="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <!-- Left: Expand, Status, Filename, Progress, Linked Media -->
                            <div class="flex min-w-0 flex-1 items-start gap-3">
                                <button
                                    onclick={() => toggleRow(item)}
                                    class="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-0.5 rounded transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                    aria-expanded={Boolean(expandedRows[item.id])}
                                    aria-controls={`transfer-details-${item.id}`}
                                    aria-label={expandedRows[item.id]
                                        ? `Collapse details for ${item.filename}`
                                        : `Expand details for ${item.filename}`}>
                                    {#if expandedRows[item.id]}
                                        <ChevronDown class="size-4" />
                                    {:else}
                                        <ChevronRight class="size-4" />
                                    {/if}
                                </button>

                                <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <!-- Badges & Titles Row -->
                                    <div class="flex flex-wrap items-center gap-2">
                                        <!-- Real-Debrid Status vs CineFlow Ingested Distinction -->
                                        {#if item.status === "downloaded"}
                                            {#if item.ready_in_cineflow}
                                                <span
                                                    class="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                                                    <CheckCircle2 class="size-3" />
                                                    Ready in CineFlow
                                                </span>
                                            {:else}
                                                <span
                                                    class="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-sky-400 uppercase">
                                                    <Cloud class="size-3" />
                                                    RD Downloaded
                                                </span>
                                                <span
                                                    class="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                                                    {item.is_cineflow_managed
                                                        ? "Awaiting Ingestion"
                                                        : "External Account"}
                                                </span>
                                            {/if}
                                        {:else if item.status === "downloading" || item.status === "compressing" || item.status === "uploading"}
                                            <span
                                                class="inline-flex animate-pulse items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-cyan-400 uppercase">
                                                <Gauge class="size-3" />
                                                Downloading
                                            </span>
                                        {:else if item.status === "queued" || item.status === "waiting_files_selection"}
                                            <span
                                                class="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-sky-400 uppercase">
                                                <Layers class="size-3" />
                                                Queued
                                            </span>
                                        {:else}
                                            <span
                                                class="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold tracking-wider text-rose-400 uppercase">
                                                <AlertCircle class="size-3" />
                                                {item.status}
                                            </span>
                                        {/if}

                                        <!-- CineFlow Managed Status -->
                                        {#if item.is_cineflow_managed}
                                            <Badge
                                                variant="outline"
                                                class="h-4 border-indigo-500/30 bg-indigo-500/10 text-[10px] text-indigo-300">
                                                CineFlow Managed
                                            </Badge>
                                        {:else if item.is_attached}
                                            <Badge
                                                variant="outline"
                                                class="h-4 border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-300">
                                                Attached
                                            </Badge>
                                        {:else}
                                            <Badge
                                                variant="outline"
                                                class="text-muted-foreground h-4 border-white/10 text-[10px]">
                                                External
                                            </Badge>
                                        {/if}

                                        <!-- Linked Media Item Link -->
                                        {#if item.media_item_id}
                                            {#if item.media_external_id}
                                                <a
                                                    href={resolve(
                                                        `/details/media/${item.media_external_id}/${item.media_type ?? "movie"}` as "/"
                                                    )}
                                                    class="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                                                    title={`View ${item.media_title} in CineFlow`}>
                                                    <Film class="size-3" />
                                                    <span>{item.media_title}</span>
                                                    <ExternalLink class="size-2.5 opacity-70" />
                                                </a>
                                            {:else}
                                                <span
                                                    class="text-foreground inline-flex items-center gap-1 text-xs"
                                                    title={`Media Item #${item.media_item_id}`}>
                                                    <Film class="text-muted-foreground size-3" />
                                                    <span>{item.media_title}</span>
                                                </span>
                                            {/if}
                                            {#if item.media_state}
                                                <span class="text-muted-foreground text-[10px]">
                                                    ({item.media_state})
                                                </span>
                                            {/if}
                                        {/if}
                                    </div>

                                    <!-- Filename -->
                                    <div class="text-foreground text-xs font-medium break-all">
                                        {#if item.parsed_title}
                                            <span>{item.parsed_title}</span>
                                            {#if item.year}
                                                <span class="text-muted-foreground ml-1"
                                                    >({item.year})</span>
                                            {/if}
                                            <span
                                                class="text-muted-foreground mt-0.5 block font-mono text-[10px] font-normal"
                                                >{item.filename}</span>
                                        {:else}
                                            <span class="font-mono">{item.filename}</span>
                                        {/if}
                                    </div>

                                    <!-- Progress Bar -->
                                    <div class="mt-1 flex items-center gap-3">
                                        <div
                                            class="bg-muted relative h-2 w-full max-w-md overflow-hidden rounded-full">
                                            <div
                                                class="h-full rounded-full transition-all duration-300 {item.status ===
                                                'downloaded'
                                                    ? 'bg-emerald-500'
                                                    : item.status === 'error'
                                                      ? 'bg-rose-500'
                                                      : 'bg-primary'}"
                                                style="width: {Math.min(
                                                    Math.max(item.progress, 0),
                                                    100
                                                )}%;">
                                            </div>
                                        </div>
                                        <span
                                            class="text-muted-foreground font-mono text-xs tabular-nums">
                                            {item.progress.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Metrics & Actions -->
                            <div
                                class="flex shrink-0 items-center justify-between gap-4 pl-7 md:justify-end md:pl-0">
                                <!-- Metrics Pills -->
                                <div
                                    class="text-muted-foreground flex flex-col text-right font-mono text-xs">
                                    <div class="flex items-center justify-end gap-2">
                                        <span>{formatBytes(item.bytes)}</span>
                                        {#if item.speed && item.speed > 0}
                                            <span class="font-semibold text-cyan-400"
                                                >{formatSpeed(item.speed)}</span>
                                        {/if}
                                    </div>
                                    <div
                                        class="flex items-center justify-end gap-2 text-[11px] opacity-80">
                                        {#if item.seeders !== null && item.seeders !== undefined}
                                            <span class="flex items-center gap-0.5">
                                                <Users class="size-2.5 opacity-60" />
                                                {item.seeders} seeders
                                            </span>
                                            <span>&bull;</span>
                                        {/if}
                                        <span>Added: {formatDate(item.added)}</span>
                                    </div>
                                </div>

                                <!-- Safe Action Controls -->
                                <div class="flex items-center gap-2">
                                    <!-- Attach Button (for transfers not already ready in CineFlow) -->
                                    {#if !item.ready_in_cineflow && canManage}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-8 gap-1.5 border-purple-500/20 text-xs text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                                            onclick={() => promptAttach(item)}
                                            aria-label={`Attach transfer ${item.filename} to media`}
                                            title="Attach transfer to CineFlow Media">
                                            <Link2 class="size-3" />
                                            <span>Attach</span>
                                        </Button>
                                    {/if}

                                    <!-- Retry Button (only for CineFlow managed failed items) -->
                                    {#if item.can_retry && canManage}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-8 gap-1.5 border-white/10 text-xs hover:bg-white/5"
                                            disabled={retryingId === item.id}
                                            aria-busy={retryingId === item.id}
                                            onclick={() => handleRetry(item)}
                                            aria-label={`Retry transfer ${item.filename}`}
                                            title="Retry transfer in CineFlow">
                                            <RotateCcw
                                                class="size-3 {retryingId === item.id
                                                    ? 'animate-spin'
                                                    : ''}" />
                                            <span>Retry</span>
                                        </Button>
                                    {/if}

                                    <!-- Cancel Button (only for CineFlow managed active transfers, NOT downloaded) -->
                                    {#if item.can_cancel && canManage}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-8 gap-1.5 border-rose-500/20 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                                            disabled={cancellingId === item.id}
                                            aria-busy={cancellingId === item.id}
                                            onclick={() => promptCancel(item)}
                                            aria-label={`Cancel transfer ${item.filename}`}
                                            title="Cancel active transfer">
                                            <XCircle
                                                class="size-3 {cancellingId === item.id
                                                    ? 'animate-spin'
                                                    : ''}" />
                                            <span>Cancel</span>
                                        </Button>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <!-- Expandable Details Drawer: Files & Infohash -->
                        {#if expandedRows[item.id]}
                            <div
                                id={`transfer-details-${item.id}`}
                                role="region"
                                aria-label={`Details for transfer ${item.filename}`}
                                class="border-t border-white/5 bg-black/30 p-4 pl-11 font-mono text-xs">
                                <div class="space-y-3">
                                    <!-- Metadata Row -->
                                    <div
                                        class="text-muted-foreground flex flex-wrap items-center gap-4">
                                        <div class="flex items-center gap-1.5">
                                            <strong class="text-foreground">Transfer ID:</strong>
                                            <span>{item.id}</span>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <strong class="text-foreground">Infohash:</strong>
                                            <span class="max-w-[260px] truncate">{item.hash}</span>
                                            <button
                                                type="button"
                                                onclick={() => copyInfohash(item.hash)}
                                                class="hover:text-foreground text-muted-foreground rounded p-0.5"
                                                title="Copy Infohash"
                                                aria-label="Copy infohash">
                                                {#if copiedHash === item.hash}
                                                    <Check class="size-3 text-emerald-400" />
                                                {:else}
                                                    <Copy class="size-3" />
                                                {/if}
                                            </button>
                                        </div>
                                        {#if item.ended}
                                            <div>
                                                <strong class="text-foreground">Finished:</strong>
                                                {formatDate(item.ended)}
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Files Breakdown -->
                                    {#if loadingDetailId === item.id && !detailsMap[item.id]}
                                        <div
                                            class="text-muted-foreground flex items-center gap-2 py-3">
                                            <RefreshCw class="size-3.5 animate-spin" />
                                            <span>Loading file breakdown from Real-Debrid...</span>
                                        </div>
                                    {:else if (detailsMap[item.id]?.files?.length ?? 0) > 0}
                                        {@const filesList = detailsMap[item.id]?.files ?? []}
                                        <div
                                            class="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                                            <div
                                                class="bg-muted/20 text-muted-foreground px-3 py-1.5 text-[11px] font-semibold uppercase">
                                                Torrent Files ({filesList.length})
                                            </div>
                                            <div
                                                class="max-h-56 divide-y divide-white/5 overflow-y-auto">
                                                {#each filesList as file (file.id)}
                                                    <div
                                                        class="flex items-center justify-between px-3 py-1.5 text-[11px]">
                                                        <div
                                                            class="flex min-w-0 flex-1 items-center gap-2">
                                                            <span
                                                                class="size-1.5 rounded-full {file.selected ===
                                                                1
                                                                    ? 'bg-emerald-400'
                                                                    : 'bg-zinc-600'}"></span>
                                                            <span
                                                                class="text-foreground/90 truncate font-mono"
                                                                >{file.path}</span>
                                                        </div>
                                                        <div
                                                            class="text-muted-foreground ml-3 shrink-0 font-mono">
                                                            {formatBytes(file.bytes)}
                                                        </div>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {:else if item.links && item.links.length > 0}
                                        <div class="space-y-1">
                                            <div
                                                class="text-muted-foreground text-[11px] font-semibold uppercase">
                                                Download Links:
                                            </div>
                                            <div class="space-y-1">
                                                {#each item.links as link, linkIdx (linkIdx)}
                                                    <div
                                                        class="text-primary/80 truncate text-[11px]">
                                                        {link}
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Cancellation Confirmation Dialog -->
<AlertDialog.Root bind:open={confirmCancelOpen}>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>Cancel Real-Debrid Transfer?</AlertDialog.Title>
            <AlertDialog.Description
                class="text-muted-foreground space-y-2 text-xs leading-relaxed">
                <p>
                    Are you sure you want to cancel the transfer for
                    <strong class="text-foreground">{pendingCancelItem?.filename}</strong>?
                </p>
                <p>
                    This will stop the cloud torrent on Real-Debrid and mark the corresponding
                    CineFlow operation as cancelled. This action cannot be undone.
                </p>
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel
                onclick={() => {
                    pendingCancelItem = null;
                }}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                class="bg-rose-600 text-white hover:bg-rose-700"
                onclick={executeCancel}>
                Confirm Cancellation
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

<!-- Add Transfer Dialog -->
<AlertDialog.Root bind:open={addTransferOpen}>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>Add Transfer to Real-Debrid</AlertDialog.Title>
            <AlertDialog.Description
                class="text-muted-foreground space-y-3 text-xs leading-relaxed">
                <p>
                    Enter a magnet link or 40-character infohash to queue for cloud download on
                    Real-Debrid.
                </p>
                <div class="space-y-2">
                    <label for="submit-magnet-input" class="text-foreground text-[11px] font-medium"
                        >Magnet URI or Infohash</label>
                    <Input
                        id="submit-magnet-input"
                        placeholder="magnet:?xt=urn:btih:... or 40-hex hash"
                        bind:value={submitMagnet}
                        class="font-mono text-xs" />
                </div>
                <div class="space-y-2">
                    <label
                        for="submit-media-id-input"
                        class="text-foreground text-[11px] font-medium"
                        >Link to Media Item ID (Optional)</label>
                    <Input
                        id="submit-media-id-input"
                        placeholder="e.g. 81"
                        bind:value={submitMediaId}
                        class="font-mono text-xs" />
                </div>
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel
                onclick={() => {
                    addTransferOpen = false;
                    submitMagnet = "";
                    submitMediaId = "";
                }}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                disabled={isSubmitting || !submitMagnet.trim()}
                onclick={handleManualSubmit}>
                {isSubmitting ? "Submitting..." : "Cache on Real-Debrid"}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

<!-- Attach to Media Dialog -->
<AlertDialog.Root bind:open={attachModalOpen}>
    <AlertDialog.Content class="max-w-xl border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title class="flex items-center gap-2">
                <Link2 class="size-4 text-purple-400" />
                <span>Attach Transfer to Media</span>
            </AlertDialog.Title>
            <AlertDialog.Description
                class="text-muted-foreground space-y-3 text-xs leading-relaxed">
                <div class="space-y-1 rounded-lg border border-white/5 bg-white/5 p-3 font-mono">
                    <div class="text-foreground text-xs font-semibold break-all">
                        {pendingAttachItem?.parsed_title || pendingAttachItem?.filename}
                        {#if pendingAttachItem?.parsed_title && pendingAttachItem.year}
                            <span class="text-muted-foreground ml-1"
                                >({pendingAttachItem.year})</span>
                        {/if}
                    </div>
                    {#if pendingAttachItem?.parsed_title}
                        <div class="text-muted-foreground text-[10px] break-all">
                            {pendingAttachItem.filename}
                        </div>
                    {/if}
                    <div
                        class="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
                        <span>ID: {pendingAttachItem?.id}</span>
                        <span
                            >Size: {pendingAttachItem
                                ? formatBytes(pendingAttachItem.bytes)
                                : ""}</span>
                        <span>Status: {pendingAttachItem?.status}</span>
                    </div>
                </div>

                <!-- Search Input for Library Items -->
                <div class="space-y-1.5 pt-1">
                    <label
                        for="attach-media-search"
                        class="text-foreground text-[11px] font-medium">
                        Search CineFlow Library
                    </label>
                    <div class="flex gap-2">
                        <div class="relative flex-1">
                            <Search
                                class="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                            <Input
                                id="attach-media-search"
                                placeholder="Search by movie/show title or ID..."
                                bind:value={attachSearchQuery}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        searchMediaItems(attachSearchQuery);
                                    }
                                }}
                                class="h-8 pl-8 font-mono text-xs" />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            class="h-8 text-xs"
                            disabled={searchingMedia}
                            onclick={() => searchMediaItems(attachSearchQuery)}>
                            {#if searchingMedia}
                                <LoaderCircle class="size-3.5 animate-spin" />
                            {:else}
                                Search
                            {/if}
                        </Button>
                    </div>
                </div>

                <!-- Matching Media Items List -->
                <div class="space-y-1.5">
                    <div
                        class="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                        <span>Suggested Matches ({searchResults.length})</span>
                        {#if parsedTorrent?.title}
                            <span class="text-[10px] text-purple-400"
                                >Parsed: {parsedTorrent.title}
                                {parsedTorrent.year ? `(${parsedTorrent.year})` : ""}</span>
                        {/if}
                    </div>
                    <div
                        class="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-2">
                        {#if searchingMedia}
                            <div
                                class="text-muted-foreground flex items-center justify-center gap-2 py-6">
                                <LoaderCircle class="text-primary size-4 animate-spin" />
                                <span>Searching library...</span>
                            </div>
                        {:else if searchResults.length === 0}
                            <div class="text-muted-foreground py-6 text-center text-xs">
                                No matching media items found in CineFlow library.
                            </div>
                        {:else}
                            {#each searchResults as mItem (mItem.id)}
                                <button
                                    type="button"
                                    class="flex w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left transition-colors {selectedMediaItem?.id ===
                                    mItem.id
                                        ? 'border-purple-500/60 bg-purple-500/10'
                                        : 'border-white/5 hover:bg-white/5'}"
                                    onclick={() => {
                                        selectedMediaItem = mItem;
                                    }}>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="text-foreground truncate text-xs font-medium"
                                                >{mItem.title}</span>
                                            {#if mItem.year}
                                                <span class="text-muted-foreground text-[10px]"
                                                    >({mItem.year})</span>
                                            {/if}
                                        </div>
                                        <div
                                            class="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
                                            <span class="uppercase">{mItem.type}</span>
                                            <span>&bull;</span>
                                            <span>ID: #{mItem.id}</span>
                                            <span>&bull;</span>
                                            <span>{mItem.state}</span>
                                        </div>
                                    </div>
                                    {#if selectedMediaItem?.id === mItem.id}
                                        <Check class="size-4 shrink-0 text-purple-400" />
                                    {/if}
                                </button>
                            {/each}
                        {/if}
                    </div>
                </div>

                <!-- Explicit Confirmation Step -->
                {#if selectedMediaItem}
                    <div
                        class="space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                        <div class="flex items-center gap-2 text-xs font-semibold text-purple-300">
                            <CheckCircle2 class="size-3.5 text-purple-400" />
                            <span>Confirm Attachment</span>
                        </div>
                        <p class="text-muted-foreground text-xs">
                            Associate Real-Debrid transfer <strong class="text-foreground"
                                >{pendingAttachItem?.id}</strong>
                            with
                            <strong class="text-foreground"
                                >{selectedMediaItem.title}
                                {selectedMediaItem.year
                                    ? `(${selectedMediaItem.year})`
                                    : ""}</strong
                            >?
                            {#if pendingAttachItem?.status === "downloaded"}
                                CineFlow will immediately ingest the completed media into your
                                virtual filesystem.
                            {:else}
                                CineFlow will monitor the cloud download until completion and then
                                ingest it automatically.
                            {/if}
                        </p>
                    </div>
                {/if}
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel
                onclick={() => {
                    attachModalOpen = false;
                    pendingAttachItem = null;
                    selectedMediaItem = null;
                    searchResults = [];
                }}>
                Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
                disabled={isAttaching || !selectedMediaItem}
                class="bg-purple-600 text-white hover:bg-purple-700"
                onclick={handleExecuteAttach}>
                {isAttaching ? "Attaching..." : "Confirm & Attach"}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
