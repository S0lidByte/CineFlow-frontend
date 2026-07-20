<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import SeasonSelector, { type SeasonInfo } from "./season-selector.svelte";
    import { createScopedLogger } from "$lib/logger";
    import { type Snippet } from "svelte";
    import { SvelteSet } from "svelte/reactivity";

    const logger = createScopedLogger("item-request");

    interface Props {
        title: string | null | undefined;
        ids: (string | null | undefined)[];
        mediaType: string; //"movie" | "tv"
        seasons?: SeasonInfo[];
        buttonLabel?: string;
        externalId?: string; // TVDB or TMDB ID for scraping
        episodeSelection?: boolean;
        variant?:
            | "ghost"
            | "default"
            | "link"
            | "destructive"
            | "outline"
            | "secondary"
            | undefined;
        size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | undefined;
        class?: string;
        children?: Snippet;
    }
    let {
        title,
        ids,
        mediaType,
        seasons = [],
        buttonLabel = "Request",
        externalId,
        episodeSelection = false,
        variant = "ghost",
        size = "sm",
        class: className = "",
        children,
        ...restProps
    }: Props = $props();

    let open = $state(false);
    let loading = $state(false);

    // State for season selection - managed by SeasonSelector component
    /**
     * Set of selected season numbers for TV show requests.
     * Needs $state() because it is reassigned when the dialog resets.
     *
     * @see https://svelte.dev/docs/svelte/$state
     */
    // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- $state() required because selectedSeasons is reassigned on dialog close
    let selectedSeasons = $state(new SvelteSet<number>());
    // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- $state() required because selectedEpisodes is reassigned on dialog close
    let selectedEpisodes = $state(new SvelteSet<string>());

    const sortedSelectedSeasonNumbers = $derived.by(() =>
        Array.from(selectedSeasons)
            .filter((n) => Number.isInteger(n))
            .sort((a, b) => a - b)
    );

    const selectedEpisodeNumbersBySeason = $derived.by(() => {
        const bySeason: Record<string, number[]> = {};

        for (const key of selectedEpisodes) {
            const [seasonPart, episodePart] = key.split(":");
            const seasonNumber = Number(seasonPart);
            const episodeNumber = Number(episodePart);
            if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) continue;

            const seasonKey = seasonNumber.toString();
            bySeason[seasonKey] ??= [];
            bySeason[seasonKey].push(episodeNumber);
        }

        for (const episodeNumbers of Object.values(bySeason)) {
            episodeNumbers.sort((a, b) => a - b);
        }

        return bySeason;
    });

    const selectedEpisodeSeasonCount = $derived(Object.keys(selectedEpisodeNumbersBySeason).length);

    const requestableSelectionCount = $derived.by(() => {
        let count = 0;
        for (const season of seasons) {
            if (season.episodes?.length) {
                if (episodeSelection) {
                    count += season.episodes.filter(
                        (episode) =>
                            episode.status !== "Available" && episode.status !== "Unreleased"
                    ).length;
                } else if (season.status !== "Available" && season.status !== "Unreleased") {
                    count += 1;
                }
            } else if (season.status !== "Available" && season.status !== "Unreleased") {
                count += 1;
            }
        }
        return count;
    });

    const hasRequestableSelections = $derived(requestableSelectionCount > 0);
    const hasSelectedTvTargets = $derived(
        sortedSelectedSeasonNumbers.length > 0 || selectedEpisodeSeasonCount > 0
    );

    /**
     * Requests a media item via the Riven backend.
     *
     * For TV shows with selected seasons, calls `/api/v1/scrape/auto` which may return
     * either `{ data }` or `{ message }` on success. Both must be checked to avoid
     * silently dropping valid success responses.
     *
     * For movies (or TV without season selection), calls `/api/v1/items/add`.
     */
    async function addMediaItem(ids: (string | null | undefined)[], mediaType: string) {
        const validIds = ids.filter((id): id is string => id !== null && id !== undefined);

        try {
            if (mediaType === "tv" && seasons.length > 0 && hasSelectedTvTargets && externalId) {
                const body: {
                    media_type: "tv";
                    tvdb_id: string;
                    season_numbers?: number[];
                    episode_numbers?: Record<string, number[]>;
                } = {
                    media_type: "tv",
                    tvdb_id: externalId
                };

                if (sortedSelectedSeasonNumbers.length > 0) {
                    body.season_numbers = sortedSelectedSeasonNumbers;
                }

                if (selectedEpisodeSeasonCount > 0) {
                    body.episode_numbers = selectedEpisodeNumbersBySeason;
                }

                const response = await providers.riven.POST("/api/v1/scrape/auto", {
                    body
                });

                if (response.data?.message) {
                    toast.success("Media item requested successfully!");
                    open = false;
                } else {
                    logger.error("Error response:", response.error);
                    toast.error("Failed to request media item.");
                }
            } else {
                // Item not yet in Riven — add it fresh
                const extIds = externalId ? [externalId] : validIds;

                const response = await providers.riven.POST("/api/v1/items/add", {
                    body: {
                        media_type: mediaType as "movie" | "tv",
                        tmdb_ids: mediaType === "movie" ? extIds : [],
                        tvdb_ids: mediaType === "tv" ? extIds : []
                    }
                });

                if (response.data) {
                    toast.success("Media item requested successfully!");
                    open = false;
                } else {
                    logger.error("Error response:", response.error);
                    toast.error("Failed to request media item.");
                }
            }
        } catch (e) {
            logger.error("Request failed", e);
            toast.error("Failed to request media item.");
        }
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            <Button {variant} {size} class={className} {...restProps} {...props}>
                {#if children}
                    {@render children()}
                {:else}
                    {buttonLabel}
                {/if}
            </Button>
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>
                Requesting "{title ?? "Media Item"}"
            </AlertDialog.Title>
            <AlertDialog.Description>
                This will send a request to Riven to add this media.
            </AlertDialog.Description>
        </AlertDialog.Header>

        {#if mediaType === "tv" && seasons.length > 0}
            <SeasonSelector
                {seasons}
                {open}
                {episodeSelection}
                bind:selectedSeasons
                bind:selectedEpisodes
                class="my-4 max-h-[50vh] overflow-y-auto pr-1" />
        {:else}
            <div class="text-muted-foreground py-4 text-sm">
                This request will be approved automatically.
            </div>
        {/if}

        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                disabled={loading ||
                    (mediaType === "tv" &&
                        seasons.length > 0 &&
                        hasRequestableSelections &&
                        !hasSelectedTvTargets)}
                onclick={async () => {
                    loading = true;
                    await addMediaItem(ids, mediaType);
                    loading = false;
                    open = false;
                }}>
                {#if loading}
                    <Loader2 class="mr-1 inline-block animate-spin" />
                {/if}
                {mediaType === "tv" && seasons.length > 0 ? "Request Selected" : "Request"}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
