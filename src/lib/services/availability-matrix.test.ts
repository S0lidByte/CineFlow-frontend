/**
 * Comprehensive Unit Test Suite for CineFlow Stream Availability & Media Quality Matrix (AVAIL-001).
 * Conforms to node:assert runner pattern in scripts/run_tests.ts.
 */

import assert from "node:assert/strict";
import {
    parseResolution,
    parseHdr,
    parseSource,
    getResolutionTierBadge,
    parseAudioSpecs,
    getAvailabilityStatus,
    getStreamHealthPill,
    extractQualityMatrix,
    formatQualityBadges
} from "./availability-matrix";

console.log("Running Stream Availability & Media Quality Matrix Unit Tests (AVAIL-001)...");

// =========================================================================
// 1. Resolution Parsing & Aspect Ratio Heuristics
// =========================================================================
{
    // Dimensions
    assert.equal(parseResolution({ width: 3840, height: 2160 }), "4K");
    assert.equal(
        parseResolution({ width: 3840, height: 1600 }),
        "4K",
        "Ultrawide 3840x1600 should be 4K"
    );
    assert.equal(parseResolution({ width: 2560, height: 1440 }), "1440p");
    assert.equal(parseResolution({ width: 1920, height: 1080 }), "1080p");
    assert.equal(
        parseResolution({ width: 1920, height: 800 }),
        "1080p",
        "Letterboxed 1920x800 should be 1080p"
    );
    assert.equal(parseResolution({ width: 1280, height: 720 }), "720p");
    assert.equal(parseResolution({ width: 640, height: 480 }), "480p");

    // String fallbacks
    assert.equal(parseResolution({ resolution: "2160p" }), "4K");
    assert.equal(parseResolution({ resolution: "4k uhd" }), "4K");
    assert.equal(parseResolution({ resolution: "1440p" }), "1440p");
    assert.equal(parseResolution({ resolution: "1080p" }), "1080p");
    assert.equal(parseResolution({ resolution: "720p" }), "720p");
    assert.equal(parseResolution({ resolution: "480p" }), "480p");
    assert.equal(parseResolution({ resolution: "invalid" }), null);
    assert.equal(parseResolution(undefined), null);
}

// =========================================================================
// 2. HDR & Dolby Vision Detection
// =========================================================================
{
    assert.equal(parseHdr("DolbyVision"), "DV");
    assert.equal(parseHdr("DoVi"), "DV");
    assert.equal(
        parseHdr(null, "Dune.Part.Two.2024.UHD.BluRay.2160p.TrueHD.Atmos.7.1.DV.HEVC-REMUX"),
        "DV"
    );
    assert.equal(parseHdr("HDR10+"), "HDR10+");
    assert.equal(parseHdr("HDR10"), "HDR10");
    assert.equal(parseHdr("HDR"), "HDR");
    assert.equal(parseHdr("DV+HDR10+"), "DV HDR10+");
    assert.equal(parseHdr("DV+HDR10"), "DV HDR");
    assert.equal(parseHdr(null, "Oppenheimer.2023.2160p.HDR10.x265"), "HDR10");
    assert.equal(parseHdr(null, "SDR.1080p.x264"), null);
    assert.equal(parseHdr(null, null), null);
}

// =========================================================================
// 3. Source & Remux Detection
// =========================================================================
{
    const remuxMeta = parseSource({ is_remux: true, quality_source: "BluRay" }, null);
    assert.equal(remuxMeta.isRemux, true);
    assert.equal(remuxMeta.source, "BluRay");

    const titleRemux = parseSource({}, "The.Matrix.1999.2160p.UHD.Remux.HEVC.TrueHD.Atmos");
    assert.equal(titleRemux.isRemux, true);
    assert.equal(titleRemux.source, null);

    const webDl = parseSource({}, "Severance.S02E01.2160p.WEB-DL.DDP5.1.Atmos.H.265");
    assert.equal(webDl.isRemux, false);
    assert.equal(webDl.source, "WEB-DL");
}

// =========================================================================
// 4. Resolution Tier Badge Composition
// =========================================================================
{
    assert.equal(
        getResolutionTierBadge({ resolution: "4K", hdr: "DV", isRemux: true }),
        "4K DV Remux"
    );
    assert.equal(
        getResolutionTierBadge({ resolution: "4K", hdr: "HDR", isRemux: false }),
        "4K HDR"
    );
    assert.equal(
        getResolutionTierBadge({ resolution: "1080p", hdr: null, isRemux: true }),
        "1080p Remux"
    );
    assert.equal(
        getResolutionTierBadge({ resolution: "1080p", hdr: null, isRemux: false }),
        "1080p"
    );
    assert.equal(getResolutionTierBadge({ resolution: "720p", hdr: null, isRemux: false }), "720p");
    assert.equal(
        getResolutionTierBadge({ resolution: null, hdr: null, isRemux: false, source: "BluRay" }),
        "BluRay"
    );
    assert.equal(getResolutionTierBadge({ resolution: null, hdr: null, isRemux: false }), null);
}

