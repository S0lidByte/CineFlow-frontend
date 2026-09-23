<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/state";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { toast } from "svelte-sonner";
    import { operationsStore, type OperationItem } from "$lib/stores/operations.svelte";
    import { playbackTelemetryStore } from "$lib/stores/playback-telemetry.svelte";
    import PlaybackHUD from "$lib/components/telemetry/PlaybackHUD.svelte";
    import Activity from "@lucide/svelte/icons/activity";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Copy from "@lucide/svelte/icons/copy";
    import Check from "@lucide/svelte/icons/check";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import Clock from "@lucide/svelte/icons/clock";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import Terminal from "@lucide/svelte/icons/terminal";

    let expandedRows = $state<Record<string, boolean>>({});
    let copiedCorrelationId = $state<string | null>(null);
    let retryingId = $state<string | null>(null);

    const {
        items,
        total,
        isLoading,
        error,
        connectionStatus,
        selectedStatus,
        searchCorrelationId
    } = $derived({
        items: operationsStore.items,
        total: operationsStore.total,
        isLoading: operationsStore.isLoading,
        error: operationsStore.error,
        connectionStatus: operationsStore.connectionStatus,
        selectedStatus: operationsStore.selectedStatus,
        searchCorrelationId: operationsStore.searchCorrelationId
    });

    const userRole = $derived(page.data?.user?.role || "user");
    const canRetry = $derived(userRole === "admin");

    onMount(() => {
        void operationsStore.fetchOperations();
        operationsStore.connect();
        void playbackTelemetryStore.fetchSnapshot();
        playbackTelemetryStore.connect();
    });

    onDestroy(() => {
        operationsStore.disconnect();
        playbackTelemetryStore.disconnect();
    });

    function toggleRow(id: string) {
        expandedRows[id] = !expandedRows[id];
    }

    async function copyCorrelation(correlationId: string) {
        try {
            await navigator.clipboard.writeText(correlationId);
            copiedCorrelationId = correlationId;
            toast.success("Correlation ID copied to clipboard");
            setTimeout(() => {
                if (copiedCorrelationId === correlationId) {
                    copiedCorrelationId = null;
                }
            }, 2000);
        } catch {
            toast.error("Failed to copy correlation ID");
        }
    }

    async function handleRetry(item: OperationItem) {
        if (!canRetry) {
            toast.error("Permission denied: Requires administrator privileges.");
            return;
        }
        if (item.status !== "failed" || retryingId === item.id) {
            return;
        }

        try {
            retryingId = item.id;
            await operationsStore.retryOperation(item.id);
            toast.success(`Operation ${item.operation_type} rescheduled for immediate retry.`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to retry operation";
            toast.error(msg);
            await operationsStore.fetchOperations();
        } finally {
            retryingId = null;
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

    function getStatusBadgeClass(status: string) {
        switch (status) {
            case "completed":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            case "processing":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse";
            case "pending":
                return "bg-sky-500/15 text-sky-400 border-sky-500/30";
            case "failed":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            default:
                return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
        }
    }

    function formatDate(dateStr?: string | null) {
        if (!dateStr) return "-";
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                fractionalSecondDigits: 3
            });
        } catch {
            return dateStr;
        }
    }
</script>

<svelte:head>
    <title>Activity & Operations - CineFlow</title>
</svelte:head>

