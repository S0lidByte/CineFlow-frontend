<script lang="ts">
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { toast } from "svelte-sonner";
    import Users from "@lucide/svelte/icons/users";
    import UserPlus from "@lucide/svelte/icons/user-plus";
    import Shield from "@lucide/svelte/icons/shield";
    import ShieldAlert from "@lucide/svelte/icons/shield-alert";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import Key from "@lucide/svelte/icons/key";
    import Ban from "@lucide/svelte/icons/ban";
    import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import Search from "@lucide/svelte/icons/search";
    import MoreVertical from "@lucide/svelte/icons/more-vertical";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
    import UserCheck from "@lucide/svelte/icons/user-check";
    import SettingsPanelToolbar from "$lib/components/settings/settings-panel-toolbar.svelte";
    import SettingsPanelSurface from "$lib/components/settings/settings-panel-surface.svelte";
    import SettingsEmptyState from "$lib/components/settings/settings-empty-state.svelte";
    import { page } from "$app/stores";

    interface ManagedUser {
        id: string;
        name: string;
        email: string;
        username?: string | null;
        displayUsername?: string | null;
        role?: string | null;
        banned?: boolean | null;
        banReason?: string | null;
        banExpires?: number | null;
        createdAt: number;
        updatedAt: number;
        lastLoginMethod?: string | null;
    }

    let users = $state<ManagedUser[]>([]);
    let totalUsers = $state(0);
    let adminCount = $state(0);
    let publicRegistrationAllowed = $state(false);
    let isLoading = $state(true);
    let searchQuery = $state("");
    let roleFilter = $state<string>("all");

    // Modal state
    let showAddUserDialog = $state(false);
    let newUsername = $state("");
    let newEmail = $state("");
    let newPassword = $state("");
    let newRole = $state<"user" | "manager" | "admin">("user");
    let isCreatingUser = $state(false);

    let showPasswordDialog = $state(false);
    let targetUserForPassword = $state<ManagedUser | null>(null);
    let resetPasswordValue = $state("");
    let isResettingPassword = $state(false);

    let showDeleteConfirmDialog = $state(false);
    let targetUserForDelete = $state<ManagedUser | null>(null);
    let isDeletingUser = $state(false);

    let showBanConfirmDialog = $state(false);
    let targetUserForBan = $state<ManagedUser | null>(null);
    let banReasonInput = $state("");
    let isBanningUser = $state(false);

    let isTogglingRegistration = $state(false);

    const currentUserId = $derived($page.data.user?.id);

    const filteredUsers = $derived(
        users.filter((u) => {
            const matchesSearch =
                !searchQuery.trim() ||
                (u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
                u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesRole =
                roleFilter === "all" ||
                (u.role?.toLowerCase() ?? "user") === roleFilter.toLowerCase();

            return matchesSearch && matchesRole;
        })
    );

    async function loadUsers() {
        isLoading = true;
        try {
            const res = await fetch("/api/admin/users");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to load users");
            }
            const data = (await res.json()) as {
                users: ManagedUser[];
                totalUsers: number;
                adminCount: number;
                publicRegistrationAllowed: boolean;
            };
            users = data.users || [];
            totalUsers = data.totalUsers || users.length;
            adminCount = data.adminCount || users.filter((u) => u.role === "admin").length;
            publicRegistrationAllowed = data.publicRegistrationAllowed;
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to load user accounts");
        } finally {
            isLoading = false;
        }
    }

    async function togglePublicRegistration(allowed: boolean) {
        isTogglingRegistration = true;
        try {
            const res = await fetch("/api/admin/registration", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowed })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update registration setting");
            }
            publicRegistrationAllowed = allowed;
            toast.success(
                allowed
                    ? "Public registration enabled."
                    : "Public registration closed. New accounts require admin creation."
            );
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to update registration setting");
            publicRegistrationAllowed = !allowed;
        } finally {
            isTogglingRegistration = false;
        }
    }

    async function handleCreateUser() {
        if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
            toast.error("Please fill in all required fields.");
            return;
        }

        isCreatingUser = true;
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: newUsername.trim(),
                    email: newEmail.trim(),
                    password: newPassword,
                    role: newRole,
                    name: newUsername.trim()
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to create user");
            }

            toast.success(`User '${newUsername}' created successfully.`);
            showAddUserDialog = false;
            newUsername = "";
            newEmail = "";
            newPassword = "";
            newRole = "user";
            await loadUsers();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to create user");
        } finally {
            isCreatingUser = false;
        }
    }

    async function handleSetRole(targetUser: ManagedUser, role: "admin" | "manager" | "user") {
        if (targetUser.role === role) return;

        if (targetUser.id === currentUserId && targetUser.role === "admin" && role !== "admin") {
            toast.error("Administrators cannot demote their own account.");
            return;
        }

        if (targetUser.role === "admin" && role !== "admin" && adminCount <= 1) {
            toast.error("Cannot demote the last remaining administrator.");
            return;
        }

        try {
            const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update user role");
            }

            toast.success(`Role updated for ${targetUser.username || targetUser.name}.`);
            await loadUsers();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to update role");
        }
    }

    async function handleResetPassword() {
        if (!targetUserForPassword || !resetPasswordValue.trim()) return;

        isResettingPassword = true;
        try {
            const res = await fetch(`/api/admin/users/${targetUserForPassword.id}/password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: resetPasswordValue.trim() })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to reset password");
            }

            toast.success(
                `Password reset for ${targetUserForPassword.username || targetUserForPassword.name}.`
            );
            showPasswordDialog = false;
            resetPasswordValue = "";
            targetUserForPassword = null;
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to reset password");
        } finally {
            isResettingPassword = false;
        }
    }

    async function handleToggleBan() {
        if (!targetUserForBan) return;

        const isCurrentlyBanned = targetUserForBan.banned ?? false;
        const willBan = !isCurrentlyBanned;

        isBanningUser = true;
        try {
            const res = await fetch(`/api/admin/users/${targetUserForBan.id}/ban`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ban: willBan,
                    banReason: willBan ? banReasonInput.trim() || undefined : undefined
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update suspension status");
            }

            toast.success(
                willBan
                    ? `Account ${targetUserForBan.username || targetUserForBan.name} suspended.`
                    : `Account ${targetUserForBan.username || targetUserForBan.name} reactivated.`
            );
            showBanConfirmDialog = false;
            targetUserForBan = null;
            banReasonInput = "";
            await loadUsers();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to update suspension status");
        } finally {
            isBanningUser = false;
        }
    }

    async function handleDeleteUser() {
        if (!targetUserForDelete) return;

        if (targetUserForDelete.id === currentUserId) {
            toast.error("Administrators cannot delete their own account.");
            return;
        }

        isDeletingUser = true;
        try {
            const res = await fetch(`/api/admin/users/${targetUserForDelete.id}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete user");
            }

            toast.success(
                `User ${targetUserForDelete.username || targetUserForDelete.name} deleted.`
            );
            showDeleteConfirmDialog = false;
            targetUserForDelete = null;
            await loadUsers();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to delete user");
        } finally {
            isDeletingUser = false;
        }
    }

    function formatDate(ms?: number | null) {
        if (!ms) return "—";
        try {
            return new Date(ms).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        } catch {
            return "—";
        }
    }

    onMount(() => {
        void loadUsers();
    });