// =========================================================================
// 5. Audio Channel & Codec Flags
// =========================================================================
{
    // Multiple tracks - TrueHD preferred over AAC
    const audioMulti = parseAudioSpecs(
        [
            { codec: "aac", channels: 2, language: "eng" },
            { codec: "truehd", channels: 8, language: "eng" }
        ],
        "Blade.Runner.2049.2160p.UHD.BluRay.TrueHD.7.1.Atmos"
    );
    assert.equal(audioMulti.codec, "TrueHD");
    assert.equal(audioMulti.channels, 8);
    assert.equal(audioMulti.channelLabel, "7.1");
    assert.equal(audioMulti.isAtmos, true);
    assert.equal(audioMulti.isLossless, true);
    assert.equal(audioMulti.badge, "TrueHD 7.1 Atmos");

    // DTS-HD MA
    const audioDts = parseAudioSpecs(
        [{ codec: "dts-hd ma", channels: 6, language: "eng" }],
        "Interstellar.2014.1080p.BluRay.DTS-HD.MA.5.1"
    );
    assert.equal(audioDts.codec, "DTS-HD MA");
    assert.equal(audioDts.channelLabel, "5.1");
    assert.equal(audioDts.isLossless, true);
    assert.equal(audioDts.badge, "DTS-HD MA 5.1");

    // Title fallback
    const titleAudio = parseAudioSpecs(undefined, "Gladiator.2000.2160p.Remux.DTS:X.7.1");
    assert.equal(titleAudio.codec, "DTS:X");
    assert.equal(titleAudio.channelLabel, "7.1");
    assert.equal(titleAudio.badge, "DTS:X 7.1");
}

// =========================================================================
// 6. Availability & Debrid Instant Cache Status
// =========================================================================
{
    // 1. VFS Mounted
    const vfs = getAvailabilityStatus({
        filesystem_entry: { available_in_vfs: true }
    });
    assert.equal(vfs.status, "vfs_mounted");
    assert.equal(vfs.isInstant, true);
    assert.equal(vfs.isVfsReady, true);
    assert.equal(vfs.tone, "success");

    // 2. Direct Stream
    const direct = getAvailabilityStatus({
        filesystem_entry: { unrestricted_url: "https://real-debrid.com/d/xyz" }
    });
    assert.equal(direct.status, "direct_stream");
    assert.equal(direct.isInstant, true);
    assert.equal(direct.tone, "success");

    // 3. Instant Cache
    const cached = getAvailabilityStatus({
        streams: [{ id: 1, is_cached: true }]
    });
    assert.equal(cached.status, "cached");
    assert.equal(cached.isInstant, true);
    assert.equal(cached.label, "Instant Stream");

    // 4. Downloading
    const downloading = getAvailabilityStatus({
        state: "Downloading"
    });
    assert.equal(downloading.status, "downloading");
    assert.equal(downloading.isInstant, false);
    assert.equal(downloading.tone, "warning");

    // 5. Unreleased
    const unreleased = getAvailabilityStatus({
        state: "Unreleased"
    });
    assert.equal(unreleased.status, "unreleased");
    assert.equal(unreleased.isInstant, false);

    // 6. Error
    const error = getAvailabilityStatus({
        state: "Failed"
    });
    assert.equal(error.status, "error");
    assert.equal(error.tone, "danger");

    // 7. Uncached
    const uncached = getAvailabilityStatus({
        streams: [{ id: 1, is_cached: false }]
    });
    assert.equal(uncached.status, "uncached");
    assert.equal(uncached.label, "Uncached");
}

// =========================================================================
// 7. Stream Health Pills
// =========================================================================
{
    assert.equal(getStreamHealthPill({ status: "vfs_mounted" }).label, "VFS Ready");
    assert.equal(getStreamHealthPill({ status: "vfs_mounted" }).variant, "resolution");
    assert.equal(getStreamHealthPill({ status: "direct_stream" }).label, "Direct Stream");
    assert.equal(getStreamHealthPill({ status: "cached" }).label, "Instant Stream");
    assert.equal(getStreamHealthPill({ status: "downloading" }).label, "Downloading");
    assert.equal(getStreamHealthPill({ status: "error" }).label, "Stream Error");
    assert.equal(getStreamHealthPill({ status: "unknown" }).label, "No Stream");
}

// =========================================================================
// 8. Composite Media Quality Matrix Extraction
// =========================================================================
{
    const matrix = extractQualityMatrix({
        state: "Completed",
        media_metadata: {
            video: {
                resolution_width: 3840,
                resolution_height: 2160,
                hdr_type: "DolbyVision",
                codec: "hevc"
            },
            audio_tracks: [{ codec: "truehd", channels: 8, language: "eng" }],
            is_remux: true,
            quality_source: "BluRay",
            filename: "Civil.War.2024.UHD.BluRay.2160p.TrueHD.Atmos.7.1.DV.HEVC-REMUX.mkv"
        },
        filesystem_entry: {
            available_in_vfs: true,
            original_filename: "Civil.War.2024.UHD.BluRay.2160p.TrueHD.Atmos.7.1.DV.HEVC-REMUX.mkv"
        }
    });

    assert.equal(matrix.availability.status, "vfs_mounted");
    assert.equal(matrix.availability.isVfsReady, true);
    assert.equal(matrix.resolution.tierBadge, "4K DV Remux");
    assert.equal(matrix.audio.badge, "TrueHD 7.1 Atmos");
    assert.equal(matrix.health.status, "vfs_mounted");

    // Format badges
    const badges = formatQualityBadges(matrix, { compact: false, showHealth: true });
    assert.equal(badges.length, 3);
    assert.equal(badges[0].id, "resolution-tier");
    assert.equal(badges[0].value, "4K DV Remux");
    assert.equal(badges[1].id, "audio");
    assert.equal(badges[1].value, "TrueHD 7.1 Atmos");
    assert.equal(badges[2].id, "health");
    assert.equal(badges[2].value, "VFS Ready");
}

console.log("AVAIL-001 Stream Availability & Quality Matrix Unit Tests passed successfully.");
