<script lang="ts">
    import type { Snippet } from "svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { cn } from "$lib/utils";
    import Check from "@lucide/svelte/icons/check";
    import Loader2 from "@lucide/svelte/icons/loader-2";

    export type StatusBadgeVariant = "unsaved" | "saved" | "warning" | "neutral" | "loading";

    let {
        variant = "neutral",
        label,
        class: className,
        children
    }: {
        variant?: StatusBadgeVariant;
        label: string;
        class?: string;
        children?: Snippet;
    } = $props();

    const variantClass = $derived(
        {
            unsaved: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
            saved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            warning: "border-amber-500/30 bg-amber-500/20 text-amber-600 dark:text-amber-400",
            neutral: "",
            loading: "text-muted-foreground"
        }[variant]
    );
</script>

{#if variant === "neutral" || variant === "loading"}
    <Badge variant="outline" class={cn("text-xs", variantClass, className)} aria-live="polite">
        {#if variant === "loading"}
            <Loader2 class="mr-1 size-3 animate-spin" />
        {:else if children}
            {@render children()}
        {/if}
        {label}
    </Badge>
{:else}
    <Badge class={cn("text-xs", variantClass, className)} aria-live="polite">
        {#if variant === "saved"}
            <Check class="mr-1 size-3" />
        {:else if children}
            {@render children()}
        {/if}
        {label}
    </Badge>
{/if}