<PageShell class="h-full">
    <div class="flex h-full min-h-0 flex-col gap-6">
        <!-- Header -->
        <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
                <div class="flex items-center gap-3">
                    <div
                        class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg border border-white/5">
                        <Activity class="size-5" />
                    </div>
                    <div>
                        <h1 class="text-3xl font-bold tracking-tight">Activity & Operations</h1>
                        <p class="text-muted-foreground mt-0.5 text-sm">
                            Real-time transaction outbox ledger, background dispatching, and error
                            triage.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Header Actions -->
            <div class="flex items-center gap-3">
                <div
                    class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                    role="status"
                    aria-live="polite"
                    aria-label={`Live stream connection status: ${connectionStatus}`}>
                    <div
                        class="size-2 rounded-full {connectionStatus === 'connected'
                            ? 'bg-emerald-500'
                            : connectionStatus === 'connecting'
                              ? 'animate-pulse bg-amber-500'
                              : 'bg-rose-500'}"
                        aria-hidden="true">
                    </div>
                    <span class="text-muted-foreground capitalize">{connectionStatus}</span>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    class="h-9 gap-2"
                    aria-label="Refresh operations ledger"
                    onclick={() => void operationsStore.fetchOperations()}
                    disabled={isLoading}>
                    <RefreshCw class="size-3.5 {isLoading ? 'animate-spin' : ''}" />
                    <span>Refresh</span>
                </Button>
            </div>
        </div>

        <!-- Playback Telemetry HUD: live ephemeral stream, cache, and CDN observability. -->
        <section aria-label="Playback telemetry observability" class="shrink-0">
            <PlaybackHUD />
        </section>

        <!-- Filter Controls Bar -->
        <div
            class="bg-card/50 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 p-3 backdrop-blur-md">
            <!-- Status Filter -->
            <div class="flex items-center gap-1.5">
                <span id="status-filter-label" class="text-muted-foreground text-xs font-medium"
                    >Status:</span>
                <div
                    class="flex items-center gap-1"
                    role="tablist"
                    aria-labelledby="status-filter-label">
                    {#each [{ label: "All", value: null }, { label: "Pending", value: "pending" }, { label: "Processing", value: "processing" }, { label: "Completed", value: "completed" }, { label: "Failed", value: "failed" }] as tab, index (tab.label)}
                        <Button
                            variant={selectedStatus === tab.value ? "secondary" : "ghost"}
                            size="sm"
                            class="h-7 px-2.5 text-xs font-medium"
                            role="tab"
                            id={`status-tab-${tab.value ?? "all"}`}
                            aria-selected={selectedStatus === tab.value}
                            aria-controls="operations-ledger-list"
                            tabindex={selectedStatus === tab.value ? 0 : -1}
                            onkeydown={(event) => handleStatusTabKeydown(event, index)}
                            onclick={() => {
                                operationsStore.selectedStatus = tab.value;
                            }}>
                            {tab.label}
                        </Button>
                    {/each}
                </div>
            </div>

            <div class="hidden h-4 w-px bg-white/10 md:block"></div>

            <!-- Correlation ID Search -->
            <div class="flex min-w-[220px] flex-1 items-center gap-2">
                <Input
                    placeholder="Search by Correlation ID..."
                    aria-label="Search operations by correlation ID"
                    value={searchCorrelationId}
                    oninput={(e) => {
                        operationsStore.searchCorrelationId = (e.target as HTMLInputElement).value;
                    }}
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            void operationsStore.fetchOperations();
                        }
                    }}
                    class="h-8 font-mono text-xs" />
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-3 text-xs"
                    aria-label="Apply correlation ID search filter"
                    onclick={() => void operationsStore.fetchOperations()}>
                    Filter
                </Button>
            </div>
        </div>

        <!-- Operations Ledger List -->
        <div
            id="operations-ledger-list"
            role="region"
            aria-label="Operations Ledger"
            class="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/5 shadow-sm">
            <div
                class="bg-muted/20 text-muted-foreground flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-xs font-medium">
                <div aria-live="polite" aria-atomic="true">LEDGER ITEMS ({total})</div>
                <div class="flex items-center gap-4">
                    <span>TIMING & LATENCY</span>
                    <span>ACTIONS</span>
                </div>
            </div>

            {#if error}
                <div
                    role="alert"
                    class="bg-destructive/10 border-destructive/20 m-4 rounded-lg border p-4">
                    <div class="text-destructive flex items-center gap-2 text-sm font-semibold">
                        <AlertCircle class="size-4" />
                        <span>Failed to load operations</span>
                    </div>
                    <p class="text-destructive/80 mt-1 font-mono text-xs">{error}</p>
                </div>
            {:else if items.length === 0 && !isLoading}
                <div
                    role="status"
                    class="flex h-64 flex-col items-center justify-center p-8 text-center">
                    <Terminal class="text-muted-foreground mb-3 size-10 opacity-30" />
                    <p class="text-muted-foreground text-sm font-medium">No operations found</p>
                    <p class="text-muted-foreground/70 mt-1 text-xs">
                        Transactions and background jobs will appear here as they are processed.
                    </p>
                </div>
            {:else}
                <div class="divide-y divide-white/5 overflow-y-auto">
                    {#each items as item (item.id)}
                        <div class="transition-colors hover:bg-white/[0.02]">
                            <div
                                class="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                                <!-- Left Column: Status, Type, Correlation -->
                                <div class="flex min-w-0 flex-1 items-start gap-3">
                                    <button
                                        onclick={() => toggleRow(item.id)}
                                        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-0.5 rounded transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                        aria-expanded={Boolean(expandedRows[item.id])}
                                        aria-controls={`operation-details-${item.id}`}
                                        aria-label={expandedRows[item.id]
                                            ? `Collapse details for operation ${item.operation_type}`
                                            : `Expand details for operation ${item.operation_type}`}>
                                        {#if expandedRows[item.id]}
                                            <ChevronDown class="size-4" />
                                        {:else}
                                            <ChevronRight class="size-4" />
                                        {/if}
                                    </button>

                                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span
                                                class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase {getStatusBadgeClass(
                                                    item.status
                                                )}">
                                                {item.status}
                                            </span>

                                            <span
                                                class="text-foreground font-mono text-xs font-semibold">
                                                {item.operation_type}
                                            </span>

                                            {#if item.media_item_id}
                                                <span class="text-muted-foreground text-xs">
                                                    Media #{item.media_item_id}
                                                </span>
                                            {/if}

                                            {#if item.attempt_count > 0}
                                                <Badge
                                                    variant="outline"
                                                    class="text-muted-foreground h-4 border-white/10 py-0 text-[10px]">
                                                    Attempt {item.attempt_count}
                                                </Badge>
                                            {/if}

                                            {#if item.error_classification}
                                                <span
                                                    class="inline-flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                                                    <ShieldAlert class="size-3" />
                                                    {item.error_classification}
                                                </span>
                                            {/if}
                                        </div>

                                        <!-- Correlation ID & Trace -->
                                        <div
                                            class="text-muted-foreground flex items-center gap-2 text-xs">
                                            <span
                                                class="max-w-[280px] truncate font-mono text-[11px] opacity-80">
                                                corr: {item.correlation_id}
                                            </span>
                                            <button
                                                type="button"
                                                onclick={() => copyCorrelation(item.correlation_id)}
                                                class="hover:text-foreground text-muted-foreground focus-visible:ring-ring rounded p-0.5 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                                aria-label={copiedCorrelationId ===
                                                item.correlation_id
                                                    ? `Correlation ID ${item.correlation_id} copied to clipboard`
                                                    : `Copy correlation ID ${item.correlation_id}`}
                                                title="Copy correlation ID">
                                                {#if copiedCorrelationId === item.correlation_id}
                                                    <Check class="size-3 text-emerald-400" />
                                                {:else}
                                                    <Copy class="size-3" />
                                                {/if}
                                            </button>
                                        </div>

                                        {#if item.error_message}
                                            <div
                                                class="mt-1 line-clamp-1 rounded border border-rose-500/10 bg-rose-500/5 px-2 py-1 font-mono text-xs text-rose-400/90">
                                                {item.error_message}
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Right Column: Timing & Actions -->
                                <div
                                    class="flex shrink-0 items-center justify-between gap-4 pl-7 md:justify-end md:pl-0">
                                    <div
                                        class="text-muted-foreground flex flex-col text-right font-mono text-xs">
                                        <div class="flex items-center justify-end gap-1">
                                            <Clock class="size-3 opacity-60" />
                                            <span>Created: {formatDate(item.created_at)}</span>
                                        </div>
                                        {#if item.completed_at}
                                            <span class="text-[11px] text-emerald-400/80">
                                                Done: {formatDate(item.completed_at)}
                                            </span>
                                        {:else if item.started_at}
                                            <span class="text-[11px] text-amber-400/80">
                                                Started: {formatDate(item.started_at)}
                                            </span>
                                        {/if}
                                    </div>

                                    <!-- Retry Button: only available for failed operations and when actor has admin role -->
                                    {#if item.status === "failed" && canRetry}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-8 gap-1.5 border-white/10 text-xs hover:bg-white/5"
                                            disabled={retryingId === item.id}
                                            aria-busy={retryingId === item.id}
                                            onclick={() => handleRetry(item)}
                                            aria-label={`Retry failed operation ${item.operation_type}`}
                                            title="Re-enqueue for immediate execution">
                                            <RotateCcw
                                                class="size-3 {retryingId === item.id
                                                    ? 'animate-spin'
                                                    : ''}" />
                                            <span>Retry</span>
                                        </Button>
                                    {/if}
                                </div>
                            </div>

                            <!-- Expanded Drawer: Redacted Payload & Details -->
                            {#if expandedRows[item.id]}
                                <div
                                    id={`operation-details-${item.id}`}
                                    role="region"
                                    aria-label={`Details for operation ${item.operation_type}`}
                                    class="border-t border-white/5 bg-black/30 p-4 pl-11 font-mono text-xs">
                                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <div
                                                class="text-muted-foreground mb-1.5 font-sans text-[11px] font-semibold tracking-wider uppercase">
                                                Operation Metadata
                                            </div>
                                            <div class="text-muted-foreground space-y-1">
                                                <div>
                                                    <strong class="text-foreground">ID:</strong>
                                                    {item.id}
                                                </div>
                                                <div>
                                                    <strong class="text-foreground"
                                                        >Idempotency Key:</strong>
                                                    {item.idempotency_key || "None"}
                                                </div>
                                                <div>
                                                    <strong class="text-foreground"
                                                        >Worker ID:</strong>
                                                    {item.worker_id || "Unassigned"}
                                                </div>
                                                <div>
                                                    <strong class="text-foreground"
                                                        >Schema Version:</strong>
                                                    {item.schema_version}
                                                </div>
                                                <div>
                                                    <strong class="text-foreground"
                                                        >Scheduled At:</strong>
                                                    {item.scheduled_at}
                                                </div>
                                                <div>
                                                    <strong class="text-foreground"
                                                        >Lease Expires At:</strong>
                                                    {item.lease_expires_at || "None"}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div
                                                class="text-muted-foreground mb-1.5 font-sans text-[11px] font-semibold tracking-wider uppercase">
                                                Redacted Payload
                                            </div>
                                            <pre
                                                class="text-foreground/90 max-h-48 overflow-x-auto rounded-lg border border-white/5 bg-black/50 p-2.5 text-[11px]">{JSON.stringify(
                                                    item.payload || {},
                                                    null,
                                                    2
                                                )}</pre>
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</PageShell>
