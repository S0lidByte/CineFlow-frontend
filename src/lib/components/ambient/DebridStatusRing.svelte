<script lang="ts">
    import { cn } from "$lib/utils";

    export type DebridState =
        | "cached"
        | "instant"
        | "available"
        | "downloading"
        | "processing"
        | "uncached"
        | "unavailable"
        | "error"
        | "failed"
        | "loading"
        | "unknown";

    export type RingSize = "xs" | "sm" | "default" | "lg" | "xl";

    interface Props {
        status?: DebridState;
        progress?: number; // 0..100 for downloading/processing
        size?: RingSize;
        showLabel?: boolean;
        label?: string;
        glow?: boolean;
        class?: string;
    }

    let {
        status = "unknown",
        progress,
        size = "default",
        showLabel = false,
        label: customLabel,
        glow = true,
        class: className = ""
    }: Props = $props();

    const sizePxMap: Record<RingSize, number> = {
        xs: 16,
        sm: 20,
        default: 24,
        lg: 32,
        xl: 40
    };

    const strokeWidthMap: Record<RingSize, number> = {
        xs: 2,
        sm: 2.2,
        default: 2.5,
        lg: 3,
        xl: 3.5
    };

    type NormalizedDebridStatus =
        | "cached"
        | "downloading"
        | "uncached"
        | "error"
        | "loading"
        | "unknown";

    const normalizedStatus = $derived.by<NormalizedDebridStatus>(() => {
        switch (status) {
            case "cached":
            case "instant":
            case "available":
                return "cached";
            case "downloading":
            case "processing":
                return "downloading";
            case "uncached":
            case "unavailable":
                return "uncached";
            case "error":
            case "failed":
                return "error";
            case "loading":
                return "loading";
            default:
                return "unknown";
        }
    });

    const effectiveLabel = $derived.by(() => {
        if (customLabel) return customLabel;
        switch (normalizedStatus) {
            case "cached":
                return "Instant Stream Available";
            case "downloading":
                return progress != null
                    ? `Downloading (${Math.round(progress)}%)`
                    : "Downloading to Debrid";
            case "uncached":
                return "Uncached (Requires Download)";
            case "error":
                return "Debrid Provider Error";
            case "loading":
                return "Checking Availability";
            default:
                return "Debrid Status Unknown";
        }
    });

    const px = $derived(sizePxMap[size]);
    const strokeWidth = $derived(strokeWidthMap[size]);
    const radius = $derived((px - strokeWidth) / 2);
    const circumference = $derived(2 * Math.PI * radius);

    const strokeDashoffset = $derived.by(() => {
        if (normalizedStatus === "cached") return 0;
        if (normalizedStatus === "downloading" && progress != null) {
            const clamped = Math.max(0, Math.min(100, progress));
            return circumference - (clamped / 100) * circumference;
        }
        if (normalizedStatus === "uncached") {
            return circumference * 0.4; // Partial dashed arc
        }
        return 0;
    });

    const colorClasses: Record<
        NormalizedDebridStatus,
        { ring: string; track: string; glow: string; text: string }
    > = {
        cached: {
            ring: "stroke-emerald-400",
            track: "stroke-emerald-950/60",
            glow: "drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]",
            text: "text-emerald-400"
        },
        downloading: {
            ring: "stroke-sky-400",
            track: "stroke-sky-950/60",
            glow: "drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]",
            text: "text-sky-400"
        },
        uncached: {
            ring: "stroke-amber-400/80",
            track: "stroke-amber-950/40",
            glow: "drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]",
            text: "text-amber-400"
        },
        error: {
            ring: "stroke-rose-500",
            track: "stroke-rose-950/60",
            glow: "drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]",
            text: "text-rose-400"
        },
        loading: {
            ring: "stroke-indigo-400",
            track: "stroke-indigo-950/60",
            glow: "drop-shadow-[0_0_6px_rgba(129,140,248,0.4)]",
            text: "text-indigo-400"
        },
        unknown: {
            ring: "stroke-slate-500",
            track: "stroke-slate-900/60",
            glow: "",
            text: "text-slate-400"
        }
    };
</script>

<div
    class={cn("inline-flex items-center gap-2 select-none", className)}
    role="status"
    aria-label={effectiveLabel}>
    <div class="relative flex items-center justify-center" style="width: {px}px; height: {px}px;">
        <svg
            width={px}
            height={px}
            viewBox="0 0 {px} {px}"
            class={cn(
                "origin-center -rotate-90 transform transition-transform",
                normalizedStatus === "loading" && "animate-spin motion-reduce:animate-none",
                glow && colorClasses[normalizedStatus].glow
            )}
            aria-hidden="true">
            <!-- Background Track -->
            <circle
                cx={px / 2}
                cy={px / 2}
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class={colorClasses[normalizedStatus].track} />

            <!-- Active Status Arc -->
            <circle
                cx={px / 2}
                cy={px / 2}
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                stroke-linecap="round"
                stroke-dasharray={circumference}
                stroke-dashoffset={strokeDashoffset}
                class={cn(
                    colorClasses[normalizedStatus].ring,
                    "transition-all duration-500 ease-out",
                    normalizedStatus === "downloading" &&
                        progress == null &&
                        "animate-pulse motion-reduce:animate-none"
                )} />
        </svg>

        <!-- Center Glyph / Icon for Accessible Shape-Based Distinction -->
        <div
            class="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true">
            {#if normalizedStatus === "cached"}
                <!-- Small check dot -->
                <div
                    class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]">
                </div>
            {:else if normalizedStatus === "error"}
                <!-- Small alert cross / dot -->
                <div class="h-1.5 w-1.5 rounded-full bg-rose-500"></div>
            {:else if normalizedStatus === "downloading" && progress != null && size !== "xs" && size !== "sm"}
                <span
                    class="font-mono text-[9px] leading-none font-bold {colorClasses[
                        normalizedStatus
                    ].text}">
                    {Math.round(progress)}
                </span>
            {/if}
        </div>
    </div>

    {#if showLabel}
        <span class="text-xs font-medium {colorClasses[normalizedStatus].text}">
            {effectiveLabel}
        </span>
    {/if}
</div>
