<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Link2 from "@lucide/svelte/icons/link-2";
    import Link2Off from "@lucide/svelte/icons/link-2-off";
    import { authClient } from "$lib/auth-client";
    import { isOnlyLoginMethod as checkIsOnlyLoginMethod } from "$lib/utils/auth";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";

    interface Account {
        id: string;
        providerId: string;
        createdAt: Date;
        updatedAt: Date;
        accountId: string;
        scopes: string[];
    }

    let {
        accounts,
        providers
    }: {
        accounts: Account[];
        providers: Record<
            string,
            { enabled: boolean; disableSignup: boolean; name?: string; icon?: string }
        >;
    } = $props();
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>Account Links</Card.Title>
        <Card.Description>Manage your linked authentication providers.</Card.Description>
    </Card.Header>
    <Card.Content>
        <div class="flex flex-col gap-4">
            {#each Object.entries(providers) as [providerId, config] (providerId)}
                {#if config.enabled && providerId !== "credential"}
                    {@const providerName =
                        config.name || providerId.charAt(0).toUpperCase() + providerId.slice(1)}
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            {#if config.icon}
                                <img src={config.icon} alt="{providerName} icon" class="h-4 w-4" />
                            {/if}
                            <span>{providerName}</span>
                        </div>
                        {#if accounts.find((account) => account.providerId === providerId)}
                            {@const linkedAccount = accounts.find(
                                (account) => account.providerId === providerId
                            )}
                            {@const isOnlyLoginMethod = checkIsOnlyLoginMethod(accounts, providers)}
                            <div class="flex items-center gap-2">
                                {#if isOnlyLoginMethod}
                                    <span
                                        class="text-muted-foreground hidden text-xs italic sm:inline">
                                        Only login method
                                    </span>
                                {/if}
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={isOnlyLoginMethod}
                                    title={isOnlyLoginMethod
                                        ? "Cannot unlink your only authentication method. Set a password or link another provider first."
                                        : `Unlink ${providerName}`}
                                    onclick={async () => {
                                        try {
                                            if (!linkedAccount) return;
                                            const { error } = await authClient.unlinkAccount({
                                                accountId: linkedAccount.id
                                            });
                                            if (error) {
                                                toast.error(
                                                    error.message ||
                                                        `Failed to unlink ${providerName}.`
                                                );
                                            } else {
                                                toast.success(
                                                    `${providerName} unlinked successfully.`
                                                );
                                                await goto(resolve("/auth"), {
                                                    invalidateAll: true
                                                });
                                            }
                                        } catch {
                                            toast.error(`Failed to unlink ${providerName}.`);
                                        }
                                    }}>
                                    <Link2Off class="mr-2 h-4 w-4" />
                                    Unlink
                                </Button>
                            </div>
                        {:else}
                            <Button
                                size="sm"
                                onclick={async () => {
                                    try {
                                        await authClient.linkSocial({
                                            provider: providerId,
                                            callbackURL: "/auth"
                                        });
                                    } catch (err) {
                                        const errMessage =
                                            err instanceof Error ? err.message : undefined;
                                        toast.error(
                                            errMessage ||
                                                `Failed to initiate linking with ${providerName}.`
                                        );
                                    }
                                }}>
                                <Link2 class="mr-2 h-4 w-4" />
                                Link
                            </Button>
                        {/if}
                    </div>
                {/if}
            {/each}
        </div>
    </Card.Content>
</Card.Root>