</script>

<div class="flex flex-col gap-6">
    <!-- ── KPI Summary Header ── -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SettingsPanelSurface class="flex items-center gap-4 p-4">
            <div
                class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Users class="size-5" />
            </div>
            <div>
                <p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Total Accounts
                </p>
                <h3 class="text-foreground text-2xl font-bold">{totalUsers}</h3>
            </div>
        </SettingsPanelSurface>

        <SettingsPanelSurface class="flex items-center gap-4 p-4">
            <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <ShieldCheck class="size-5" />
            </div>
            <div>
                <p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Administrators
                </p>
                <h3 class="text-foreground text-2xl font-bold">{adminCount}</h3>
            </div>
        </SettingsPanelSurface>

        <SettingsPanelSurface class="flex items-center justify-between p-4">
            <div class="flex items-center gap-3">
                <div
                    class={publicRegistrationAllowed
                        ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"
                        : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500"}>
                    {#if publicRegistrationAllowed}
                        <UserCheck class="size-5" />
                    {:else}
                        <Ban class="size-5" />
                    {/if}
                </div>
                <div>
                    <p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        Public Registration
                    </p>
                    <p class="text-foreground text-sm font-semibold">
                        {publicRegistrationAllowed
                            ? "Open to Public"
                            : "Closed (Invite/Admin Only)"}
                    </p>
                </div>
            </div>
            <Switch
                checked={publicRegistrationAllowed}
                disabled={isTogglingRegistration || isLoading}
                onCheckedChange={(val) => togglePublicRegistration(val)} />
        </SettingsPanelSurface>
    </div>

    <!-- ── Toolbar / Controls ── -->
    <SettingsPanelSurface class="p-4">
        <SettingsPanelToolbar class="gap-4">
            {#snippet left()}
                <div class="relative w-full max-w-sm">
                    <Search
                        class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        type="search"
                        placeholder="Search users by name, email, or username…"
                        class="pl-9"
                        bind:value={searchQuery} />
                </div>

                <div class="flex items-center gap-1.5">
                    <Button
                        variant={roleFilter === "all" ? "secondary" : "ghost"}
                        size="sm"
                        onclick={() => (roleFilter = "all")}>
                        All
                    </Button>
                    <Button
                        variant={roleFilter === "admin" ? "secondary" : "ghost"}
                        size="sm"
                        onclick={() => (roleFilter = "admin")}>
                        Admins
                    </Button>
                    <Button
                        variant={roleFilter === "manager" ? "secondary" : "ghost"}
                        size="sm"
                        onclick={() => (roleFilter = "manager")}>
                        Managers
                    </Button>
                    <Button
                        variant={roleFilter === "user" ? "secondary" : "ghost"}
                        size="sm"
                        onclick={() => (roleFilter = "user")}>
                        Standard Users
                    </Button>
                </div>
            {/snippet}

            {#snippet actions()}
                <Button size="sm" onclick={() => (showAddUserDialog = true)} class="gap-1.5">
                    <UserPlus class="size-4" />
                    <span>Add User</span>
                </Button>
                <Button variant="outline" size="sm" onclick={loadUsers} disabled={isLoading}>
                    {#if isLoading}
                        <Loader2 class="size-4 animate-spin" />
                    {:else}
                        Refresh
                    {/if}
                </Button>
            {/snippet}
        </SettingsPanelToolbar>
    </SettingsPanelSurface>

    <!-- ── Users Table Surface ── -->
    <SettingsPanelSurface class="overflow-hidden p-0">
        {#if isLoading && users.length === 0}
            <div class="flex h-48 items-center justify-center">
                <Loader2 class="text-primary size-6 animate-spin" />
            </div>
        {:else if filteredUsers.length === 0}
            <div class="p-8">
                <SettingsEmptyState
                    icon={Users}
                    title={searchQuery
                        ? "No user accounts match your search criteria."
                        : "There are currently no users registered in this system."} />
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead
                        class="border-border/60 bg-muted/40 text-muted-foreground border-b text-xs font-semibold tracking-wider uppercase">
                        <tr>
                            <th class="px-4 py-3">User</th>
                            <th class="px-4 py-3">Role</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3">Created</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-border/40 divide-y">
                        {#each filteredUsers as u (u.id)}
                            {@const isSelf = u.id === currentUserId}
                            {@const isBanned = u.banned ?? false}
                            <tr class="hover:bg-muted/25 transition-colors">
                                <td class="px-4 py-3.5">
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-bold uppercase shadow-inner">
                                            {(u.username || u.name || u.email || "U").slice(0, 2)}
                                        </div>
                                        <div class="flex flex-col">
                                            <div class="flex items-center gap-1.5">
                                                <span class="text-foreground font-semibold">
                                                    {u.username || u.name}
                                                </span>
                                                {#if isSelf}
                                                    <Badge
                                                        variant="outline"
                                                        class="border-primary/40 text-primary py-0 text-[10px]">
                                                        You
                                                    </Badge>
                                                {/if}
                                            </div>
                                            <span class="text-muted-foreground text-xs"
                                                >{u.email}</span>
                                        </div>
                                    </div>
                                </td>

                                <td class="px-4 py-3.5">
                                    {#if u.role === "admin"}
                                        <Badge
                                            class="gap-1 border-amber-500/30 bg-amber-500/15 font-medium text-amber-600 dark:text-amber-400">
                                            <Shield class="size-3" />
                                            Admin
                                        </Badge>
                                    {:else if u.role === "manager"}
                                        <Badge
                                            class="gap-1 border-blue-500/30 bg-blue-500/15 font-medium text-blue-600 dark:text-blue-400">
                                            <ShieldAlert class="size-3" />
                                            Manager
                                        </Badge>
                                    {:else}
                                        <Badge variant="secondary" class="font-normal">User</Badge>
                                    {/if}
                                </td>

                                <td class="px-4 py-3.5">
                                    {#if isBanned}
                                        <Badge variant="destructive" class="gap-1 font-normal">
                                            <Ban class="size-3" />
                                            Suspended
                                        </Badge>
                                    {:else}
                                        <Badge
                                            variant="outline"
                                            class="gap-1 border-emerald-500/40 font-normal text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle2 class="size-3" />
                                            Active
                                        </Badge>
                                    {/if}
                                </td>

                                <td class="text-muted-foreground px-4 py-3.5 text-xs">
                                    {formatDate(u.createdAt)}
                                </td>

                                <td class="px-4 py-3.5 text-right">
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            <Button variant="ghost" size="icon" class="size-8">
                                                <MoreVertical class="size-4" />
                                                <span class="sr-only">Open actions</span>
                                            </Button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="end" class="w-48">
                                            <DropdownMenu.Label class="text-xs font-medium"
                                                >Manage Role</DropdownMenu.Label>
                                            <DropdownMenu.Item
                                                disabled={u.role === "admin"}
                                                onclick={() => handleSetRole(u, "admin")}>
                                                <Shield class="mr-2 size-3.5 text-amber-500" />
                                                <span>Promote to Admin</span>
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                disabled={u.role === "manager" ||
                                                    (isSelf && u.role === "admin")}
                                                onclick={() => handleSetRole(u, "manager")}>
                                                <ShieldAlert class="mr-2 size-3.5 text-blue-500" />
                                                <span>Set as Manager</span>
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                disabled={u.role === "user" ||
                                                    (isSelf && u.role === "admin") ||
                                                    (u.role === "admin" && adminCount <= 1)}
                                                onclick={() => handleSetRole(u, "user")}>
                                                <Users
                                                    class="text-muted-foreground mr-2 size-3.5" />
                                                <span>Demote to User</span>
                                            </DropdownMenu.Item>

                                            <DropdownMenu.Separator />

                                            <DropdownMenu.Item
                                                onclick={() => {
                                                    targetUserForPassword = u;
                                                    resetPasswordValue = "";
                                                    showPasswordDialog = true;
                                                }}>
                                                <Key class="mr-2 size-3.5" />
                                                <span>Reset Password</span>
                                            </DropdownMenu.Item>

                                            <DropdownMenu.Item
                                                disabled={isSelf}
                                                onclick={() => {
                                                    targetUserForBan = u;
                                                    banReasonInput = u.banReason || "";
                                                    showBanConfirmDialog = true;
                                                }}>
                                                <Ban class="mr-2 size-3.5 text-amber-500" />
                                                <span
                                                    >{isBanned
                                                        ? "Reactivate Account"
                                                        : "Suspend Account"}</span>
                                            </DropdownMenu.Item>

                                            <DropdownMenu.Separator />

                                            <DropdownMenu.Item
                                                disabled={isSelf ||
                                                    (u.role === "admin" && adminCount <= 1)}
                                                onclick={() => {
                                                    targetUserForDelete = u;
                                                    showDeleteConfirmDialog = true;
                                                }}
                                                class="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                <Trash2 class="mr-2 size-3.5" />
                                                <span>Delete User</span>
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </SettingsPanelSurface>
</div>

<!-- ── Add User Dialog ── -->
<Dialog.Root bind:open={showAddUserDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Create New User Account</Dialog.Title>
            <Dialog.Description>
                Provision a new local account with assigned system capabilities.
            </Dialog.Description>
        </Dialog.Header>

        <form
            onsubmit={(e) => {
                e.preventDefault();
                void handleCreateUser();
            }}
            class="flex flex-col gap-4 py-2">
            <div class="flex flex-col gap-1.5">
                <Label for="new-username">Username</Label>
                <Input
                    id="new-username"
                    placeholder="e.g. johndoe"
                    bind:value={newUsername}
                    required />
            </div>

            <div class="flex flex-col gap-1.5">
                <Label for="new-email">Email Address</Label>
                <Input
                    id="new-email"
                    type="email"
                    placeholder="e.g. john@example.com"
                    bind:value={newEmail}
                    required />
            </div>

            <div class="flex flex-col gap-1.5">
                <Label for="new-password">Password</Label>
                <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    bind:value={newPassword}
                    minlength={8}
                    required />
            </div>

            <div class="flex flex-col gap-1.5">
                <Label for="new-role">Role</Label>
                <select
                    id="new-role"
                    bind:value={newRole}
                    class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:ring-1 focus:outline-none">
                    <option value="user">User (Media request & library viewing)</option>
                    <option value="manager"
                        >Manager (Operations, pause/resume & settings write)</option>
                    <option value="admin"
                        >Administrator (Full platform permissions & user management)</option>
                </select>
            </div>

            <Dialog.Footer class="mt-4">
                <Button variant="outline" type="button" onclick={() => (showAddUserDialog = false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isCreatingUser}>
                    {#if isCreatingUser}
                        <Loader2 class="mr-1.5 size-4 animate-spin" />
                    {/if}
                    Create Account
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- ── Reset Password Dialog ── -->
<Dialog.Root bind:open={showPasswordDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Reset Password</Dialog.Title>
            <Dialog.Description>
                Set a new password for <span class="text-foreground font-semibold"
                    >{targetUserForPassword?.username || targetUserForPassword?.name}</span
                >.
            </Dialog.Description>
        </Dialog.Header>

        <form
            onsubmit={(e) => {
                e.preventDefault();
                void handleResetPassword();
            }}
            class="flex flex-col gap-4 py-2">
            <div class="flex flex-col gap-1.5">
                <Label for="reset-password">New Password</Label>
                <Input
                    id="reset-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    bind:value={resetPasswordValue}
                    minlength={8}
                    required />
            </div>

            <Dialog.Footer class="mt-4">
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showPasswordDialog = false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isResettingPassword}>
                    {#if isResettingPassword}
                        <Loader2 class="mr-1.5 size-4 animate-spin" />
                    {/if}
                    Save New Password
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- ── Suspend / Ban Confirm Dialog ── -->
<Dialog.Root bind:open={showBanConfirmDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>
                {targetUserForBan?.banned ? "Reactivate User Account" : "Suspend User Account"}
            </Dialog.Title>
            <Dialog.Description>
                {#if targetUserForBan?.banned}
                    Reactivating will immediately restore full platform access for <span
                        class="text-foreground font-semibold"
                        >{targetUserForBan?.username || targetUserForBan?.name}</span
                    >.
                {:else}
                    Suspended users will be immediately logged out and unable to authenticate or
                    access the platform.
                {/if}
            </Dialog.Description>
        </Dialog.Header>

        {#if !targetUserForBan?.banned}
            <div class="flex flex-col gap-1.5 py-2">
                <Label for="ban-reason">Suspension Reason (optional)</Label>
                <Input
                    id="ban-reason"
                    placeholder="e.g. Terms violation or excessive quota usage"
                    bind:value={banReasonInput} />
            </div>
        {/if}

        <Dialog.Footer class="mt-4">
            <Button variant="outline" type="button" onclick={() => (showBanConfirmDialog = false)}>
                Cancel
            </Button>
            <Button
                variant={targetUserForBan?.banned ? "default" : "destructive"}
                type="button"
                disabled={isBanningUser}
                onclick={handleToggleBan}>
                {#if isBanningUser}
                    <Loader2 class="mr-1.5 size-4 animate-spin" />
                {/if}
                {targetUserForBan?.banned ? "Reactivate Account" : "Suspend Account"}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- ── Delete Confirm Dialog ── -->
<Dialog.Root bind:open={showDeleteConfirmDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title class="text-destructive flex items-center gap-2">
                <AlertTriangle class="size-5" />
                Delete User Account
            </Dialog.Title>
            <Dialog.Description>
                Are you sure you want to permanently delete the account for <span
                    class="text-foreground font-semibold"
                    >{targetUserForDelete?.username || targetUserForDelete?.name}</span
                >? This action cannot be undone and all associated sessions will be destroyed.
            </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer class="mt-4">
            <Button
                variant="outline"
                type="button"
                onclick={() => (showDeleteConfirmDialog = false)}>
                Cancel
            </Button>
            <Button
                variant="destructive"
                type="button"
                disabled={isDeletingUser}
                onclick={handleDeleteUser}>
                {#if isDeletingUser}
                    <Loader2 class="mr-1.5 size-4 animate-spin" />
                {/if}
                Permanently Delete
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
