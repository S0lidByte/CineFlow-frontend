<script lang="ts">
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import type { FunnelSummaryResponse } from "$lib/services/trash-ranking";
    import { getFunnelSummary } from "$lib/services/trash-ranking";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Search from "@lucide/svelte/icons/search";
    import Filter from "@lucide/svelte/icons/filter";
    import XCircle from "@lucide/svelte/icons/x-circle";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";

    let itemIdInput = $state<string | number>("");
    let isLoading = $state(false);
    let funnelData = $state<FunnelSummaryResponse | null>(null);
    let errorMsg = $state<string | null>(null);

    async function loadFunnel() {
        const raw = String(itemIdInput ?? "").trim();
        const id = parseInt(raw, 10);
        if (isNaN(id) || id <= 0) {
            errorMsg = "Please enter a valid positive integer Item ID";
            return;
        }

        isLoading = true;
        errorMsg = null;

        try {
            const res = await getFunnelSummary(id);
            funnelData = res;
        } catch (err: unknown) {
            errorMsg = err instanceof Error ? err.message : "Failed to load funnel summary";
            funnelData = null;
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header & Lookup -->
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
            <h3 class="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                <Filter class="text-primary size-4" />
                Scrape Pipeline Funnel Observability
            </h3>
            <p class="text-muted-foreground text-xs">
                Inspect how candidate streams were filtered through deduplication, blacklists, RTN,
                and TRaSH rules.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <Input
                type="number"
                min="1"
                placeholder="Item ID (e.g. 1042)"
                bind:value={itemIdInput}
                class="bg-card/40 h-8 w-36 border-white/10 font-mono text-xs"
                onkeydown={(e) => e.key === "Enter" && loadFunnel()} />
            <Button
                variant="outline"
                size="sm"
                class="h-8 gap-1.5 border-white/10 px-3 text-xs"
                disabled={isLoading || !String(itemIdInput ?? "").trim()}
                onclick={loadFunnel}>
                {#if isLoading}
                    <Loader2 class="size-3.5 animate-spin" />
                {:else}
                    <Search class="size-3.5" />
                {/if}
                Lookup
            </Button>
        </div>
    </div>

    <!-- Error message -->
    {#if errorMsg}
        <div
            class="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <XCircle class="size-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
        </div>
    {/if}

    <!-- Funnel Content -->
    {#if funnelData}
        {#if !funnelData.found}
            <div
                class="bg-card/30 text-muted-foreground space-y-1 rounded-xl border border-white/5 p-8 text-center text-xs">
                <AlertCircle class="text-muted-foreground/60 mx-auto mb-2 size-6" />
                <p class="text-foreground font-medium">
                    No Funnel History for Item #{funnelData.item_id}
                </p>
                <p>
                    This item either has not run a scrape cycle recently or its scrape telemetry has
                    cleared.
                </p>
            </div>
        {:else}
            <div
                class="bg-card/40 space-y-5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
                <!-- Funnel Stage Cards -->
                <div
                    class="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4 lg:grid-cols-7">
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >Found</span>
                        <span class="text-foreground mt-0.5 block font-mono text-base font-bold"
                            >{funnelData.found_count}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >Ranked</span>
                        <span class="text-primary mt-0.5 block font-mono text-base font-bold"
                            >{funnelData.ranked}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >New</span>
                        <span class="mt-0.5 block font-mono text-base font-bold text-emerald-400"
                            >{funnelData.new}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >Cached/Known</span>
                        <span
                            class="text-muted-foreground mt-0.5 block font-mono text-base font-bold"
                            >{funnelData.already_known}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >Blacklisted</span>
                        <span class="mt-0.5 block font-mono text-base font-bold text-rose-400"
                            >{funnelData.blacklisted}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >RTN Rejected</span>
                        <span class="mt-0.5 block font-mono text-base font-bold text-amber-400"
                            >{funnelData.rtn_rejected}</span>
                    </div>
                    <div class="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                        <span class="text-muted-foreground block font-mono text-[10px] uppercase"
                            >Filtered</span>
                        <span class="mt-0.5 block font-mono text-base font-bold text-slate-400"
                            >{funnelData.content_filtered}</span>
                    </div>
                </div>

                <!-- Rejection Reasons Breakdown -->
                {#if funnelData.rtn_top && funnelData.rtn_top.length > 0}
                    <div class="space-y-2">
                        <h4 class="text-foreground text-xs font-semibold">Top Rejection Reasons</h4>
                        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {#each funnelData.rtn_top as top (top.reason)}
                                <div
                                    class="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-2 text-xs">
                                    <span class="text-muted-foreground truncate pr-2 font-mono"
                                        >{top.reason}</span>
                                    <Badge variant="secondary" class="font-mono text-[10px]">
                                        {top.count}
                                    </Badge>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if funnelData.item_log}
                    <div class="space-y-1">
                        <h4 class="text-foreground text-xs font-semibold">Pipeline Log Snippet</h4>
                        <pre
                            class="text-muted-foreground overflow-x-auto rounded-lg border border-white/5 bg-black/50 p-2.5 font-mono text-[11px] whitespace-pre-wrap">{funnelData.item_log}</pre>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>
