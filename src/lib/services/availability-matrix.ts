/**
 * Stream Availability & Media Quality Matrix Service
 *
 * Implements Phase 4.11 AVAIL-001 (Stream Availability & Media Quality Matrix).
 * Provides pure domain functions to extract and classify:
 *  - Real-time Debrid instant-cache indicators
 *  - Resolution tier badges (4K HDR10/DV, 1080p Remux, etc.)
 *  - Audio channel & codec flags (TrueHD Atmos, DTS-HD MA, etc.)
 *  - Stream health status pills (VFS Mounted, Direct Stream, Cached, Downloading, etc.)
 */

import type { SpecVariant } from "$lib/components/ambient/SpecBadge.svelte";
import type { MediaMetadata, FilesystemEntry } from "$lib/types/riven";

export type AvailabilityTone = "success" | "warning" | "danger" | "info" | "neutral";

export type AvailabilityStatus =
    | "vfs_mounted"
    | "direct_stream"
    | "cached"
    | "downloading"
    | "uncached"
    | "unreleased"
    | "error"
    | "unknown";

export interface StreamItemSummary {
    id?: number | string | null;
    raw_title?: string | null;
    parsed_title?: string | null;
    resolution?: string | null;
    rank?: number | null;
    is_cached?: boolean | null;
    infohash?: string | null;
}

export interface MediaQualityMatrix {
    availability: {
        status: AvailabilityStatus;
        label: string;
        tone: AvailabilityTone;
        isInstant: boolean;
        isVfsReady: boolean;
    };
    resolution: {
        label: string | null;
        tierBadge: string | null;
        width?: number | null;
        height?: number | null;
        codec?: string | null;
        hdrType?: string | null;
        isRemux?: boolean;
        source?: string | null;
    };
    audio: {
        badge: string | null;
        codec?: string | null;
        channels?: number | null;
        channelLabel?: string | null;
        isAtmos?: boolean;
        isLossless?: boolean;
        trackCount?: number;
    };
    health: {
        status: "vfs_mounted" | "direct_stream" | "cached" | "downloading" | "error" | "none";
        label: string;
        variant: SpecVariant;
    };
}

export interface QualityBadgeItem {
    id: string;
    label?: string;
    value: string;
    variant: SpecVariant;
    glow?: boolean;
    tooltip?: string;
}

/**
 * Standardize video resolution label based on dimensions or raw text.
 */
export function parseResolution(input?: {
    width?: number | null;
    height?: number | null;
    resolution?: string | null;
}): string | null {
    if (!input) return null;
    const { width, height, resolution } = input;

    const w = typeof width === "number" && Number.isFinite(width) ? width : 0;
    const h = typeof height === "number" && Number.isFinite(height) ? height : 0;
    const longest = Math.max(w, h);

    if (longest >= 3840 || (w >= 3800 && h >= 1600)) return "4K";
    if (longest >= 2560) return "1440p";
    if (longest >= 1900 || (w >= 1900 && h >= 800)) return "1080p";
    if (longest >= 1280 || (w >= 1280 && h >= 500)) return "720p";
    if (longest >= 640) return "480p";

    if (resolution) {
        const cleaned = resolution.trim().toLowerCase();
        if (cleaned.includes("2160") || cleaned.includes("4k") || cleaned.includes("uhd"))
            return "4K";
        if (cleaned.includes("1440") || cleaned.includes("2k")) return "1440p";
        if (cleaned.includes("1080") || cleaned.includes("fhd")) return "1080p";
        if (cleaned.includes("720") || cleaned.includes("hd")) return "720p";
        if (cleaned.includes("480") || cleaned.includes("576") || cleaned.includes("sd"))
            return "480p";
    }

    return null;
}

/**
 * Normalize and detect HDR formats (Dolby Vision, HDR10+, HDR10, HDR).
 */
export function parseHdr(hdrType?: string | null, rawTitle?: string | null): string | null {
    const text = `${hdrType ?? ""} ${rawTitle ?? ""}`.trim();
    if (!text) return null;

    const hasDv = /\b(dovi|dolby\s*vision|\bdv\b)/i.test(text);
    const hasHdr10Plus = /(?:\bhdr10\+|\bhdr10plus\b)/i.test(text);
    const hasHdr10 = !hasHdr10Plus && /\bhdr10\b/i.test(text);
    const hasHdr = !hasHdr10Plus && !hasHdr10 && /\bhdr\b/i.test(text);

    if (hasDv && hasHdr10Plus) return "DV HDR10+";
    if (hasDv && (hasHdr10 || hasHdr)) return "DV HDR";
    if (hasDv) return "DV";
    if (hasHdr10Plus) return "HDR10+";
    if (hasHdr10) return "HDR10";
    if (hasHdr) return "HDR";

    return null;
}

