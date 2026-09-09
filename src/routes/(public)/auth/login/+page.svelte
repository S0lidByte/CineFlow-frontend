<script lang="ts">
    import * as Card from "$lib/components/ui/card/index.js";
    import * as Form from "$lib/components/ui/form/index.js";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { type SuperValidated, type Infer, superForm } from "sveltekit-superforms";
    import { zod4Client } from "sveltekit-superforms/adapters";
    import { loginSchema, registerSchema } from "$lib/schemas/auth";
    import { toast } from "svelte-sonner";
    import { onMount, untrack } from "svelte";
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { doesBrowserSupportPasskeys } from "$lib/passkeys";
    import { readable } from "svelte/store";
    import { createScopedLogger } from "$lib/logger";

    import Clapperboard from "@lucide/svelte/icons/clapperboard";
    import Fingerprint from "@lucide/svelte/icons/fingerprint";
    import Eye from "@lucide/svelte/icons/eye";
    import EyeOff from "@lucide/svelte/icons/eye-off";
    import Star from "@lucide/svelte/icons/star";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import ShieldCheck from "@lucide/svelte/icons/shield-check";
    import Zap from "@lucide/svelte/icons/zap";
    import Film from "@lucide/svelte/icons/film";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import Lock from "@lucide/svelte/icons/lock";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";

    const logger = createScopedLogger("login");

    type AuthProvider = { enabled: boolean; disableSignup: boolean; name?: string; icon?: string };

    let {
        data
    }: {
        data: {
            loginForm: SuperValidated<Infer<typeof loginSchema>>;
            registerForm: SuperValidated<Infer<typeof registerSchema>> | null;
            authProviders: Record<string, AuthProvider>;
            isFirstUser: boolean;
        };
    } = $props();

    const loginForm = superForm(
        untrack(() => data.loginForm),
        {
            validators: zod4Client(loginSchema),
            resetForm: false
        }
    );

    // svelte-ignore state_referenced_locally
    const registerForm = data.registerForm
        ? superForm(
              untrack(() => data.registerForm!),
              {
                  validators: zod4Client(registerSchema),
                  resetForm: false
              }
          )
        : null;

    const {
        form: loginFormData,
        enhance: loginEnhance,
        message: loginMessage,
        delayed: loginDelayed
    } = loginForm;

    const dummyStore = readable(null);
    const registerFormData = registerForm ? registerForm.form : dummyStore;
    const registerEnhance = registerForm ? registerForm.enhance : () => {};
    const registerMessage = registerForm ? registerForm.message : dummyStore;
    const registerDelayed = registerForm ? registerForm.delayed : readable(false);

    let showLoginPassword = $state(false);
    let showRegisterPassword = $state(false);
    let showRegisterConfirmPassword = $state(false);

    $effect(() => {
        if ($loginMessage) {
            toast.info($loginMessage);
        }

        if ($registerMessage) {
            toast.info($registerMessage);
        }
    });

    const isSignupEnabled = $derived(
        (data.authProviders.credential?.enabled && !data.authProviders.credential?.disableSignup) ||
            data.isFirstUser
    );

    // svelte-ignore state_referenced_locally
    let activeTab = $state(data.isFirstUser ? "register" : "login");

    async function plexLogin() {
        await authClient.signIn.oauth2({
            providerId: "plex",
            callbackURL: "/"
        });
    }

    let isPasskeyLoading = $state(false);
    let supportsPasskeyAutofill = $state(false);
    let supportsPasskey = $state<boolean | undefined>(doesBrowserSupportPasskeys());

    onMount(async () => {
        if (
            doesBrowserSupportPasskeys() &&
            typeof window.PublicKeyCredential.isConditionalMediationAvailable === "function"
        ) {
            supportsPasskeyAutofill =
                await window.PublicKeyCredential.isConditionalMediationAvailable();

            if (supportsPasskeyAutofill) {
                void authClient.signIn.passkey({
                    autoFill: true,
                    fetchOptions: {
                        async onSuccess() {
                            await goto(resolve("/"));
                        },
                        onError(context) {
                            logger.debug("Passkey autofill failed:", context.error);
                        }
                    }
                });
            }
        }
    });

    async function handlePasskeySignIn() {
        isPasskeyLoading = true;
        try {
            await authClient.signIn.passkey({
                fetchOptions: {
                    async onSuccess() {
                        await goto(resolve("/"));
                    },
                    onError(context) {
                        toast.error(context.error.message || "Passkey authentication failed");
                    }
                }
            });
        } catch {
            toast.error("Passkey authentication failed");
        } finally {
            isPasskeyLoading = false;
        }
    }

    const lastLoginMethod = authClient.getLastUsedLoginMethod();
