<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "$lib/utils";

    let {
        class: className,
        children
    }: {
        class?: string;
        children?: Snippet;
    } = $props();
</script>

<div class={cn("border-border/60 bg-card/40 rounded-xl border p-3 md:p-4", className)}>
    {@render children?.()}
</div>