/**
 * Detect release source and remux flags.
 */
export function parseSource(
    meta?: { quality_source?: string | null; is_remux?: boolean | null },
    rawTitle?: string | null
): { source: string | null; isRemux: boolean } {
    const title = rawTitle ?? "";
    const isRemux = Boolean(meta?.is_remux || /\bremux\b/i.test(title));

    if (meta?.quality_source) {
        return { source: meta.quality_source, isRemux };
    }

    if (/\bbluray\b|\bbdrip\b/i.test(title)) {
        return { source: "BluRay", isRemux };
    }
    if (/\bweb-?dl\b/i.test(title)) {
        return { source: "WEB-DL", isRemux };
    }
    if (/\bweb-?rip\b/i.test(title)) {
        return { source: "WEBRip", isRemux };
    }
    if (/\bhdtv\b/i.test(title)) {
        return { source: "HDTV", isRemux };
    }

    return { source: null, isRemux };
}

/**
 * Compose a concise resolution tier badge string (e.g., "4K DV Remux", "1080p Remux", "4K HDR").
 */
export function getResolutionTierBadge(options: {
    resolution: string | null;
    hdr: string | null;
    isRemux: boolean;
    source?: string | null;
}): string | null {
    const { resolution, hdr, isRemux, source } = options;
    if (!resolution && !hdr && !isRemux && !source) return null;

    const parts: string[] = [];

    if (resolution) {
        parts.push(resolution);
    }

    if (hdr) {
        parts.push(hdr);
    }

    if (isRemux) {
        parts.push("Remux");
    } else if (source && !resolution) {
        parts.push(source);
    }

    return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Parse audio track metadata and format highest-spec audio badge.
 */
export function parseAudioSpecs(
    audioTracks?: MediaMetadata["audio_tracks"],
    rawTitle?: string | null
): {
    badge: string | null;
    codec: string | null;
    channels: number | null;
    channelLabel: string | null;
    isAtmos: boolean;
    isLossless: boolean;
    trackCount: number;
} {
    const title = rawTitle ?? "";
    const hasTitleAtmos = /\batmos\b/i.test(title);

    if (audioTracks && audioTracks.length > 0) {
        // Find best track by priority: TrueHD/DTS-HD > DD+/E-AC3 > DTS > AC3 > AAC
        let bestTrack = audioTracks[0];
        let bestScore = -1;

        for (const track of audioTracks) {
            let score = 0;
            const codec = (track.codec ?? "").toLowerCase();
            const channels = track.channels ?? 2;

            if (codec.includes("truehd") || codec.includes("dts-hd") || codec.includes("dtshd")) {
                score = 50 + channels;
            } else if (
                codec.includes("eac3") ||
                codec.includes("e-ac-3") ||
                codec.includes("ddp")
            ) {
                score = 40 + channels;
            } else if (codec.includes("dts")) {
                score = 30 + channels;
            } else if (codec.includes("ac3") || codec.includes("ac-3") || codec.includes("dd")) {
                score = 20 + channels;
            } else if (codec.includes("flac")) {
                score = 35 + channels;
            } else {
                score = channels;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTrack = track;
            }
        }

        const rawCodec = bestTrack.codec ?? "";
        const channels = bestTrack.channels ?? null;
        const channelLabel =
            channels === 8
                ? "7.1"
                : channels === 6
                  ? "5.1"
                  : channels === 2
                    ? "2.0"
                    : channels
                      ? `${channels}ch`
                      : null;

        let displayCodec = rawCodec.toUpperCase();
        let isLossless = false;

        if (/truehd/i.test(rawCodec)) {
            displayCodec = "TrueHD";
            isLossless = true;
        } else if (/dts-hd\s*ma|dtshd_ma/i.test(rawCodec)) {
            displayCodec = "DTS-HD MA";
            isLossless = true;
        } else if (/dts-hd|dtshd/i.test(rawCodec)) {
            displayCodec = "DTS-HD";
            isLossless = true;
        } else if (/eac3|e-ac-3|ddp/i.test(rawCodec)) {
            displayCodec = "E-AC-3";
        } else if (/ac3|ac-3/i.test(rawCodec)) {
            displayCodec = "AC-3";
        } else if (/flac/i.test(rawCodec)) {
            displayCodec = "FLAC";
            isLossless = true;
        }

        const isAtmos = hasTitleAtmos || /\batmos\b/i.test(rawCodec);

        const badgeParts: string[] = [];
        if (displayCodec) badgeParts.push(displayCodec);
        if (channelLabel) badgeParts.push(channelLabel);
        if (isAtmos) badgeParts.push("Atmos");

        return {
            badge: badgeParts.length > 0 ? badgeParts.join(" ") : null,
            codec: displayCodec || null,
            channels,
            channelLabel,
            isAtmos,
            isLossless,
            trackCount: audioTracks.length
        };
    }

    // Fallback: title parsing
    const isAtmos = hasTitleAtmos;
    let codec: string | null = null;
    let isLossless = false;

    if (/\btruehd\b/i.test(title)) {
        codec = "TrueHD";
        isLossless = true;
    } else if (/\bdts-hd\s*ma\b/i.test(title)) {
        codec = "DTS-HD MA";
        isLossless = true;
    } else if (/\bdts:x\b/i.test(title)) {
        codec = "DTS:X";
        isLossless = true;
    } else if (/\bdts-hd\b/i.test(title)) {
        codec = "DTS-HD";
        isLossless = true;
    } else if (/\beac3|ddp|dd\+/i.test(title)) {
        codec = "E-AC-3";
    } else if (/\bdts\b/i.test(title)) {
        codec = "DTS";
    } else if (/\bac3|dd5\.1\b/i.test(title)) {
        codec = "AC-3";
    } else if (/\bflac\b/i.test(title)) {
        codec = "FLAC";
        isLossless = true;
    } else if (/\baac\b/i.test(title)) {
        codec = "AAC";
    }

    let channels: number | null = null;
    let channelLabel: string | null = null;
    if (/\b7\.1\b/i.test(title)) {
        channels = 8;
        channelLabel = "7.1";
    } else if (/\b5\.1\b/i.test(title)) {
        channels = 6;
        channelLabel = "5.1";
    } else if (/\b2\.0\b/i.test(title)) {
        channels = 2;
        channelLabel = "2.0";
    }

    const badgeParts: string[] = [];
    if (codec) badgeParts.push(codec);
    if (channelLabel) badgeParts.push(channelLabel);
    if (isAtmos) badgeParts.push("Atmos");

    return {
        badge: badgeParts.length > 0 ? badgeParts.join(" ") : null,
        codec,
        channels,
        channelLabel,
        isAtmos,
        isLossless,
        trackCount: codec ? 1 : 0
    };
}

/**
 * Classify availability state, instant cache status, and tone.
 */
export function getAvailabilityStatus(params: {
    state?: string | null;
    filesystem_entry?: FilesystemEntry | null;
    streams?: StreamItemSummary[] | null;
    is_cached?: boolean | null;
}): {
    status: AvailabilityStatus;
    label: string;
    tone: AvailabilityTone;
    isInstant: boolean;
    isVfsReady: boolean;
} {
    const { state, filesystem_entry, streams, is_cached } = params;

    // 1. Filesystem VFS mounted
    if (filesystem_entry?.available_in_vfs) {
        return {
            status: "vfs_mounted",
            label: "VFS Mounted",
            tone: "success",
            isInstant: true,
            isVfsReady: true
        };
    }

    // 2. Direct Stream URL active
    if (filesystem_entry?.unrestricted_url || filesystem_entry?.download_url) {
        return {
            status: "direct_stream",
            label: "Direct Stream",
            tone: "success",
            isInstant: true,
            isVfsReady: false
        };
    }

    // 3. Debrid instant cached stream detected
    const hasCachedStream =
        is_cached === true || Boolean(streams?.some((s) => s.is_cached === true));
    if (hasCachedStream) {
        return {
            status: "cached",
            label: "Instant Stream",
            tone: "success",
            isInstant: true,
            isVfsReady: false
        };
    }

    // 4. Lifecycle state mapping
    if (state) {
        const normState = state.toLowerCase();
        if (normState === "completed" || normState === "downloaded" || normState === "symlinked") {
            return {
                status: "cached",
                label: "Instant Stream",
                tone: "success",
                isInstant: true,
                isVfsReady: false
            };
        }
        if (normState === "downloading") {
            return {
                status: "downloading",
                label: "Downloading",
                tone: "warning",
                isInstant: false,
                isVfsReady: false
            };
        }
        if (normState === "unreleased") {
            return {
                status: "unreleased",
                label: "Unreleased",
                tone: "neutral",
                isInstant: false,
                isVfsReady: false
            };
        }
        if (normState === "failed" || normState === "error") {
            return {
                status: "error",
                label: "Provider Error",
                tone: "danger",
                isInstant: false,
                isVfsReady: false
            };
        }
    }

    // 5. Streams present but uncached
    if (streams && streams.length > 0) {
        return {
            status: "uncached",
            label: "Uncached",
            tone: "neutral",
            isInstant: false,
            isVfsReady: false
        };
    }

    return {
        status: "unknown",
        label: "Not Indexed",
        tone: "neutral",
        isInstant: false,
        isVfsReady: false
    };
}

/**
 * Determine the stream health pill representation.
 */
export function getStreamHealthPill(params: { status: AvailabilityStatus }): {
    status: "vfs_mounted" | "direct_stream" | "cached" | "downloading" | "error" | "none";
    label: string;
    variant: SpecVariant;
} {
    switch (params.status) {
        case "vfs_mounted":
            return { status: "vfs_mounted", label: "VFS Ready", variant: "resolution" };
        case "direct_stream":
            return { status: "direct_stream", label: "Direct Stream", variant: "codec" };
        case "cached":
            return { status: "cached", label: "Instant Stream", variant: "accent" };
        case "downloading":
            return { status: "downloading", label: "Downloading", variant: "hdr" };
        case "error":
            return { status: "error", label: "Stream Error", variant: "source" };
        default:
            return { status: "none", label: "No Stream", variant: "neutral" };
    }
}

/**
 * Comprehensive Media Quality Matrix extractor.
 */
export function extractQualityMatrix(params: {
    state?: string | null;
    media_metadata?: MediaMetadata | null;
    filesystem_entry?: FilesystemEntry | null;
    streams?: StreamItemSummary[] | null;
    rawTitle?: string | null;
    is_cached?: boolean | null;
}): MediaQualityMatrix {
    const meta = params.media_metadata;
    const video = meta?.video;
    const fallbackTitle =
        params.rawTitle ??
        meta?.filename ??
        meta?.original_filename ??
        params.filesystem_entry?.original_filename ??
        null;

    // Resolution & HDR
    const resolution = parseResolution({
        width: video?.resolution_width,
        height: video?.resolution_height,
        resolution: params.streams?.[0]?.resolution
    });
    const hdr = parseHdr(video?.hdr_type, fallbackTitle);
    const { source, isRemux } = parseSource(
        {
            quality_source: meta?.quality_source,
            is_remux: meta?.is_remux
        },
        fallbackTitle
    );
    const tierBadge = getResolutionTierBadge({ resolution, hdr, isRemux, source });

    // Audio
    const audio = parseAudioSpecs(meta?.audio_tracks, fallbackTitle);

    // Availability
    const availability = getAvailabilityStatus({
        state: params.state,
        filesystem_entry: params.filesystem_entry,
        streams: params.streams,
        is_cached: params.is_cached
    });

    // Health
    const health = getStreamHealthPill({ status: availability.status });

    return {
        availability,
        resolution: {
            label: resolution,
            tierBadge,
            width: video?.resolution_width,
            height: video?.resolution_height,
            codec: video?.codec,
            hdrType: hdr,
            isRemux,
            source
        },
        audio,
        health
    };
}

/**
 * Transform a MediaQualityMatrix into an ordered list of SpecBadge configurations.
 */
export function formatQualityBadges(
    matrix: MediaQualityMatrix,
    options?: {
        compact?: boolean;
        showHealth?: boolean;
    }
): QualityBadgeItem[] {
    const badges: QualityBadgeItem[] = [];
    const compact = options?.compact ?? false;

    // 1. Resolution / Tier Badge
    if (matrix.resolution.tierBadge) {
        badges.push({
            id: "resolution-tier",
            value: matrix.resolution.tierBadge,
            variant: matrix.resolution.label === "4K" ? "resolution" : "neutral",
            glow: matrix.resolution.label === "4K" || Boolean(matrix.resolution.hdrType),
            tooltip: `Video: ${matrix.resolution.tierBadge}`
        });
    } else if (matrix.resolution.label) {
        badges.push({
            id: "resolution",
            value: matrix.resolution.label,
            variant: "neutral",
            tooltip: `Resolution: ${matrix.resolution.label}`
        });
    }

    // 2. Audio Badge
    if (matrix.audio.badge) {
        badges.push({
            id: "audio",
            value: matrix.audio.badge,
            variant: matrix.audio.isLossless || matrix.audio.isAtmos ? "audio" : "neutral",
            glow: matrix.audio.isAtmos,
            tooltip: `Audio: ${matrix.audio.badge}`
        });
    }

    // 3. Health / Availability (if requested or in non-compact mode)
    if (options?.showHealth || (!compact && matrix.health.status !== "none")) {
        badges.push({
            id: "health",
            value: matrix.health.label,
            variant: matrix.health.variant,
            glow: matrix.availability.isInstant,
            tooltip: `Stream Status: ${matrix.availability.label}`
        });
    }

    return badges;
}
