<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "$lib/utils";

    let {
        class: className,
        left,
        actions
    }: {
        class?: string;
        left?: Snippet;
        actions?: Snippet;
    } = $props();
</script>

<div class={cn("flex flex-wrap items-center gap-2", className)}>
    {#if left}
        {@render left()}
    {/if}
    {#if actions}
        <div class="ml-auto flex flex-wrap gap-2">
            {@render actions()}
        </div>
    {/if}
</div>
