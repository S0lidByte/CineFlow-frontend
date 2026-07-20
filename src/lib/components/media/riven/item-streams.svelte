<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Ban from "@lucide/svelte/icons/ban";
    import Undo2 from "@lucide/svelte/icons/undo-2";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { createScopedLogger } from "$lib/logger";

    const logger = createScopedLogger("item-streams");

    type StreamRow = {
        id?: number;
        raw_title?: string;
        parsed_title?: string;
        resolution?: string;
        rank?: number;
        is_cached?: boolean;
        infohash?: string;
    };

    interface Props {
        itemId: number;
    }

    let { itemId }: Props = $props();

    let loading = $state(true);
    let actionId = $state<number | null>(null);
    let resetting = $state(false);
    let open = $state(false);
    let streams = $state<StreamRow[]>([]);
    let blacklisted = $state<StreamRow[]>([]);

    function asStreamRows(value: unknown): StreamRow[] {
        if (!Array.isArray(value)) return [];
        return value.filter((row): row is StreamRow => typeof row === "object" && row !== null);
    }

    async function loadStreams() {
        loading = true;
        try {
            const res = await providers.riven.GET("/api/v1/items/{item_id}/streams", {
                params: { path: { item_id: itemId } }
            });
            if (res.error) {
                logger.error("Failed to load streams", res.error);
                toast.error("Failed to load streams");
                streams = [];
                blacklisted = [];
                return;
            }
            streams = asStreamRows(res.data?.streams);
            blacklisted = asStreamRows(res.data?.blacklisted_streams);
        } catch (e) {
            logger.error("Stream load error", e);
            toast.error("Failed to load streams");
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if (itemId > 0 && open) {
            void loadStreams();
        }
    });

    async function blacklistStream(streamId: number) {
        actionId = streamId;
        try {
            const res = await providers.riven.POST(
                "/api/v1/items/{item_id}/streams/{stream_id}/blacklist",
                {
                    params: { path: { item_id: itemId, stream_id: streamId } }
                }
            );
            if (res.error) {
                toast.error("Failed to blacklist stream");
                return;
            }
            toast.success("Stream blacklisted");
            await loadStreams();
        } finally {
            actionId = null;
        }
    }

    async function unblacklistStream(streamId: number) {
        actionId = streamId;
        try {
            const res = await providers.riven.POST(
                "/api/v1/items/{item_id}/streams/{stream_id}/unblacklist",
                {
                    params: { path: { item_id: itemId, stream_id: streamId } }
                }
            );
            if (res.error) {
                toast.error("Failed to unblacklist stream");
                return;
            }
            toast.success("Stream restored");
            await loadStreams();
        } finally {
            actionId = null;
        }
    }

    async function resetStreams() {
        resetting = true;
        try {
            const res = await providers.riven.POST("/api/v1/items/{item_id}/streams/reset", {
                params: { path: { item_id: itemId } }
            });
            if (res.error) {
                toast.error("Failed to reset streams");
                return;
            }
            toast.success("Stream blacklist cleared");
            await loadStreams();
        } finally {
            resetting = false;
        }
    }

    function labelFor(stream: StreamRow): string {
        return stream.raw_title || stream.parsed_title || stream.infohash || `Stream #${stream.id}`;
    }
</script>

<Collapsible.Root bind:open class="border-border mt-4 rounded-xl border bg-zinc-950/40">
    <div class="flex items-center justify-between gap-3 px-4 py-3">
        <Collapsible.Trigger
            class="hover:text-foreground flex flex-1 items-center gap-2 text-left text-sm font-medium text-zinc-300 transition-colors">
            <ChevronDown class="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
            Manage streams
            {#if !loading && open}
                <span class="text-muted-foreground font-normal">
                    ({streams.length} active · {blacklisted.length} blacklisted)
                </span>
            {/if}
        </Collapsible.Trigger>
        {#if open}
            <Button
                variant="ghost"
                size="sm"
                disabled={resetting || loading || blacklisted.length === 0}
                onclick={resetStreams}
                class="text-muted-foreground hover:text-foreground">
                {#if resetting}
                    <Loader2 class="mr-1 size-3.5 animate-spin" />
                {:else}
                    <RotateCcw class="mr-1 size-3.5" />
                {/if}
                Reset blacklist
            </Button>
        {/if}
    </div>

    <Collapsible.Content class="border-border border-t px-4 py-3">
        {#if loading}
            <div class="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Loader2 class="size-4 animate-spin" />
                Loading streams…
            </div>
        {:else if streams.length === 0 && blacklisted.length === 0}
            <p class="text-muted-foreground py-4 text-sm">No streams stored for this item yet.</p>
        {:else}
            <div class="space-y-5">
                <section class="space-y-2">
                    <h4 class="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                        Active
                    </h4>
                    {#if streams.length === 0}
                        <p class="text-muted-foreground text-sm">No active streams.</p>
                    {:else}
                        <ul class="space-y-2">
                            {#each streams as stream (stream.id ?? stream.infohash)}
                                <li
                                    class="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                                    <div class="min-w-0">
                                        <p class="truncate text-sm text-zinc-200">
                                            {labelFor(stream)}
                                        </p>
                                        <p class="text-muted-foreground mt-0.5 text-xs">
                                            {stream.resolution ?? "Unknown res"}
                                            {#if stream.rank != null}
                                                · rank {stream.rank}
                                            {/if}
                                            {#if stream.is_cached}
                                                · cached
                                            {/if}
                                        </p>
                                    </div>
                                    {#if stream.id != null}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={actionId === stream.id}
                                            onclick={() => blacklistStream(stream.id!)}
                                            class="text-red-300 hover:bg-red-500/10 hover:text-red-200">
                                            {#if actionId === stream.id}
                                                <Loader2 class="size-3.5 animate-spin" />
                                            {:else}
                                                <Ban class="size-3.5" />
                                            {/if}
                                        </Button>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </section>

                <section class="space-y-2">
                    <h4 class="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                        Blacklisted
                    </h4>
                    {#if blacklisted.length === 0}
                        <p class="text-muted-foreground text-sm">No blacklisted streams.</p>
                    {:else}
                        <ul class="space-y-2">
                            {#each blacklisted as stream (stream.id ?? stream.infohash)}
                                <li
                                    class="flex items-start justify-between gap-3 rounded-lg border border-red-500/10 bg-red-500/[0.03] px-3 py-2">
                                    <div class="min-w-0">
                                        <p class="truncate text-sm text-zinc-300">
                                            {labelFor(stream)}
                                        </p>
                                        <p class="text-muted-foreground mt-0.5 text-xs">
                                            {stream.resolution ?? "Unknown res"}
                                            {#if stream.rank != null}
                                                · rank {stream.rank}
                                            {/if}
                                        </p>
                                    </div>
                                    {#if stream.id != null}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={actionId === stream.id}
                                            onclick={() => unblacklistStream(stream.id!)}
                                            class="text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200">
                                            {#if actionId === stream.id}
                                                <Loader2 class="size-3.5 animate-spin" />
                                            {:else}
                                                <Undo2 class="size-3.5" />
                                            {/if}
                                        </Button>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </section>
            </div>
        {/if}
    </Collapsible.Content>
</Collapsible.Root>
