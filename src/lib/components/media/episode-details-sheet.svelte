<script lang="ts">
    import * as Sheet from "$lib/components/ui/sheet/index.js";
    import * as Drawer from "$lib/components/ui/drawer/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import StatusBadge from "$lib/components/media/status-badge.svelte";
    import ItemStreams from "$lib/components/media/riven/item-streams.svelte";
    import ItemManualScrape from "$lib/components/media/riven/item-manual-scrape.svelte";
    import ItemRetry from "$lib/components/media/riven/item-retry.svelte";
    import ItemReset from "$lib/components/media/riven/item-reset.svelte";
    import Play from "@lucide/svelte/icons/play";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Search from "@lucide/svelte/icons/search";
    import { IsMobile } from "$lib/hooks/is-mobile.svelte";
    import type { RivenEpisode } from "$lib/types/riven";
    import {
        formatEpisodeSize as formatSize,
        formatBitrate,
        getVfsBadgeStatus
    } from "./episode-details";
    import AvailabilityMatrix from "./availability-matrix.svelte";

    export interface EpisodeItemData {
        id?: number | null;
        seriesId?: number | null;
        name?: string | null;
        aired?: string | null;
        runtime?: number | null;
        overview?: string | null;
        image?: string | null;
        number?: number | null;
        seasonNumber?: number | null;
    }

    interface Props {
        open?: boolean;
        episode?: EpisodeItemData | null;
        rivenEpisode?: RivenEpisode | Partial<RivenEpisode> | null;
        showTitle?: string | null;
        externalId?: string | null;
        onOpenChange?: (open: boolean) => void;
        onPlay?: (itemId: number) => void;
    }

    let {
        open = $bindable(false),
        episode = null,
        rivenEpisode = null,
        showTitle = null,
        externalId = null,
        onOpenChange,
        onPlay
    }: Props = $props();

    const isMobile = new IsMobile();

    function handleOpenChange(newVal: boolean) {
        open = newVal;
        onOpenChange?.(newVal);
    }
</script>

