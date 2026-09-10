<script lang="ts">
    import type { PageProps } from "./$types";
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import Passkeys from "$lib/components/auth/passkeys.svelte";
    import PasswordChangeForm from "$lib/components/auth/password-change-form.svelte";
    import EmailChangeForm from "$lib/components/auth/email-change-form.svelte";
    import SetPasswordForm from "$lib/components/auth/set-password-form.svelte";
    import AccountLinks from "$lib/components/auth/account-links.svelte";
    import UpdateUserForm from "$lib/components/auth/update-user-form.svelte";
    import SessionsManager from "$lib/components/auth/sessions-manager.svelte";
    import * as dateUtils from "$lib/utils/date";
    import { getInitials } from "$lib/utils";
    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import PageShell from "$lib/components/page-shell.svelte";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import LogOut from "@lucide/svelte/icons/log-out";
    import { toast } from "svelte-sonner";

    let { data }: PageProps = $props();

    let showDeleteConfirm = $state(false);
    let isDeletingAccount = $state(false);

    function hasCredentialProvider(accounts?: Array<{ providerId: string }> | null): boolean {
        return Array.isArray(accounts) && accounts.some((a) => a.providerId === "credential");
    }

    async function confirmDeleteAccount() {
        isDeletingAccount = true;
        try {
            await authClient.deleteUser({
                fetchOptions: {
                    onSuccess: async () => {
                        toast.success("Account deleted successfully.");
                        await goto(resolve("/auth/login"), { invalidateAll: true });
                    },
                    onError: (ctx) => {
                        toast.error(ctx.error.message || "Failed to delete account.");
                        isDeletingAccount = false;
                    }
                }
            });
        } catch {
            toast.error("An unexpected error occurred while deleting your account.");
            isDeletingAccount = false;
        }
    }
</script>

<svelte:head>
    <title>Profile - CineFlow</title>
</svelte:head>

<PageShell>
    <h1 class="text-3xl font-bold tracking-tight">{data.user.name}'s Profile</h1>

    <div class="mt-4 flex flex-col gap-4">
        <div class="flex flex-row items-center gap-4">
            <Avatar.Root class="h-16 w-16 text-xl">
                {#if data.user.image}
                    <Avatar.Image src={data.user.image} alt={data.user.name} />
                {/if}
                <Avatar.Fallback class="bg-primary text-primary-foreground font-semibold">
                    {getInitials(data.user.name)}
                </Avatar.Fallback>
            </Avatar.Root>
            <div>
                <p class="text-lg font-semibold">{data.user.name}</p>
                {#if data.user.username}
                    <p class="text-primary/80 font-mono text-xs">@{data.user.username}</p>
                {/if}
                <p class="text-muted-foreground text-sm">{data.user.email}</p>
            </div>
        </div>

        <div class="flex flex-col">
            <p class="text-muted-foreground text-sm">
                Member since {dateUtils.formatDate(
                    data.user.createdAt ? new Date(data.user.createdAt).toISOString() : null
                ) ?? "Unknown"}
            </p>

            <p class="text-muted-foreground text-sm">
                Last updated {dateUtils.formatDate(
                    data.user.updatedAt ? new Date(data.user.updatedAt).toISOString() : null
                ) ?? "Unknown"}
            </p>

            <p class="text-muted-foreground text-sm">
                Session expires at {dateUtils.formatDate(
                    data.session.expiresAt ? new Date(data.session.expiresAt).toISOString() : null
                ) ?? "Unknown"}
            </p>
        </div>
    </div>

    <div class="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {#if hasCredentialProvider(data.accounts)}
            <PasswordChangeForm data={data.passwordChangeForm} />
        {:else}
            <SetPasswordForm data={data.setPasswordForm} />
        {/if}
        <EmailChangeForm data={data.emailChangeForm} />

        <UpdateUserForm data={data.changeUserDataForm} userName={data.user.name} />
    </div>

    <div class="mt-8">
        <SessionsManager currentSessionToken={data.session.token} initialSessions={data.sessions} />
    </div>

    <div class="mt-8">
        <AccountLinks accounts={data.accounts} providers={data.authProviders} />
    </div>

    <div class="mt-8">
        <Passkeys />
    </div>

    <div class="mt-8 flex flex-col gap-3 border-t pt-6 md:flex-row">
        <Button
            variant="destructive"
            class="w-full md:max-w-max"
            onclick={() => (showDeleteConfirm = true)}>
            <Trash2 class="mr-2 h-4 w-4" />
            Delete Account
        </Button>

        <Button
            variant="outline"
            class="w-full md:max-w-max"
            onclick={async () => {
                await authClient.signOut({
                    fetchOptions: {
                        onSuccess: async () => {
                            await goto(resolve("/auth/login"), { invalidateAll: true });
                        }
                    }
                });
            }}>
            <LogOut class="mr-2 h-4 w-4" />
            Logout
        </Button>
    </div>
</PageShell>

<AlertDialog.Root bind:open={showDeleteConfirm}>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>Delete Account?</AlertDialog.Title>
            <AlertDialog.Description>
                This action is permanent and cannot be undone. All your profile settings, passkeys,
                sessions, and preferences in CineFlow will be permanently deleted.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isDeletingAccount}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeletingAccount}
                onclick={confirmDeleteAccount}>
                {#if isDeletingAccount}
                    <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                {:else}
                    Yes, Delete My Account
                {/if}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
