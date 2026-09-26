<script lang="ts">
    import SpecBadge, { type SpecSize } from "$lib/components/ambient/SpecBadge.svelte";
    import DebridStatusRing, {
        type RingSize,
        type DebridState
    } from "$lib/components/ambient/DebridStatusRing.svelte";
    import {
        extractQualityMatrix,
        formatQualityBadges,
        type MediaQualityMatrix,
        type StreamItemSummary
    } from "$lib/services/availability-matrix";
    import type { MediaMetadata, FilesystemEntry } from "$lib/types/riven";
    import { cn } from "$lib/utils";

    interface Props {
        matrix?: MediaQualityMatrix | null;
        state?: string | null;
        metadata?: MediaMetadata | null;
        filesystemEntry?: FilesystemEntry | null;
        streams?: StreamItemSummary[] | null;
        rawTitle?: string | null;
        isCached?: boolean | null;
        size?: SpecSize;
        compact?: boolean;
        showHealth?: boolean;
        showDebridRing?: boolean;
        ringSize?: RingSize;
        class?: string;
    }

    let {
        matrix = null,
        state = null,
        metadata = null,
        filesystemEntry = null,
        streams = null,
        rawTitle = null,
        isCached = null,
        size = "xs",
        compact = false,
        showHealth = true,
        showDebridRing = true,
        ringSize = "xs",
        class: className = ""
    }: Props = $props();

    const activeMatrix = $derived.by<MediaQualityMatrix>(() => {
        if (matrix) return matrix;
        return extractQualityMatrix({
            state,
            media_metadata: metadata,
            filesystem_entry: filesystemEntry,
            streams,
            rawTitle,
            is_cached: isCached
        });
    });

    const badges = $derived(
        formatQualityBadges(activeMatrix, {
            compact,
            showHealth
        })
    );

    const debridRingStatus = $derived.by<DebridState>(() => {
        switch (activeMatrix.availability.status) {
            case "vfs_mounted":
            case "direct_stream":
            case "cached":
                return "cached";
            case "downloading":
                return "downloading";
            case "uncached":
                return "uncached";
            case "error":
                return "error";
            default:
                return "unknown";
        }
    });
</script>

<div
    class={cn("inline-flex flex-wrap items-center gap-1.5", className)}
    data-testid="availability-matrix"
    data-availability-status={activeMatrix.availability.status}>
    {#if showDebridRing}
        <div
            class="flex items-center justify-center"
            title={activeMatrix.availability.label}
            aria-label={activeMatrix.availability.label}>
            <DebridStatusRing
                status={debridRingStatus}
                size={ringSize}
                glow={activeMatrix.availability.isInstant} />
        </div>
    {/if}

    {#each badges as badge (badge.id)}
        <span title={badge.tooltip}>
            <SpecBadge value={badge.value} variant={badge.variant} {size} glow={badge.glow} />
        </span>
    {/each}
</div>
