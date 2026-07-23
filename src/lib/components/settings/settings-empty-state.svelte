<script lang="ts">
    import type { Component, Snippet } from "svelte";
    import { cn } from "$lib/utils";

    let {
        icon: Icon,
        title,
        class: className,
        action
    }: {
        icon: Component;
        title: string;
        class?: string;
        action?: Snippet;
    } = $props();
</script>

<div
    class={cn(
        "border-border/50 bg-card/30 flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center",
        className
    )}>
    <Icon class="text-muted-foreground size-8 opacity-50" />
    <p class="text-muted-foreground text-sm">{title}</p>
    {#if action}
        {@render action()}
    {/if}
</div>
