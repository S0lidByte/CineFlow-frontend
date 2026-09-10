<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import Laptop from "@lucide/svelte/icons/laptop";
    import Smartphone from "@lucide/svelte/icons/smartphone";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import LogOut from "@lucide/svelte/icons/log-out";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import { authClient } from "$lib/auth-client";
    import { parseUserAgent, formatAuthTimestamp } from "$lib/utils/auth";
    import { toast } from "svelte-sonner";
    import { onMount } from "svelte";

    interface SessionItem {
        id: string;
        token: string;
        createdAt: Date | string | number;
        expiresAt: Date | string | number;
        ipAddress?: string | null;
        userAgent?: string | null;
    }

    interface Props {
        currentSessionToken?: string;
        initialSessions?: SessionItem[];
    }

    let { currentSessionToken = "", initialSessions = [] }: Props = $props();

    let sessions = $state<SessionItem[]>([]);
    let isLoading = $state(false);
    let revokingToken = $state<string | null>(null);
    let isRevokingOthers = $state(false);
    let showRevokeOthersConfirm = $state(false);
    let lastSyncedInitialSessions = $state<SessionItem[] | null>(null);

    $effect(() => {
        if (initialSessions !== lastSyncedInitialSessions) {
            lastSyncedInitialSessions = initialSessions;
            sessions = initialSessions ?? [];
        }
    });

    onMount(() => {
        if (!initialSessions || !initialSessions.length) {
            void fetchSessions();
        }
    });

    async function fetchSessions() {
        isLoading = true;
        try {
            const res = await authClient.listSessions();
            if (res.data) {
                sessions = res.data as SessionItem[];
            }
        } catch {
            toast.error("Failed to load active sessions.");
        } finally {
            isLoading = false;
        }
    }

    async function handleRevokeSession(token: string) {
        revokingToken = token;
        try {
            const { error } = await authClient.revokeSession({ token });
            if (error) {
                toast.error(error.message || "Failed to revoke session.");
            } else {
                toast.success("Session revoked successfully.");
                sessions = sessions.filter((s) => s.token !== token);
            }
        } catch {
            toast.error("An error occurred while revoking the session.");
        } finally {
            revokingToken = null;
        }
    }

    async function handleRevokeOtherSessions() {
        isRevokingOthers = true;
        try {
            const { error } = await authClient.revokeOtherSessions();
            if (error) {
                toast.error(error.message || "Failed to revoke other sessions.");
            } else {
                toast.success("All other sessions revoked successfully.");
                showRevokeOthersConfirm = false;
                await fetchSessions();
            }
        } catch {
            toast.error("An error occurred while revoking other sessions.");
        } finally {
            isRevokingOthers = false;
        }
    }
</script>

<Card.Root>
    <Card.Header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <Card.Title>Active Sessions</Card.Title>
                <Card.Description>
                    Manage devices and active browser sessions currently signed in to your account.
                </Card.Description>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onclick={fetchSessions}
                    title="Refresh session list">
                    <RefreshCw class="h-3.5 w-3.5 {isLoading ? 'animate-spin' : ''}" />
                    <span class="ml-1.5 hidden sm:inline">Refresh</span>
                </Button>
                {#if sessions.length > 1}
                    <Button
                        variant="destructive"
                        size="sm"
                        onclick={() => (showRevokeOthersConfirm = true)}>
                        <ShieldAlert class="mr-1.5 h-3.5 w-3.5" />
                        Revoke Others
                    </Button>
                {/if}
            </div>
        </div>
    </Card.Header>
    <Card.Content>
        {#if isLoading && !sessions.length}
            <div class="text-muted-foreground flex items-center justify-center py-6">
                <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />
                <span>Loading active sessions...</span>
            </div>
        {:else if !sessions.length}
            <p class="text-muted-foreground py-4 text-center text-sm">No active sessions found.</p>
        {:else}
            <div class="divide-border/50 flex flex-col divide-y">
                {#each sessions as s (s.id || s.token)}
                    {@const isCurrent = s.token === currentSessionToken}
                    {@const device = parseUserAgent(s.userAgent)}
                    <div
                        class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex items-start gap-3">
                            <div
                                class="border-border/60 bg-muted/40 text-muted-foreground mt-0.5 rounded-md border p-2">
                                {#if device.type === "mobile"}
                                    <Smartphone class="h-4 w-4" />
                                {:else}
                                    <Laptop class="h-4 w-4" />
                                {/if}
                            </div>
                            <div class="flex flex-col">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium">{device.name}</span>
                                    {#if isCurrent}
                                        <Badge
                                            variant="secondary"
                                            class="bg-primary/10 text-primary hover:bg-primary/20 px-1.5 py-0 text-[10px] font-semibold">
                                            Current Session
                                        </Badge>
                                    {/if}
                                </div>
                                <div
                                    class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                                    {#if s.ipAddress}
                                        <span>IP: {s.ipAddress}</span>
                                        <span>•</span>
                                    {/if}
                                    <span>Signed in {formatAuthTimestamp(s.createdAt)}</span>
                                    <span>•</span>
                                    <span>Expires {formatAuthTimestamp(s.expiresAt)}</span>
                                </div>
                            </div>
                        </div>

                        {#if !isCurrent}
                            <div class="flex items-center justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs"
                                    disabled={revokingToken === s.token}
                                    onclick={() => handleRevokeSession(s.token)}>
                                    {#if revokingToken === s.token}
                                        <LoaderCircle class="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    {:else}
                                        <LogOut class="mr-1.5 h-3.5 w-3.5" />
                                    {/if}
                                    Revoke
                                </Button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </Card.Content>
</Card.Root>

<!-- Revoke Others Confirmation Dialog -->
<AlertDialog.Root bind:open={showRevokeOthersConfirm}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Revoke all other sessions?</AlertDialog.Title>
            <AlertDialog.Description>
                This will sign out all other devices and browser sessions logged into your CineFlow
                account. Your current session will remain active.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isRevokingOthers}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isRevokingOthers}
                onclick={handleRevokeOtherSessions}>
                {#if isRevokingOthers}
                    <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                {/if}
                Revoke All Others
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