{#snippet sectionHeading(title: string)}
    <div class="mb-3 flex items-center gap-2.5">
        <div class="bg-primary h-5 w-1 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]">
        </div>
        <h3 class="text-foreground text-base font-bold tracking-tight drop-shadow-md">
            {title}
        </h3>
    </div>
{/snippet}

{#snippet episodeHeader(
    ep: EpisodeItemData | null,
    rivenEp: RivenEpisode | Partial<RivenEpisode> | null | undefined
)}
    <div class="flex flex-col gap-1.5">
        <h2 class="font-heading text-2xl font-bold tracking-tight">
            {#if ep?.seasonNumber != null && ep?.number != null}
                S{ep.seasonNumber}E{ep.number}
                {#if ep.name}
                    - {ep.name}{/if}
            {:else if ep?.name}
                {ep.name}
            {:else}
                Episode Details
            {/if}
        </h2>
        <div class="flex flex-wrap items-center gap-2 text-sm">
            {#if showTitle}
                <span class="text-muted-foreground font-serif">{showTitle}</span>
                <span class="text-muted-foreground">•</span>
            {/if}
            {#if ep?.aired}
                <Badge variant="outline" class="font-mono text-xs">{ep.aired}</Badge>
            {/if}
            {#if ep?.runtime}
                <Badge variant="outline" class="font-mono text-xs">{ep.runtime} min</Badge>
            {/if}
            {#if rivenEp?.state}
                <StatusBadge class="text-xs" state={rivenEp.state} />
            {/if}
        </div>
    </div>
{/snippet}

{#snippet episodeBodyContent(
    ep: EpisodeItemData | null,
    rivenEp: RivenEpisode | Partial<RivenEpisode> | null | undefined
)}
    <div class="mt-6 flex flex-1 flex-col gap-8 overflow-y-auto px-6 pb-24">
        {#if ep?.overview}
            <p class="text-muted-foreground text-base leading-relaxed">
                {ep.overview}
            </p>
        {/if}

        {#if ep?.image}
            <div
                class="relative w-full max-w-[640px] overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10">
                <img
                    alt={ep.name ?? "Episode still"}
                    class="aspect-video w-full object-cover"
                    src={ep.image}
                    loading="lazy" />
            </div>
        {/if}

        <!-- Actions -->
        {#if rivenEp?.id != null}
            {@const epId = typeof rivenEp.id === "number" ? rivenEp.id : Number(rivenEp.id)}
            {#if Number.isFinite(epId)}
                <div class="flex flex-wrap items-center gap-2">
                    {#if rivenEp.state === "Completed" && onPlay}
                        <Button
                            variant="secondary"
                            size="sm"
                            class="border border-white/10 bg-white/10 px-4 text-xs font-bold text-white shadow-md backdrop-blur-md transition-all hover:bg-white/20"
                            onclick={() => onPlay(epId)}>
                            <Play class="mr-1.5 h-3.5 w-3.5 fill-current" />
                            Play
                        </Button>
                    {/if}
                    <ItemReset
                        size="sm"
                        variant="secondary"
                        class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-3"
                        title={ep?.name || showTitle || "Episode"}
                        ids={[epId.toString()]}>
                        <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
                        Reset
                    </ItemReset>
                    <ItemRetry
                        size="sm"
                        variant="secondary"
                        class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-3"
                        title={ep?.name || showTitle || "Episode"}
                        ids={[epId.toString()]}>
                        <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
                        Retry
                    </ItemRetry>
                    <ItemManualScrape
                        size="sm"
                        variant="secondary"
                        class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-3"
                        title={ep?.name || showTitle || "Episode"}
                        itemId={epId.toString()}
                        externalId={externalId || (ep?.id ? String(ep.id) : "")}
                        mediaType="tv">
                        <Search class="mr-1.5 h-3.5 w-3.5" />
                        Manual Scrape
                    </ItemManualScrape>
                </div>
                <ItemStreams itemId={epId} />
            {/if}
        {/if}

        <!-- File / VFS Details & Media Metadata -->
        {#if rivenEp?.filesystem_entry || rivenEp?.media_metadata || rivenEp?.state}
            {@const meta = rivenEp?.media_metadata}
            {@const fs = rivenEp?.filesystem_entry}
            {@const video = meta?.video}
            <div class="flex flex-col gap-6">
                {@render sectionHeading("File & Stream Details")}
                <!-- Ambient Quality & Availability Matrix -->
                <div
                    class="rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 shadow-inner backdrop-blur-md">
                    <AvailabilityMatrix
                        metadata={meta}
                        filesystemEntry={fs}
                        state={rivenEp.state}
                        size="sm"
                        showHealth={true}
                        showDebridRing={true}
                        ringSize="sm" />
                </div>
                <div class="flex flex-col gap-4 text-sm">
                    <!-- Canonical Filename -->
                    {#if meta?.filename || fs?.original_filename}
                        <div>
                            <p
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Filename
                            </p>
                            <p class="text-muted-foreground mt-1 font-mono text-xs break-all">
                                {meta?.filename || fs?.original_filename}
                            </p>
                        </div>
                    {/if}

                    <!-- VFS Status Pill -->
                    {#if fs}
                        {@const status = getVfsBadgeStatus(fs)}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                VFS Status
                            </span>
                            <div class="flex flex-wrap gap-2">
                                {#if status === "vfs_mounted"}
                                    <Badge
                                        variant="secondary"
                                        data-testid="vfs-status-pill"
                                        class="border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                                        VFS Mounted
                                    </Badge>
                                {:else if status === "direct_stream"}
                                    <Badge
                                        variant="secondary"
                                        data-testid="vfs-status-pill"
                                        class="border border-sky-500/20 bg-sky-500/10 font-mono text-xs font-semibold text-sky-400 backdrop-blur-sm">
                                        Direct Stream
                                    </Badge>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Video Details -->
                    {#if video}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Video
                            </span>
                            <div class="flex flex-wrap gap-2">
                                {#if video.resolution_width && video.resolution_height}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {video.resolution_width}x{video.resolution_height}
                                    </Badge>
                                {/if}
                                {#if video.codec}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {video.codec}
                                    </Badge>
                                {/if}
                                {#if video.bit_depth}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {video.bit_depth}-bit
                                    </Badge>
                                {/if}
                                {#if video.hdr_type}
                                    <Badge
                                        variant="outline"
                                        class="border-purple-500/20 bg-purple-500/10 font-mono text-xs text-purple-300">
                                        {video.hdr_type}
                                    </Badge>
                                {/if}
                                {#if video.frame_rate}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {video.frame_rate} FPS
                                    </Badge>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Audio Tracks - Show ALL -->
                    {#if meta?.audio_tracks?.length}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Audio
                            </span>
                            <div class="flex flex-wrap gap-2">
                                {#each meta.audio_tracks as track, i (i)}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {track.codec ?? "Audio"}{track.channels
                                            ? track.channels === 8
                                                ? " 7.1"
                                                : track.channels === 6
                                                  ? " 5.1"
                                                  : ` ${track.channels}ch`
                                            : ""}{track.language &&
                                        typeof track.language === "string"
                                            ? ` (${track.language.toUpperCase()})`
                                            : ""}
                                    </Badge>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Subtitle Tracks - Show ALL -->
                    {#if meta?.subtitle_tracks?.length}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Subtitles
                            </span>
                            <div class="flex flex-wrap gap-2">
                                {#each meta.subtitle_tracks as track, i (i)}
                                    <Badge variant="outline" class="font-mono text-xs">
                                        {track.language
                                            ? track.language.toUpperCase()
                                            : "Unknown"}{track.codec ? ` (${track.codec})` : ""}
                                    </Badge>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Source & Release Modifiers -->
                    {#if meta?.quality_source || meta?.is_remux || meta?.is_proper || meta?.is_repack}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Source
                            </span>
                            <div class="flex flex-wrap gap-2">
                                {#if meta.quality_source}
                                    <Badge
                                        variant="outline"
                                        class="border-blue-500/20 bg-blue-500/10 font-mono text-xs font-semibold text-blue-300">
                                        {meta.quality_source}
                                    </Badge>
                                {/if}
                                {#if meta.is_remux}
                                    <Badge
                                        variant="outline"
                                        class="border-amber-500/20 bg-amber-500/10 font-mono text-xs font-semibold text-amber-300">
                                        REMUX
                                    </Badge>
                                {/if}
                                {#if meta.is_proper}
                                    <Badge
                                        variant="outline"
                                        class="border-green-500/20 bg-green-500/10 font-mono text-xs font-semibold text-green-300">
                                        PROPER
                                    </Badge>
                                {/if}
                                {#if meta.is_repack}
                                    <Badge
                                        variant="outline"
                                        class="border-green-500/20 bg-green-500/10 font-mono text-xs font-semibold text-green-300">
                                        REPACK
                                    </Badge>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- File Metrics: Size & Bitrate -->
                    {#if fs?.file_size || meta?.bitrate}
                        <div class="flex flex-col gap-2">
                            <span
                                class="text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                                Metrics
                            </span>
                            <div class="flex flex-wrap gap-4">
                                {#if fs?.file_size}
                                    <div class="flex items-center gap-2">
                                        <span class="text-muted-foreground font-mono text-xs"
                                            >Size:</span>
                                        <span class="text-foreground font-mono text-xs">
                                            {formatSize(fs.file_size)}
                                        </span>
                                    </div>
                                {/if}
                                {#if meta?.bitrate}
                                    <div class="flex items-center gap-2">
                                        <span class="text-muted-foreground font-mono text-xs"
                                            >Bitrate:</span>
                                        <span class="text-foreground font-mono text-xs">
                                            {formatBitrate(meta.bitrate)}
                                        </span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
{/snippet}

{#if isMobile.current}
    <Drawer.Root bind:open onOpenChange={handleOpenChange} direction="bottom">
        <Drawer.Content class="flex max-h-[85vh] flex-col overflow-hidden outline-none">
            <div
                class="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-hidden px-4 pb-6 md:px-6">
                <Drawer.Header class="shrink-0 px-0 pt-2 pb-0 text-left">
                    <Drawer.Title class="sr-only">
                        {episode?.name ?? "Episode Details"}
                    </Drawer.Title>
                    <Drawer.Description class="sr-only">
                        Details for episode {episode?.name ?? ""}
                    </Drawer.Description>
                    {@render episodeHeader(episode, rivenEpisode)}
                </Drawer.Header>
                {@render episodeBodyContent(episode, rivenEpisode)}
            </div>
        </Drawer.Content>
    </Drawer.Root>
{:else}
    <Sheet.Root bind:open onOpenChange={handleOpenChange}>
        <Sheet.Content
            side="right"
            class="flex w-full flex-col overflow-hidden border-l border-white/10 bg-zinc-950/95 backdrop-blur-2xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
            <Sheet.Header class="px-6 pt-6 text-left">
                <Sheet.Title class="sr-only">
                    {episode?.name ?? "Episode Details"}
                </Sheet.Title>
                <Sheet.Description class="sr-only">
                    Details for episode {episode?.name ?? ""}
                </Sheet.Description>
                {@render episodeHeader(episode, rivenEpisode)}
            </Sheet.Header>
            {@render episodeBodyContent(episode, rivenEpisode)}
        </Sheet.Content>
    </Sheet.Root>
{/if}
