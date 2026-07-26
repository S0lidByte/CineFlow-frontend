<script lang="ts">
    /**
     * Settings connection probes for third-party integrations.
     * Uses BFF routes only — never exposes BACKEND_API_KEY to the browser.
     * Soft-fails like dashboard service badges when the probe errors.
     */
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { toast } from "svelte-sonner";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import PlugZap from "@lucide/svelte/icons/plug-zap";

    export type ConnectionService =
        | "real_debrid"
        | "plex"
        | "jackett"
        | "prowlarr"
        | "opensubtitles"
        | "subdl";

    type ProbeResult = {
        ok: boolean;
        latency_ms: number;
        message: string;
    };

    type ProbeState = "idle" | "loading" | "ok" | "fail";

    type ServiceRow = {
        id: ConnectionService;
        label: string;
        hint: string;
    };

    let { services }: { services: ServiceRow[] } = $props();

    let states = $state<Record<string, ProbeState>>({});
    let results = $state<Record<string, ProbeResult | null>>({});

    function badgeVariant(state: ProbeState): "secondary" | "default" | "destructive" {
        if (state === "ok") return "default";
        if (state === "fail") return "destructive";
        return "secondary";
    }

    function badgeLabel(id: string): string {
        const state = states[id] ?? "idle";
        const result = results[id];
        if (state === "loading") return "Testing…";
        if (state === "ok") {
            const ms = result?.latency_ms != null ? ` · ${result.latency_ms}ms` : "";
            return `OK${ms}`;
        }
        if (state === "fail") return "Failed";
        return "Not tested";
    }

    async function testOne(id: ConnectionService) {
        states[id] = "loading";
        results[id] = null;
        try {
            const res = await fetch(`/api/settings/test-connection/${id}`, {
                method: "POST"
            });
            const data = (await res.json().catch(() => null)) as ProbeResult | null;
            if (!data || typeof data.ok !== "boolean") {
                states[id] = "fail";
                results[id] = {
                    ok: false,
                    latency_ms: 0,
                    message: "Probe failed"
                };
                toast.error(`${id}: probe failed`);
                return;
            }
            states[id] = data.ok ? "ok" : "fail";
            results[id] = data;
            if (data.ok) {
                toast.success(data.message || "Connected");
            } else {
                toast.error(data.message || "Connection failed");
            }
        } catch {
            states[id] = "fail";
            results[id] = { ok: false, latency_ms: 0, message: "Probe failed" };
            toast.error("Connection test failed");
        }
    }
</script>

{#if services.length > 0}
    <div class="border-border/60 bg-card/40 mb-4 space-y-3 rounded-xl border p-4">
        <div class="space-y-1">
            <h3 class="text-sm font-semibold">Connection tests</h3>
            <p class="text-muted-foreground text-xs">
                Probe saved credentials for this section. Uses a short timeout and never shows
                secrets. Save settings first if you just changed keys or URLs.
            </p>
        </div>

        <ul class="space-y-2">
            {#each services as svc (svc.id)}
                {@const state = states[svc.id] ?? "idle"}
                {@const result = results[svc.id]}
                <li
                    class="border-border/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-medium">{svc.label}</span>
                            <Badge
                                variant={badgeVariant(state)}
                                class={state === "ok"
                                    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : undefined}>
                                {badgeLabel(svc.id)}
                            </Badge>
                        </div>
                        <p class="text-muted-foreground text-xs">
                            {#if result?.message && state !== "idle"}
                                {result.message}
                            {:else}
                                {svc.hint}
                            {/if}
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={state === "loading"}
                        onclick={() => void testOne(svc.id)}>
                        {#if state === "loading"}
                            <Loader2 class="size-3.5 animate-spin" />
                            Testing
                        {:else}
                            <PlugZap class="size-3.5" />
                            Test
                        {/if}
                    </Button>
                </li>
            {/each}
        </ul>
    </div>
{/if}
