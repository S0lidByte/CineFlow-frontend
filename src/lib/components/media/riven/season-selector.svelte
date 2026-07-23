<script lang="ts">
    import { SvelteSet } from "svelte/reactivity";

    export interface EpisodeInfo {
        id: number;
        episode_number: number;
        title: string;
        status?: string;
    }

    export interface SeasonInfo {
        id: number;
        season_number: number;
        episode_count: number;
        name: string;
        status?: string;
        episodes?: EpisodeInfo[];
    }

    interface Props {
        seasons: SeasonInfo[];
        open: boolean;
        selectedSeasons?: SvelteSet<number>;
        selectedEpisodes?: SvelteSet<string>;
        episodeSelection?: boolean;
        class?: string;
    }

    let {
        seasons,
        open,
        selectedSeasons = $bindable(new SvelteSet<number>()),
        selectedEpisodes = $bindable(new SvelteSet<string>()),
        episodeSelection = false,
        class: className = ""
    }: Props = $props();

    let hasInitialized = $state(false);

    function episodeKey(seasonNumber: number, episodeNumber: number) {
        return `${seasonNumber}:${episodeNumber}`;
    }

    function isSeasonLocked(season: SeasonInfo): boolean {
        return season.status === "Available" || season.status === "Unreleased";
    }

    function isEpisodeLocked(episode: EpisodeInfo): boolean {
        return episode.status === "Available" || episode.status === "Unreleased";
    }

    function hasEpisodeChoices(season: SeasonInfo): boolean {
        return episodeSelection && Boolean(season.episodes?.length);
    }

    function requestableEpisodes(season: SeasonInfo): EpisodeInfo[] {
        return (season.episodes ?? []).filter((episode) => !isEpisodeLocked(episode));
    }

    function selectedEpisodeCount(season: SeasonInfo): number {
        return requestableEpisodes(season).filter((episode) =>
            selectedEpisodes.has(episodeKey(season.season_number, episode.episode_number))
        ).length;
    }

    $effect(() => {
        if (open && seasons.length > 0 && !hasInitialized) {
            // Select only requestable seasons by default.
            // Already available seasons are locked and should not be part of the selection payload.
            selectedSeasons.clear();
            selectedEpisodes.clear();
            for (const s of seasons) {
                if (hasEpisodeChoices(s)) {
                    for (const episode of requestableEpisodes(s)) {
                        selectedEpisodes.add(episodeKey(s.season_number, episode.episode_number));
                    }
                } else if (!isSeasonLocked(s)) {
                    selectedSeasons.add(s.season_number);
                }
            }
            hasInitialized = true;
        }
        // Reset hasInitialized when dialog closes so next open re-initializes
        if (!open) {
            hasInitialized = false;
        }
    });

    function toggleSeason(season: SeasonInfo) {
        if (hasEpisodeChoices(season)) {
            const episodes = requestableEpisodes(season);
            if (episodes.length === 0) return;

            const allSelected = episodes.every((episode) =>
                selectedEpisodes.has(episodeKey(season.season_number, episode.episode_number))
            );

            for (const episode of episodes) {
                const key = episodeKey(season.season_number, episode.episode_number);
                if (allSelected) {
                    selectedEpisodes.delete(key);
                } else {
                    selectedEpisodes.add(key);
                }
            }
            return;
        }

        // Don't allow toggling locked (Available) seasons
        if (isSeasonLocked(season)) return;

        if (selectedSeasons.has(season.season_number)) {
            selectedSeasons.delete(season.season_number);
        } else {
            selectedSeasons.add(season.season_number);
        }
    }

    function toggleEpisode(season: SeasonInfo, episode: EpisodeInfo) {
        if (isEpisodeLocked(episode)) return;

        const key = episodeKey(season.season_number, episode.episode_number);
        if (selectedEpisodes.has(key)) {
            selectedEpisodes.delete(key);
        } else {
            selectedEpisodes.add(key);
        }
    }
</script>

<div class="{className} flex w-full flex-col gap-0.5">
    {#each seasons as season (season.id)}
        {@const episodeMode = hasEpisodeChoices(season)}
        {@const requestableEpisodeCount = requestableEpisodes(season).length}
        {@const selectedEpisodeTotal = selectedEpisodeCount(season)}
        {@const locked = episodeMode ? requestableEpisodeCount === 0 : isSeasonLocked(season)}
        {@const selected = episodeMode
            ? selectedEpisodeTotal > 0
            : selectedSeasons.has(season.season_number)}
        <button
            class="group hover:bg-muted/30 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-all {locked
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'} {selected && !locked
                ? 'text-primary font-bold'
                : 'text-foreground font-medium'}"
            onclick={() => toggleSeason(season)}
            disabled={locked}
            title={season.name}>
            <span>Season {season.season_number}</span>

            {#if locked}
                <span class="text-xs font-normal opacity-70"
                    >{season.status === "Unreleased" ? "Unreleased" : "Installed"}</span>
            {:else if episodeMode}
                <span class="text-muted-foreground text-xs font-normal opacity-70"
                    >{selectedEpisodeTotal}/{requestableEpisodeCount} missing</span>
            {:else}
                <span class="text-muted-foreground text-xs font-normal opacity-70"
                    >{season.episode_count} eps</span>
            {/if}
        </button>
        {#if episodeMode}
            <div class="border-border/50 ml-5 flex flex-col gap-0.5 border-l pl-2">
                {#each season.episodes ?? [] as episode, epIdx (`${episode.id}-${episode.episode_number}-${epIdx}`)}
                    {@const episodeLocked = isEpisodeLocked(episode)}
                    {@const episodeSelected = selectedEpisodes.has(
                        episodeKey(season.season_number, episode.episode_number)
                    )}
                    <button
                        class="group hover:bg-muted/30 grid min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-all {episodeLocked
                            ? 'cursor-not-allowed opacity-45'
                            : 'cursor-pointer'} {episodeSelected && !episodeLocked
                            ? 'text-primary font-semibold'
                            : 'text-foreground'}"
                        onclick={() => toggleEpisode(season, episode)}
                        disabled={episodeLocked}
                        title={episode.title}>
                        <span class="truncate">E{episode.episode_number} {episode.title}</span>
                        <span class="text-muted-foreground text-[11px]">
                            {#if episode.status === "Available"}
                                Installed
                            {:else if episode.status === "Unreleased"}
                                Unreleased
                            {:else}
                                Missing
                            {/if}
                        </span>
                    </button>
                {/each}
            </div>
        {/if}
    {/each}
</div>
