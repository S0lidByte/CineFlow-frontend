<script lang="ts">
    /**
     * Trakt OAuth connect chrome for Settings → Content.
     * Uses BFF routes only — never exposes BACKEND_API_KEY to the browser.
     */
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button/index.js";
    import { toast } from "svelte-sonner";
    import Link2 from "@lucide/svelte/icons/link-2";
    import Unlink from "@lucide/svelte/icons/unlink";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import ExternalLink from "@lucide/svelte/icons/external-link";

    type Status = {
        connected: boolean;
        has_client_id: boolean;
        has_client_secret: boolean;
        redirect_uri: string;
        redirect_uri_hint: string;
    };

    let status = $state<Status | null>(null);
    let loading = $state(true);
    let disconnecting = $state(false);
    let origin = $state("");

    async function refreshStatus() {
        loading = true;
        try {
            const res = await fetch("/api/trakt/oauth/status");
            if (!res.ok) {
                status = null;
                return;
            }
            status = (await res.json()) as Status;
        } catch {
            status = null;
        } finally {
            loading = false;
        }
    }

    async function disconnect() {
        disconnecting = true;
        try {
            const res = await fetch("/api/trakt/oauth/disconnect", { method: "POST" });
            if (!res.ok) {
                toast.error("Failed to disconnect Trakt");
                return;
            }
            toast.success("Trakt disconnected");
            await refreshStatus();
        } catch {
            toast.error("Failed to disconnect Trakt");
        } finally {
            disconnecting = false;
        }
    }

    onMount(() => {
        origin = window.location.origin;
        const trakt = $page.url.searchParams.get("trakt");
        const message = $page.url.searchParams.get("message");
        if (trakt === "connected") {
            toast.success("Trakt connected");
        } else if (trakt === "error") {
            toast.error(message || "Trakt OAuth failed");
        }
        void refreshStatus();
    });

    const expectedRedirect = $derived(
        origin ? `${origin}/api/trakt/oauth/callback` : "{ORIGIN}/api/trakt/oauth/callback"
    );

    const redirectMatches = $derived(
        !!status?.redirect_uri &&
            !!origin &&
            status.redirect_uri.trim() === `${origin}/api/trakt/oauth/callback`
    );

    const canConnect = $derived(
        !!status &&
            status.has_client_id &&
            status.has_client_secret &&
            redirectMatches &&
            !status.connected
    );
</script>

<div class="border-border/60 bg-card/40 mb-4 space-y-3 rounded-xl border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
            <h3 class="text-sm font-semibold">Trakt account</h3>
            <p class="text-muted-foreground text-xs">
                Connect via OAuth for private lists / watchlists. Register redirect URI at
                <a
                    class="text-foreground underline-offset-2 hover:underline"
                    href="https://trakt.tv/oauth/applications"
                    target="_blank"
                    rel="noreferrer">
                    trakt.tv/oauth/applications
                </a>
                — must match
                <span class="font-mono text-[11px]">{expectedRedirect}</span>
                (frontend BFF, not the backend API callback).
            </p>
        </div>
        {#if loading}
            <span class="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 class="size-3.5 animate-spin" />
                Checking…
            </span>
        {:else if status?.connected}
            <span
                class="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Connected
            </span>
        {:else}
            <span class="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
                Not connected
            </span>
        {/if}
    </div>

    {#if status && !status.redirect_uri}
        <p class="text-xs text-amber-700 dark:text-amber-400">
            Set <span class="font-mono">oauth_redirect_uri</span> below to
            <span class="font-mono">{expectedRedirect}</span>, save, then Connect.
        </p>
    {:else if status && status.redirect_uri && !redirectMatches}
        <p class="text-xs text-amber-700 dark:text-amber-400">
            Redirect URI mismatch. Saved
            <span class="font-mono">{status.redirect_uri}</span> must equal
            <span class="font-mono">{expectedRedirect}</span>.
        </p>
    {:else if status && (!status.has_client_id || !status.has_client_secret)}
        <p class="text-xs text-amber-700 dark:text-amber-400">
            Save OAuth Client ID and Client Secret below before connecting.
        </p>
    {/if}

    <div class="flex flex-wrap gap-2">
        {#if status?.connected}
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disconnecting}
                onclick={disconnect}>
                {#if disconnecting}
                    <Loader2 class="size-3.5 animate-spin" />
                {:else}
                    <Unlink class="size-3.5" />
                {/if}
                Disconnect
            </Button>
        {:else}
            <Button
                type="button"
                size="sm"
                disabled={!canConnect}
                href={canConnect ? "/api/trakt/oauth/initiate" : undefined}>
                <Link2 class="size-3.5" />
                Connect Trakt
            </Button>
        {/if}
        <Button
            type="button"
            size="sm"
            variant="ghost"
            href="https://trakt.tv/oauth/applications"
            target="_blank"
            rel="noreferrer">
            <ExternalLink class="size-3.5" />
            Trakt apps
        </Button>
    </div>
</div>