</script>

<svelte:head>
    <title>{data.isFirstUser ? "Initial Setup" : "Sign In"} - CineFlow</title>
</svelte:head>

{#snippet starBadge()}
    <span
        class="bg-primary/20 text-primary border-primary/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
        <Star class="h-3 w-3 fill-amber-400 text-amber-400" />
        Last used
    </span>
{/snippet}

<div
    class="bg-background relative flex min-h-svh w-full flex-col overflow-x-hidden lg:grid lg:grid-cols-12">
    <!-- Left Column: Auth Forms & Identity -->
    <div
        class="lg:border-border/60 relative z-10 flex min-h-svh flex-col justify-between p-6 sm:p-8 md:p-12 lg:col-span-6 lg:border-r xl:col-span-5">
        <!-- Brand Header -->
        <div class="flex items-center justify-between">
            <a
                href={resolve("/")}
                class="group flex items-center gap-3 transition-opacity hover:opacity-90">
                <div
                    class="bg-primary text-primary-foreground shadow-primary/25 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-105">
                    <Clapperboard class="h-5 w-5" />
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-sans text-xl font-bold tracking-wider">CINEFLOW</span>
                        <Badge
                            variant="outline"
                            class="px-1.5 py-0 font-mono text-[10px] uppercase">
                            v2.0
                        </Badge>
                    </div>
                    <p class="text-muted-foreground text-xs">Media Streaming Engine</p>
                </div>
            </a>
        </div>

        <!-- Center Form Box -->
        <div class="mx-auto my-auto w-full max-w-md py-8">
            {#if data.isFirstUser}
                <div
                    class="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
                    <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div class="text-sm">
                        <p class="font-semibold text-amber-200">First-Time System Initialization</p>
                        <p class="mt-0.5 text-xs leading-relaxed text-amber-300/90">
                            No accounts exist yet. The first user created will automatically be
                            designated as the <strong>System Administrator</strong>.
                        </p>
                    </div>
                </div>
            {/if}

            <Tabs.Root bind:value={activeTab} class="w-full">
                {#if isSignupEnabled}
                    <Tabs.List class="mb-6 grid w-full grid-cols-2">
                        <Tabs.Trigger value="login" class="text-sm font-medium"
                            >Sign In</Tabs.Trigger>
                        <Tabs.Trigger value="register" class="text-sm font-medium">
                            {data.isFirstUser ? "Admin Setup" : "Create Account"}
                        </Tabs.Trigger>
                    </Tabs.List>
                {/if}

                <!-- Sign In Tab -->
                <Tabs.Content value="login">
                    <Card.Root class="border-border/80 bg-card/85 shadow-2xl backdrop-blur-xl">
                        <Card.Header class="space-y-1">
                            <Card.Title class="text-2xl font-bold tracking-tight"
                                >Sign In</Card.Title>
                            <Card.Description>
                                Enter your credentials to access your CineFlow workspace
                            </Card.Description>
                        </Card.Header>
                        <Card.Content class="space-y-4">
                            {#if data.authProviders.credential?.enabled}
                                <form
                                    method="POST"
                                    use:loginEnhance
                                    action="?/login"
                                    class="space-y-4">
                                    <Form.Field form={loginForm} name="username">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Username
                                                </Form.Label>
                                                <div class="relative">
                                                    <Input
                                                        {...props}
                                                        autocomplete="username webauthn"
                                                        placeholder="Enter your username"
                                                        bind:value={$loginFormData.username}
                                                        class="h-10" />
                                                </div>
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Form.Field form={loginForm} name="password">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Password
                                                </Form.Label>
                                                <ButtonGroup.Root class="w-full">
                                                    <Input
                                                        {...props}
                                                        type={showLoginPassword
                                                            ? "text"
                                                            : "password"}
                                                        autocomplete="current-password webauthn"
                                                        placeholder="••••••••"
                                                        bind:value={$loginFormData.password}
                                                        class="h-10" />
                                                    <Button
                                                        type="button"
                                                        onclick={() =>
                                                            (showLoginPassword =
                                                                !showLoginPassword)}
                                                        variant="outline"
                                                        size="icon"
                                                        class="h-10 w-10 shrink-0"
                                                        aria-label="Toggle password visibility">
                                                        {#if showLoginPassword}
                                                            <EyeOff
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {:else}
                                                            <Eye
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {/if}
                                                    </Button>
                                                </ButtonGroup.Root>
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Button
                                        type="submit"
                                        disabled={$loginDelayed}
                                        class="shadow-primary/20 hover:shadow-primary/30 h-10 w-full font-semibold shadow-md transition-all">
                                        {#if $loginDelayed}
                                            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                                            Authenticating...
                                        {:else}
                                            Sign In
                                        {/if}
                                    </Button>
                                </form>

                                <div class="relative my-4">
                                    <div class="absolute inset-0 flex items-center">
                                        <span class="border-border/80 w-full border-t"></span>
                                    </div>
                                    <div class="relative flex justify-center text-xs uppercase">
                                        <span
                                            class="bg-card text-muted-foreground px-3 text-[11px] font-medium tracking-wider">
                                            Or continue with
                                        </span>
                                    </div>
                                </div>
                            {/if}

                            <div class="flex flex-col gap-2.5">
                                {#if supportsPasskey}
                                    <Button
                                        variant={lastLoginMethod === "passkey"
                                            ? "secondary"
                                            : "outline"}
                                        class="hover:border-primary/50 relative h-10 w-full justify-between px-4 transition-all"
                                        disabled={isPasskeyLoading}
                                        onclick={handlePasskeySignIn}
                                        type="button">
                                        <div class="flex items-center gap-2">
                                            <Fingerprint class="text-primary h-4 w-4" />
                                            <span class="text-sm font-medium">
                                                {isPasskeyLoading
                                                    ? "Authenticating Passkey..."
                                                    : "Sign in with Passkey"}
                                            </span>
                                        </div>
                                        {#if lastLoginMethod === "passkey"}
                                            {@render starBadge()}
                                        {/if}
                                    </Button>
                                {/if}

                                {#each Object.entries(data.authProviders) as [key, provider] (key)}
                                    {#if key !== "credential" && provider.enabled}
                                        {@const providerName =
                                            provider.name ||
                                            key.charAt(0).toUpperCase() + key.slice(1)}
                                        <Button
                                            onclick={async () => {
                                                if (key === "plex") {
                                                    await plexLogin();
                                                } else {
                                                    await authClient.signIn.oauth2({
                                                        providerId: key,
                                                        callbackURL: "/"
                                                    });
                                                }
                                            }}
                                            variant={lastLoginMethod === key
                                                ? "secondary"
                                                : "outline"}
                                            class="hover:border-primary/50 relative h-10 w-full justify-between px-4 transition-all"
                                            type="button">
                                            <div class="flex items-center gap-2">
                                                {#if key === "plex"}
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 512 512"
                                                        class="h-4 w-4 fill-amber-500">
                                                        <path
                                                            d="M256 70H148l108 186-108 186h108l108-186z" />
                                                    </svg>
                                                {:else if provider.icon}
                                                    <img
                                                        src={provider.icon}
                                                        alt="{providerName} icon"
                                                        class="h-4 w-4 object-contain" />
                                                {:else}
                                                    <Lock class="text-muted-foreground h-4 w-4" />
                                                {/if}
                                                <span class="text-sm font-medium"
                                                    >Sign in with {providerName}</span>
                                            </div>
                                            {#if lastLoginMethod === key}
                                                {@render starBadge()}
                                            {/if}
                                        </Button>
                                    {/if}
                                {/each}
                            </div>
                        </Card.Content>
                    </Card.Root>
                </Tabs.Content>

                <!-- Create Account / Setup Tab -->
                {#if isSignupEnabled && registerForm && registerEnhance && $registerFormData}
                    <Tabs.Content value="register">
                        <Card.Root class="border-border/80 bg-card/85 shadow-2xl backdrop-blur-xl">
                            <Card.Header class="space-y-1">
                                <Card.Title class="text-2xl font-bold tracking-tight">
                                    {data.isFirstUser ? "Administrator Setup" : "Create Account"}
                                </Card.Title>
                                <Card.Description>
                                    {data.isFirstUser
                                        ? "Configure your primary administrator credentials"
                                        : "Enter your account details to join this CineFlow instance"}
                                </Card.Description>
                            </Card.Header>
                            <Card.Content>
                                <form
                                    method="POST"
                                    use:registerEnhance
                                    action="?/register"
                                    class="space-y-4">
                                    <Form.Field form={registerForm} name="username">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Username
                                                </Form.Label>
                                                <Input
                                                    {...props}
                                                    placeholder="e.g. admin or username"
                                                    bind:value={$registerFormData.username}
                                                    class="h-10" />
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Form.Field form={registerForm} name="email">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Email Address
                                                </Form.Label>
                                                <Input
                                                    {...props}
                                                    type="email"
                                                    placeholder="you@example.com"
                                                    bind:value={$registerFormData.email}
                                                    class="h-10" />
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Form.Field form={registerForm} name="password">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Password
                                                </Form.Label>
                                                <ButtonGroup.Root class="w-full">
                                                    <Input
                                                        {...props}
                                                        type={showRegisterPassword
                                                            ? "text"
                                                            : "password"}
                                                        placeholder="Minimum 8 characters"
                                                        bind:value={$registerFormData.password}
                                                        class="h-10" />
                                                    <Button
                                                        type="button"
                                                        onclick={() =>
                                                            (showRegisterPassword =
                                                                !showRegisterPassword)}
                                                        variant="outline"
                                                        size="icon"
                                                        class="h-10 w-10 shrink-0"
                                                        aria-label="Toggle password visibility">
                                                        {#if showRegisterPassword}
                                                            <EyeOff
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {:else}
                                                            <Eye
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {/if}
                                                    </Button>
                                                </ButtonGroup.Root>
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Form.Field form={registerForm} name="confirmPassword">
                                        <Form.Control>
                                            {#snippet children({ props })}
                                                <Form.Label
                                                    class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    Confirm Password
                                                </Form.Label>
                                                <ButtonGroup.Root class="w-full">
                                                    <Input
                                                        {...props}
                                                        type={showRegisterConfirmPassword
                                                            ? "text"
                                                            : "password"}
                                                        placeholder="Re-enter password"
                                                        bind:value={
                                                            $registerFormData.confirmPassword
                                                        }
                                                        class="h-10" />
                                                    <Button
                                                        type="button"
                                                        onclick={() =>
                                                            (showRegisterConfirmPassword =
                                                                !showRegisterConfirmPassword)}
                                                        variant="outline"
                                                        size="icon"
                                                        class="h-10 w-10 shrink-0"
                                                        aria-label="Toggle password visibility">
                                                        {#if showRegisterConfirmPassword}
                                                            <EyeOff
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {:else}
                                                            <Eye
                                                                class="text-muted-foreground h-4 w-4" />
                                                        {/if}
                                                    </Button>
                                                </ButtonGroup.Root>
                                            {/snippet}
                                        </Form.Control>
                                        <Form.FieldErrors class="text-xs" />
                                    </Form.Field>

                                    <Button
                                        type="submit"
                                        disabled={$registerDelayed}
                                        class="shadow-primary/20 hover:shadow-primary/30 h-10 w-full font-semibold shadow-md transition-all">
                                        {#if $registerDelayed}
                                            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
                                            {data.isFirstUser
                                                ? "Initializing Admin..."
                                                : "Creating Account..."}
                                        {:else}
                                            {data.isFirstUser
                                                ? "Initialize Administrator"
                                                : "Create Account"}
                                        {/if}
                                    </Button>
                                </form>
                            </Card.Content>
                        </Card.Root>
                    </Tabs.Content>
                {/if}
            </Tabs.Root>
        </div>

        <!-- Footer -->
        <div class="text-muted-foreground flex items-center justify-between text-xs">
            <span>© {new Date().getFullYear()} CineFlow</span>
            <div class="flex items-center gap-2">
                <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                <span>System Online</span>
            </div>
        </div>
    </div>

    <!-- Right Column: CineFlow Cinematic Showcase & Ambient Backdrop -->
    <div
        class="from-card/60 via-background to-primary/5 relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br p-12 lg:col-span-6 lg:flex xl:col-span-7">
        <!-- Ambient Glowing Gradients -->
        <div
            class="bg-primary/20 pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl">
        </div>
        <div
            class="pointer-events-none absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl">
        </div>
        <div
            class="pointer-events-none absolute right-1/3 -bottom-24 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl">
        </div>

        <!-- Background Grid Pattern -->
        <div
            class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] bg-[size:24px_24px]">
        </div>

        <!-- Showcase Top Badge -->
        <div class="relative z-10 flex items-center justify-between">
            <div
                class="border-border/80 bg-background/60 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md">
                <span class="relative flex h-2 w-2">
                    <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                    ></span>
                    <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span class="text-xs font-medium tracking-wide"
                    >Bitrate-Adaptive VFS & Orchestration</span>
            </div>
        </div>

        <!-- Showcase Center: Headline and Core Feature Highlights -->
        <div class="relative z-10 my-auto max-w-xl space-y-8">
            <div class="space-y-3">
                <h1
                    class="from-foreground via-foreground/90 to-muted-foreground bg-gradient-to-r bg-clip-text font-sans text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                    Intelligent Media Streaming at Scale.
                </h1>
                <p class="text-muted-foreground text-base leading-relaxed">
                    Zero-compromise media orchestration. Direct cloud debrid integration, real-time
                    subtitle resolution, multi-provider scraping, and hardware passkey
                    authentication.
                </p>
            </div>

            <!-- Feature Showcase Glass Cards -->
            <div class="grid gap-3.5">
                <div
                    class="border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card/80 flex items-start gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all">
                    <div
                        class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        <Zap class="h-5 w-5" />
                    </div>
                    <div class="space-y-1">
                        <h3 class="text-sm font-semibold">Trio-Native High-Throughput VFS</h3>
                        <p class="text-muted-foreground text-xs leading-relaxed">
                            Mount-scoped connection pooling, single-flight error recovery, and
                            instant HTTP range chunk streaming.
                        </p>
                    </div>
                </div>

                <div
                    class="border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card/80 flex items-start gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Sparkles class="h-5 w-5" />
                    </div>
                    <div class="space-y-1">
                        <h3 class="text-sm font-semibold">Smart Rank Torrent Name (RTN) Engine</h3>
                        <p class="text-muted-foreground text-xs leading-relaxed">
                            Multi-source indexer coordination, codec & audio track extraction, and
                            strict quality prioritization.
                        </p>
                    </div>
                </div>

                <div
                    class="border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card/80 flex items-start gap-4 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <ShieldCheck class="h-5 w-5" />
                    </div>
                    <div class="space-y-1">
                        <h3 class="text-sm font-semibold">
                            FIDO2 Hardware Passkeys & BFF Isolation
                        </h3>
                        <p class="text-muted-foreground text-xs leading-relaxed">
                            Biometric passkey sign-in, server-isolated API credentials, and signed
                            actor request routing.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Showcase Bottom Badge -->
        <div class="text-muted-foreground relative z-10 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
                <Film class="text-primary h-4 w-4" />
                <span>Engineered for seamless Plex & Debrid playback</span>
            </div>
            <span class="text-muted-foreground/80 font-mono text-[11px]"
                >CineFlow Architecture</span>
        </div>
    </div>
</div>
