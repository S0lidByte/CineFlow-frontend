<script lang="ts">
    /**
     * Trakt OAuth connect chrome for Settings → Content.
     * Uses BFF routes only — never exposes BFF_API_KEY to the browser.
     */
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button/index.js";
    import { toast } from "svelte-sonner";
    import Link2 from "@lucide/svelte/icons/link-2";
    import Unlink from "@lucide/svelte/icons/unlink";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import ExternalLink from "@lucide/svelte/icons/external-link";
    import Copy from "@lucide/svelte/icons/copy";
    import Check from "@lucide/svelte/icons/check";

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
    let copied = $state(false);

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

    async function copyRedirectUri() {
        if (!expectedRedirect) return;
        try {
            await navigator.clipboard.writeText(expectedRedirect);
            copied = true;
            toast.success("Redirect URI copied to clipboard");
            setTimeout(() => {
                copied = false;
            }, 2000);
        } catch {
            toast.error("Failed to copy redirect URI");
        }
    }

    // The page remains mounted after enhanced saves; refresh persisted connection readiness.
    $effect(() => {
        if ($page.form) void refreshStatus();
    });

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
            status.redirect_uri.trim().replace(/\/$/, "") ===
                `${origin}/api/trakt/oauth/callback`.replace(/\/$/, "")
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
                Connect via OAuth for personal watchlists and history syncing. In your Trakt API
                app, set the Redirect URI to match the URL below:
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
                <code
                    class="bg-muted text-foreground rounded px-2 py-0.5 font-mono text-[11px] select-all">
                    {expectedRedirect}
                </code>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    class="text-muted-foreground hover:text-foreground size-6"
                    onclick={copyRedirectUri}
                    title="Copy Redirect URI">
                    {#if copied}
                        <Check class="size-3 text-emerald-500" />
                    {:else}
                        <Copy class="size-3" />
                    {/if}
                </Button>
            </div>
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

    {#if status && (!status.has_client_id || !status.has_client_secret || !status.redirect_uri || !redirectMatches)}
        <div
            class="space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p class="text-foreground font-medium">Configure Trakt below:</p>
            <p class="text-muted-foreground">
                Enter your Client ID and Client Secret. Leave the secret blank to keep an existing
                saved secret. The callback shown above is set automatically when you save; register
                the same URL in your Trakt application.
            </p>
            <p class="text-muted-foreground pt-0.5 text-[11px]">
                After updating fields, click <strong class="text-foreground">Save changes</strong>
                before clicking <strong class="text-foreground">Connect Trakt</strong>.
            </p>
        </div>
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
