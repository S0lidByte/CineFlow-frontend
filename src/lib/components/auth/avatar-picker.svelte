<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { getInitials } from "$lib/utils";
    import { sanitizeAvatarUrl } from "$lib/utils/auth";
    import Check from "@lucide/svelte/icons/check";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import Link from "@lucide/svelte/icons/link";
    import User from "@lucide/svelte/icons/user";

    interface Props {
        value: string;
        userName?: string;
        onSelect?: (url: string) => void;
    }

    let { value = $bindable(""), userName = "User", onSelect }: Props = $props();

    let showCustomUrlInput = $state(false);
    let customUrlText = $state("");

    $effect(() => {
        if (value && !PRESETS.some((p) => p.url === value)) {
            customUrlText = value;
        }
    });

    const PRESETS = [
        {
            id: "initials",
            name: "Default Initials",
            url: "",
            icon: "initials"
        },
        {
            id: "cineflow",
            name: "CineFlow Reel",
            url: "https://api.dicebear.com/7.x/identicon/svg?seed=CineFlow"
        },
        {
            id: "cosmic",
            name: "Cosmic Bot",
            url: "https://api.dicebear.com/7.x/bottts/svg?seed=Cosmic"
        },
        {
            id: "cyber",
            name: "Cyber Neon",
            url: "https://api.dicebear.com/7.x/bottts/svg?seed=CyberNeon"
        },
        {
            id: "hero",
            name: "Pixel Hero",
            url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=PixelHero"
        },
        {
            id: "gamer",
            name: "Retro Gamer",
            url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=RetroGamer"
        },
        {
            id: "mystic",
            name: "Mystic Orb",
            url: "https://api.dicebear.com/7.x/identicon/svg?seed=MysticOrb"
        },
        {
            id: "nebula",
            name: "Nebula Drift",
            url: "https://api.dicebear.com/7.x/identicon/svg?seed=NebulaDrift"
        },
        {
            id: "matrix",
            name: "Matrix Bot",
            url: "https://api.dicebear.com/7.x/bottts/svg?seed=MatrixBot"
        },
        {
            id: "sunset",
            name: "Sunset Glow",
            url: "https://api.dicebear.com/7.x/identicon/svg?seed=SunsetGlow"
        },
        {
            id: "emerald",
            name: "Emerald Star",
            url: "https://api.dicebear.com/7.x/identicon/svg?seed=EmeraldStar"
        },
        {
            id: "quantum",
            name: "Quantum Core",
            url: "https://api.dicebear.com/7.x/bottts/svg?seed=QuantumCore"
        }
    ];

    function selectPreset(url: string) {
        value = url;
        onSelect?.(url);
    }

    function applyCustomUrl() {
        const sanitized = sanitizeAvatarUrl(customUrlText);
        value = sanitized;
        onSelect?.(sanitized);
    }
</script>

<div class="flex flex-col gap-4">
    <!-- Live Preview Header -->
    <div class="border-border/40 bg-muted/20 flex items-center gap-4 rounded-lg border p-3">
        <Avatar.Root class="ring-primary/20 h-14 w-14 ring-2">
            {#if value}
                <Avatar.Image src={value} alt={userName} />
            {/if}
            <Avatar.Fallback class="bg-primary text-primary-foreground text-lg font-semibold">
                {getInitials(userName)}
            </Avatar.Fallback>
        </Avatar.Root>
        <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">Avatar Preview</p>
            <p class="text-muted-foreground truncate text-xs">
                {value ? value : "Using default initials fallback"}
            </p>
        </div>
    </div>

    <!-- Presets Grid -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span
                class="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                <Sparkles class="h-3.5 w-3.5" />
                Choose a Preset
            </span>
            <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-foreground h-7 text-xs"
                onclick={() => (showCustomUrlInput = !showCustomUrlInput)}>
                <Link class="mr-1.5 h-3.5 w-3.5" />
                {showCustomUrlInput ? "Hide Custom URL" : "Custom URL"}
            </Button>
        </div>

        <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {#each PRESETS as preset (preset.id)}
                {@const isSelected = value === preset.url}
                <button
                    type="button"
                    title={preset.name}
                    class="group hover:border-primary/60 relative flex aspect-square items-center justify-center rounded-lg border transition-all hover:scale-105 {isSelected
                        ? 'border-primary ring-primary/30 bg-primary/5 ring-2'
                        : 'border-border/60 bg-card hover:bg-muted/40'}"
                    onclick={() => selectPreset(preset.url)}>
                    {#if preset.url}
                        <img
                            src={preset.url}
                            alt={preset.name}
                            loading="lazy"
                            class="h-8 w-8 rounded-full object-cover" />
                    {:else}
                        <div
                            class="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                            <User class="h-4 w-4" />
                        </div>
                    {/if}
                    {#if isSelected}
                        <div
                            class="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full shadow-xs">
                            <Check class="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                    {/if}
                </button>
            {/each}
        </div>
    </div>

    <!-- Custom URL Input (Collapsible/Toggle) -->
    {#if showCustomUrlInput}
        <div class="border-border/60 bg-card/60 flex flex-col gap-2 rounded-lg border p-3 pt-2">
            <label for="custom-avatar-url" class="text-muted-foreground text-xs font-medium"
                >Custom Image URL</label>
            <div class="flex gap-2">
                <Input
                    id="custom-avatar-url"
                    type="url"
                    placeholder="https://example.com/avatar.png"
                    bind:value={customUrlText}
                    class="h-8 text-xs"
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            applyCustomUrl();
                        }
                    }} />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="h-8 text-xs"
                    onclick={applyCustomUrl}>
                    Apply
                </Button>
            </div>
        </div>
    {/if}
</div>
