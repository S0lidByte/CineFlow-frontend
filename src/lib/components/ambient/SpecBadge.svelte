<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "$lib/utils";

    export type SpecVariant =
        | "resolution"
        | "hdr"
        | "audio"
        | "codec"
        | "source"
        | "accent"
        | "neutral";

    export type SpecSize = "xs" | "sm" | "default" | "lg";

    interface Props {
        label?: string;
        value?: string | number | null;
        variant?: SpecVariant;
        size?: SpecSize;
        glow?: boolean;
        class?: string;
        children?: Snippet;
    }

    let {
        label,
        value,
        variant = "neutral",
        size = "default",
        glow = false,
        class: className = "",
        children
    }: Props = $props();

    const sizeClasses: Record<SpecSize, string> = {
        xs: "px-1.5 py-0.2 text-[10px] tracking-tight gap-1",
        sm: "px-2 py-0.5 text-xs tracking-tight gap-1.5",
        default: "px-2.5 py-1 text-xs tracking-wide gap-1.5",
        lg: "px-3 py-1.5 text-sm tracking-wide gap-2 font-medium"
    };

    const variantClasses: Record<SpecVariant, string> = {
        resolution:
            "bg-emerald-950/60 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50",
        hdr: "bg-amber-950/60 text-amber-300 border-amber-500/30 hover:border-amber-500/50",
        audio: "bg-indigo-950/60 text-indigo-300 border-indigo-500/30 hover:border-indigo-500/50",
        codec: "bg-sky-950/60 text-sky-300 border-sky-500/30 hover:border-sky-500/50",
        source: "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-500/30 hover:border-fuchsia-500/50",
        accent: "bg-background/80 text-foreground border-white/20 hover:border-white/40",
        neutral: "bg-slate-900/60 text-slate-300 border-white/10 hover:border-white/20"
    };

    const glowClasses: Record<SpecVariant, string> = {
        resolution: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
        hdr: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
        audio: "shadow-[0_0_12px_rgba(99,102,241,0.25)]",
        codec: "shadow-[0_0_12px_rgba(14,165,233,0.25)]",
        source: "shadow-[0_0_12px_rgba(217,70,239,0.25)]",
        accent: "shadow-[0_0_12px_var(--ambient-glow-1,rgba(255,255,255,0.15))]",
        neutral: "shadow-[0_0_8px_rgba(255,255,255,0.05)]"
    };

    const displayText = $derived(value != null && value !== "" ? String(value) : "");
</script>

{#if displayText || children || label}
    <span
        class={cn(
            "inline-flex items-center justify-center rounded-md border font-mono backdrop-blur-md transition-all duration-200 select-none",
            sizeClasses[size],
            variantClasses[variant],
            glow && glowClasses[variant],
            className
        )}
        aria-label={label ? `${label}: ${displayText || "Active"}` : displayText}>
        {#if label}
            <span class="text-muted-foreground/80 font-sans text-[0.85em] font-semibold uppercase">
                {label}
            </span>
        {/if}

        {#if displayText}
            <span>{displayText}</span>
        {/if}

        {#if children}
            {@render children()}
        {/if}
    </span>
{/if}
