<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import * as Card from "$lib/components/ui/card/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { toast } from "svelte-sonner";
    import Fingerprint from "@lucide/svelte/icons/fingerprint";
    import Pencil from "@lucide/svelte/icons/pencil";
    import Check from "@lucide/svelte/icons/check";
    import X from "@lucide/svelte/icons/x";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import { onMount } from "svelte";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { createScopedLogger } from "$lib/logger";

    const logger = createScopedLogger("passkeys");

    interface Passkey {
        id: string;
        name: string;
        createdAt: string | Date;
    }

    let isRegisteringPasskey = $state(false);
    let userPasskeys = $state<Passkey[]>([]);
    let isLoadingPasskeys = $state(true);
    let loadError = $state<string | null>(null);
    let editingPasskeyId = $state<string | null>(null);
    let editingPasskeyName = $state<string>("");
    let isUpdatingPasskey = $state(false);
    let passkeyToDelete = $state<Passkey | null>(null);
    let isDeletingPasskey = $state(false);

    onMount(async () => {
        await loadPasskeys();
    });

    async function loadPasskeys() {
        isLoadingPasskeys = true;
        loadError = null;
        try {
            const response = await authClient.passkey.listUserPasskeys();
            if (response.error) {
                loadError = response.error.message || "Failed to load passkeys";
                userPasskeys = [];
            } else {
                userPasskeys = (response.data || []) as Passkey[];
            }
        } catch (error) {
            logger.error("Failed to load passkeys:", error);
            loadError = "An unexpected error occurred while loading passkeys.";
            userPasskeys = [];
        } finally {
            isLoadingPasskeys = false;
        }
    }

    async function handleRegisterPasskey() {
        isRegisteringPasskey = true;
        try {
            await authClient.passkey.addPasskey({
                fetchOptions: {
                    onSuccess() {
                        toast.success("Passkey registered successfully!");
                        loadPasskeys();
                    },
                    onError(context) {
                        toast.error(context.error.message || "Failed to register passkey");
                    }
                }
            });
        } catch {
            toast.error("Failed to register passkey");
        } finally {
            isRegisteringPasskey = false;
        }
    }

    function startEditingPasskey(passkey: Passkey) {
        editingPasskeyId = passkey.id;
        editingPasskeyName = passkey.name || "";
    }

    function cancelEditingPasskey() {
        editingPasskeyId = null;
        editingPasskeyName = "";
    }

    async function savePasskeyName(passkeyId: string) {
        if (!editingPasskeyName.trim()) {
            toast.error("Passkey name cannot be empty");
            return;
        }

        isUpdatingPasskey = true;
        try {
            const { error } = await authClient.passkey.updatePasskey({
                id: passkeyId,
                name: editingPasskeyName.trim()
            });

            if (error) {
                toast.error(error.message || "Failed to update passkey name");
            } else {
                toast.success("Passkey name updated successfully!");
                editingPasskeyId = null;
                editingPasskeyName = "";
                await loadPasskeys();
            }
        } catch {
            toast.error("Failed to update passkey name");
        } finally {
            isUpdatingPasskey = false;
        }
    }

    async function confirmDeletePasskey() {
        if (!passkeyToDelete) return;
        isDeletingPasskey = true;
        try {
            await authClient.passkey.deletePasskey({
                id: passkeyToDelete.id,
                fetchOptions: {
                    onSuccess() {
                        toast.success("Passkey deleted successfully");
                        passkeyToDelete = null;
                        loadPasskeys();
                    },
                    onError(context) {
                        toast.error(context.error.message || "Failed to delete passkey");
                    }
                }
            });
        } catch {
            toast.error("Failed to delete passkey");
        } finally {
            isDeletingPasskey = false;
        }
    }
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>Passkeys</Card.Title>
        <Card.Description>
            Manage your passkeys for secure, passwordless authentication
        </Card.Description>
    </Card.Header>
    <Card.Content>
        {#if isLoadingPasskeys}
            <div class="text-muted-foreground flex items-center gap-2 py-2 text-sm">
                <LoaderCircle class="h-4 w-4 animate-spin" />
                <span>Loading passkeys...</span>
            </div>
        {:else if loadError}
            <div
                class="border-destructive/30 bg-destructive/10 my-2 flex items-center justify-between rounded-lg border p-3">
                <span class="text-destructive text-xs">{loadError}</span>
                <Button size="sm" variant="outline" class="h-7 text-xs" onclick={loadPasskeys}>
                    Retry
                </Button>
            </div>
        {:else if userPasskeys.length > 0}
            <div class="mb-4 space-y-2">
                {#each userPasskeys as passkey (passkey.id)}
                    <div class="flex items-center justify-between rounded-lg border p-3">
                        <div class="flex flex-1 items-center gap-3">
                            <Fingerprint class="text-muted-foreground h-5 w-5" />
                            <div class="flex-1">
                                {#if editingPasskeyId === passkey.id}
                                    <Input
                                        bind:value={editingPasskeyName}
                                        disabled={isUpdatingPasskey}
                                        placeholder="Enter passkey name"
                                        class="h-8" />
                                {:else}
                                    <p class="text-sm font-medium">
                                        {passkey.name || "Unnamed Passkey"}
                                    </p>
                                {/if}
                                <p class="text-muted-foreground text-xs">
                                    Created {new Date(passkey.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            {#if editingPasskeyId === passkey.id}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={isUpdatingPasskey}
                                    onclick={() => savePasskeyName(passkey.id)}
                                    class="h-8 w-8">
                                    <Check class="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={isUpdatingPasskey}
                                    onclick={cancelEditingPasskey}
                                    class="h-8 w-8">
                                    <X class="h-4 w-4" />
                                </Button>
                            {:else}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onclick={() => startEditingPasskey(passkey)}
                                    class="h-8 w-8">
                                    <Pencil class="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onclick={() => (passkeyToDelete = passkey)}>
                                    Delete
                                </Button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <p class="text-muted-foreground mb-4 text-sm">
                No passkeys registered yet. Add a passkey for faster, more secure login.
            </p>
        {/if}

        <Button variant="outline" disabled={isRegisteringPasskey} onclick={handleRegisterPasskey}>
            <Fingerprint class="mr-2 h-4 w-4" />
            {isRegisteringPasskey ? "Registering..." : "Add Passkey"}
        </Button>
    </Card.Content>
</Card.Root>

<AlertDialog.Root
    open={!!passkeyToDelete}
    onOpenChange={(open) => {
        if (!open) passkeyToDelete = null;
    }}>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>Delete Passkey?</AlertDialog.Title>
            <AlertDialog.Description>
                Are you sure you want to delete the passkey "{passkeyToDelete?.name ||
                    "Unnamed Passkey"}"? You will no longer be able to use it to sign in to
                CineFlow.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel
                disabled={isDeletingPasskey}
                onclick={() => (passkeyToDelete = null)}>
                Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeletingPasskey}
                onclick={confirmDeletePasskey}>
                {#if isDeletingPasskey}
                    <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                {:else}
                    Delete Passkey
                {/if}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
