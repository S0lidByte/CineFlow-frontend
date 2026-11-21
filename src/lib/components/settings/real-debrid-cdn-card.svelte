<script lang="ts">
    /**
     * Diagnostic guidance card for Real-Debrid CDN configuration.
     * Recommends setting Real-Debrid CDN to Cloudflare to prevent chunk contention
     * and buffering on 4K / Remux direct streaming playback.
     */
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
    import ExternalLink from "@lucide/svelte/icons/external-link";
    import Gauge from "@lucide/svelte/icons/gauge";
</script>

<div class="border-border/60 bg-card/40 mb-4 space-y-3 rounded-xl border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
            <div class="rounded-lg bg-amber-500/10 p-2 text-amber-500 dark:bg-amber-500/15">
                <CloudLightning class="size-4" />
            </div>
            <div class="space-y-0.5">
                <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-sm font-semibold">Real-Debrid CDN Optimization</h3>
                    <Badge
                        variant="outline"
                        class="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        4K / Remux Recommended
                    </Badge>
                </div>
                <p class="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                    For smooth 4K Remux playback without buffering, verify that your Real-Debrid
                    account uses
                    <strong class="text-foreground font-medium">Cloudflare CDN</strong>. Default
                    direct servers (OVH / Online.net) frequently rate-limit concurrent range
                    requests and halve multi-worker throughput, whereas Cloudflare provides global
                    edge peering with full sequential line-speed.
                </p>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                class="h-8 gap-1.5 text-xs"
                href="https://real-debrid.com/speedtest"
                target="_blank"
                rel="noreferrer noopener">
                <Gauge class="size-3.5" />
                <span>Run Speedtest</span>
                <ExternalLink class="size-3 opacity-60" />
            </Button>
            <Button
                type="button"
                size="sm"
                variant="outline"
                class="border-primary/30 text-primary hover:bg-primary/10 h-8 gap-1.5 text-xs"
                href="https://real-debrid.com/account"
                target="_blank"
                rel="noreferrer noopener">
                <CloudLightning class="size-3.5" />
                <span>Account CDN Settings</span>
                <ExternalLink class="size-3 opacity-60" />
            </Button>
        </div>
    </div>

    <div
        class="bg-muted/40 text-muted-foreground border-border/40 space-y-1.5 rounded-lg border p-3 text-xs">
        <div class="text-foreground text-[11px] font-medium tracking-wider uppercase">
            Quick Setup Steps:
        </div>
        <ol class="list-inside list-decimal space-y-1 text-xs">
            <li>
                Run the <a
                    href="https://real-debrid.com/speedtest"
                    target="_blank"
                    rel="noreferrer noopener"
                    class="text-primary font-medium hover:underline">Real-Debrid Speedtest</a>
                to benchmark Cloudflare edge latency against direct CDNs.
            </li>
            <li>
                In <a
                    href="https://real-debrid.com/account"
                    target="_blank"
                    rel="noreferrer noopener"
                    class="text-primary font-medium hover:underline">Real-Debrid Account Settings</a
                >, find <strong>CDN Servers Selection</strong> and select
                <strong>Cloudflare</strong>.
            </li>
            <li>
                In <strong>Operations &gt; Stream</strong> settings, leave
                <strong>Parallel Prefetch Workers</strong>
                set to <strong>1</strong> (single sequential stream) to prevent range chunk contention.
            </li>
        </ol>
    </div>
</div>
