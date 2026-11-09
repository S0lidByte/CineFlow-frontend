import type { components } from "$lib/providers/riven";

// /scrape/parse returns PTT metadata in an otherwise open generated dictionary.
export type AttachParsedMetadata =
    components["schemas"]["ParseTorrentTitleResponse"]["data"][number] & {
        title?: string;
        year?: number;
        seasons?: number[];
        episodes?: number[];
        resolution?: string;
    };

export function getAttachSearchQuery(filename: string, parsed?: AttachParsedMetadata): string {
    return parsed?.title?.trim() || filename;
}
