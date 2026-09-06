/**
 * Parser for `/api/v1/items/add` backend responses.
 *
 * Backend response format examples:
 * - "Added 1 new item(s)"
 * - "Added 0 new item(s). requeued 1 existing item(s)"
 * - "Added 2 new item(s). requeued 1 existing item(s)"
 * - "Added 0 new item(s). skipped 1 existing item(s) in terminal/paused states"
 * - "Added 0 new item(s). 1 TVDB ID(s) not found: 99999"
 */

export interface AddItemsParsedResult {
    success: boolean;
    addedCount: number;
    requeuedCount: number;
    skippedCount: number;
    failedCount: number;
    message: string;
    toastMessage: string;
}

export function parseAddItemsResponse(message: string | null | undefined): AddItemsParsedResult {
    const rawMessage = (message ?? "").trim();

    if (!rawMessage) {
        return {
            success: false,
            addedCount: 0,
            requeuedCount: 0,
            skippedCount: 0,
            failedCount: 0,
            message: "",
            toastMessage: "Failed to request media item."
        };
    }

    const addedMatch = rawMessage.match(/Added (\d+) new item\(s\)/i);
    const requeuedMatch = rawMessage.match(/requeued (\d+) existing item\(s\)/i);
    const skippedMatch = rawMessage.match(/skipped (\d+) existing item\(s\)/i);
    const failedMatch = rawMessage.match(/(\d+)\s+(?:TVDB|TMDB)\s+ID\(s\)\s+not found/i);

    const addedCount = addedMatch ? Number(addedMatch[1]) : 0;
    const requeuedCount = requeuedMatch ? Number(requeuedMatch[1]) : 0;
    const skippedCount = skippedMatch ? Number(skippedMatch[1]) : 0;
    const failedCount = failedMatch ? Number(failedMatch[1]) : 0;

    const isSuccess = addedCount > 0 || requeuedCount > 0;

    let toastMessage: string;
    if (addedCount > 0 && requeuedCount > 0) {
        toastMessage = `Media items processed (${addedCount} added, ${requeuedCount} requeued)!`;
    } else if (requeuedCount > 0) {
        toastMessage = "Media item requeued!";
    } else if (addedCount > 0) {
        toastMessage = "Media item requested successfully!";
    } else {
        toastMessage = rawMessage || "Failed to request media item.";
    }

    return {
        success: isSuccess,
        addedCount,
        requeuedCount,
        skippedCount,
        failedCount,
        message: rawMessage,
        toastMessage
    };
}
