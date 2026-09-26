<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import type { TrashCustomFormat } from "$lib/services/trash-ranking";
    import { getCategoryLabel, getCategoryBadgeClass } from "$lib/services/trash-ranking";
    import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
    import XCircle from "@lucide/svelte/icons/x-circle";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import FileCode2 from "@lucide/svelte/icons/file-code-2";

    interface Props {
        open?: boolean;
        format: TrashCustomFormat | null;
        onOpenChange?: (open: boolean) => void;
    }

    let { open = $bindable(false), format, onOpenChange }: Props = $props();

    function handleOpenChange(nextOpen: boolean) {
        open = nextOpen;
        onOpenChange?.(nextOpen);
    }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
    <Dialog.Content
        class="text-foreground border-white/10 bg-slate-950/95 backdrop-blur-xl sm:max-w-2xl">
        <Dialog.Header class="space-y-2">
            <div class="flex items-center gap-2">
                {#if format}
                    <Badge variant="outline" class={getCategoryBadgeClass(format.category)}>
                        {getCategoryLabel(format.category)}
                    </Badge>
                    <Badge variant="secondary" class="font-mono text-xs">
                        ID: {format.trash_id}
                    </Badge>
                    {#if format.default_score < 0}
                        <Badge variant="destructive" class="gap-1 font-mono text-xs">
                            <ShieldAlert class="size-3" />
                            Penalty ({format.default_score})
                        </Badge>
                    {:else}
                        <Badge
                            variant="default"
                            class="border border-emerald-500/30 bg-emerald-500/20 font-mono text-xs text-emerald-400">
                            +{format.default_score} pts
                        </Badge>
                    {/if}
                {/if}
            </div>
            <Dialog.Title class="text-xl font-bold tracking-tight">
                {format?.name || "Custom Format Details"}
            </Dialog.Title>
            <Dialog.Description class="text-muted-foreground text-sm leading-relaxed">
                {format?.description || "No description provided."}
            </Dialog.Description>
        </Dialog.Header>

        {#if format}
            <div class="mt-4 space-y-4">
                <div
                    class="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
                    <div>
                        <span class="text-muted-foreground">Default Score:</span>
                        <span
                            class="ml-1.5 font-mono font-semibold {format.default_score < 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'}">
                            {format.default_score > 0
                                ? `+${format.default_score}`
                                : format.default_score}
                        </span>
                    </div>
                    <div>
                        <span class="text-muted-foreground">Configured Score:</span>
                        <span class="text-primary ml-1.5 font-mono font-semibold">
                            {format.score ?? format.default_score}
                        </span>
                    </div>
                    <div>
                        <span class="text-muted-foreground">Status:</span>
                        <span
                            class="ml-1.5 font-semibold {format.enabled
                                ? 'text-emerald-400'
                                : 'text-muted-foreground'}">
                            {format.enabled ? "Active" : "Disabled"}
                        </span>
                    </div>
                </div>

                <div class="space-y-2">
                    <h4
                        class="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                        <FileCode2 class="text-primary size-3.5" />
                        Matching Conditions ({format.conditions?.length || 0})
                    </h4>

                    {#if format.conditions && format.conditions.length > 0}
                        <div class="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                            {#each format.conditions as condition, i (i)}
                                <div
                                    class="space-y-1.5 rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs">
                                    <div class="flex items-center justify-between">
                                        <div
                                            class="text-foreground flex items-center gap-1.5 font-medium">
                                            {#if condition.negate}
                                                <XCircle class="size-3.5 text-rose-400" />
                                                <span class="font-semibold text-rose-400"
                                                    >MUST NOT MATCH:</span>
                                            {:else}
                                                <CheckCircle2 class="size-3.5 text-emerald-400" />
                                                <span class="font-semibold text-emerald-400"
                                                    >MUST MATCH:</span>
                                            {/if}
                                            <span>{condition.name}</span>
                                        </div>
                                        {#if condition.required}
                                            <Badge
                                                variant="outline"
                                                class="border-amber-500/30 px-1.5 py-0 font-mono text-[10px] text-amber-400 uppercase">
                                                Required
                                            </Badge>
                                        {/if}
                                    </div>
                                    <div
                                        class="rounded border border-white/5 bg-black/40 p-2 font-mono text-[11px] break-all text-sky-300 select-all">
                                        {condition.pattern}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="text-muted-foreground text-xs italic">
                            No condition rules defined for this format.
                        </p>
                    {/if}
                </div>
            </div>
        {/if}

        <Dialog.Footer class="mt-6 flex justify-end">
            <Button variant="outline" size="sm" onclick={() => handleOpenChange(false)}>
                Close
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
