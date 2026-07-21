<script lang="ts">
    import type { SectionTab } from "./sections";
    import { getTabGuide } from "./settings-tab-guides";
    import { ICON_MAP } from "./icon-map";
    import type { Component } from "svelte";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import Lightbulb from "@lucide/svelte/icons/lightbulb";
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import { cn } from "$lib/utils";

    interface Props {
        tab: SectionTab;
    }

    let { tab }: Props = $props();

    const guide = $derived(getTabGuide(tab.id));
    const IconComponent = $derived(ICON_MAP[tab.icon] as Component | undefined);

    let expanded = $state(false);
    let dialogOpen = $state(false);
</script>

{#if guide}
    <section
        class="border-primary/25 from-primary/12 via-primary/5 mb-5 overflow-hidden rounded-xl border bg-gradient-to-br to-transparent shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-primary)_22%,transparent)]"
        aria-label="{tab.label} guide">
        <div class="flex flex-wrap items-start gap-3 px-4 py-3.5">
            <span
                class="bg-primary/20 text-primary ring-primary/30 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1">
                {#if IconComponent}
                    <IconComponent class="size-4" />
                {:else}
                    <Sparkles class="size-4" />
                {/if}
            </span>

            <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-foreground text-sm font-semibold tracking-tight">
                        {tab.label} guide
                    </span>
                    {#if tab.restartRequired}
                        <Badge
                            class="border-amber-500/35 bg-amber-500/15 text-[10px] font-semibold tracking-wide text-amber-500 uppercase">
                            Restart required
                        </Badge>
                    {/if}
                </div>
                <p class="text-muted-foreground text-xs leading-relaxed md:text-[0.8125rem]">
                    {guide.headline}
                </p>
            </div>

            <div class="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                <button
                    type="button"
                    class="text-primary hover:text-primary/85 inline-flex items-center gap-1 text-xs font-semibold"
                    aria-expanded={expanded}
                    onclick={() => (expanded = !expanded)}>
                    Quick steps
                    <ChevronDown
                        class={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
                </button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="border-primary/30 bg-background/40 hover:bg-primary/10 h-8 gap-1.5 text-xs"
                    onclick={() => (dialogOpen = true)}>
                    <BookOpen class="size-3.5" />
                    Full guide
                </Button>
            </div>
        </div>

        {#if expanded}
            <div class="border-primary/15 bg-background/30 border-t px-4 py-3">
                <ol class="text-muted-foreground list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
                    {#each guide.howToUse as step, i (i)}
                        <li>{step}</li>
                    {/each}
                </ol>
                {#if guide.tips?.length}
                    <div class="mt-3 flex gap-2 rounded-lg border border-primary/15 bg-primary/5 p-2.5">
                        <Lightbulb class="text-primary mt-0.5 size-3.5 shrink-0" />
                        <ul class="text-muted-foreground space-y-1 text-xs">
                            {#each guide.tips as tip, i (i)}
                                <li>{tip}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        {/if}
    </section>

    <Dialog.Root bind:open={dialogOpen}>
        <Dialog.Content class="max-h-[85vh] max-w-lg overflow-y-auto">
            <Dialog.Header>
                <Dialog.Title class="flex items-center gap-2">
                    {#if IconComponent}
                        <IconComponent class="text-primary size-5" />
                    {/if}
                    {tab.label}
                </Dialog.Title>
                <Dialog.Description>{guide.headline}</Dialog.Description>
            </Dialog.Header>

            <div class="space-y-5 py-2 text-sm">
                <div>
                    <h3 class="text-foreground mb-2 flex items-center gap-2 font-semibold">
                        <BookOpen class="text-primary size-4" />
                        How to use
                    </h3>
                    <ol class="text-muted-foreground list-decimal space-y-2 pl-5">
                        {#each guide.howToUse as step, i (i)}
                            <li>{step}</li>
                        {/each}
                    </ol>
                </div>

                {#if guide.highlights?.length}
                    <div>
                        <h3 class="text-foreground mb-2 flex items-center gap-2 font-semibold">
                            <Sparkles class="text-primary size-4" />
                            Key concepts
                        </h3>
                        <dl class="space-y-2">
                            {#each guide.highlights as item, i (i)}
                                <div
                                    class="border-border/60 bg-muted/30 rounded-lg border px-3 py-2">
                                    <dt class="text-foreground font-medium">{item.title}</dt>
                                    <dd class="text-muted-foreground mt-0.5 text-xs">
                                        {item.detail}
                                    </dd>
                                </div>
                            {/each}
                        </dl>
                    </div>
                {/if}

                {#if guide.tips?.length}
                    <div>
                        <h3 class="text-foreground mb-2 flex items-center gap-2 font-semibold">
                            <Lightbulb class="text-primary size-4" />
                            Tips
                        </h3>
                        <ul class="text-muted-foreground list-disc space-y-1 pl-5">
                            {#each guide.tips as tip, i (i)}
                                <li>{tip}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                {#if guide.cautions?.length}
                    <div
                        class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                        <h3
                            class="mb-1.5 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                            <TriangleAlert class="size-4" />
                            Cautions
                        </h3>
                        <ul class="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                            {#each guide.cautions as caution, i (i)}
                                <li>{caution}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                <p class="text-muted-foreground border-border/50 border-t pt-3 text-xs">
                    Press <kbd
                        class="border-border bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]"
                        >Ctrl+K</kbd>
                    (or <kbd class="border-border bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]"
                        >⌘K</kbd>) anywhere on Settings to jump to a specific field.
                </p>
            </div>
        </Dialog.Content>
    </Dialog.Root>
{/if}
