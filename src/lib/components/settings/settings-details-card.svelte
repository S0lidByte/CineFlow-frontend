<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "$lib/utils";

    let {
        open = $bindable(false),
        title,
        subtitle,
        class: className,
        children
    }: {
        open?: boolean;
        title: string;
        subtitle?: string;
        class?: string;
        children?: Snippet;
    } = $props();
</script>

<details
    class={cn("border-border/60 bg-card/40 rounded-xl border p-3 md:p-4", className)}
    bind:open>
    <summary
        class="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        {#if subtitle}
            <span class="text-muted-foreground ml-2 text-xs font-normal">{subtitle}</span>
        {/if}
    </summary>
    <div class="mt-3 space-y-3">
        {@render children?.()}
    </div>
</details>
