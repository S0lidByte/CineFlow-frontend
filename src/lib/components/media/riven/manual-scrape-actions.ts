export interface ScrapeActionResult {
    data?: unknown;
    error?: unknown;
}

export interface ManualScrapeActions {
    selectFiles: () => Promise<ScrapeActionResult>;
    updateAttributes?: () => Promise<ScrapeActionResult>;
    complete: () => Promise<ScrapeActionResult>;
}

function getActionError(error: unknown, fallback: string): string {
    if (typeof error === "object" && error !== null) {
        const errorObject = error as Record<string, unknown>;
        if (typeof errorObject.detail === "string") return errorObject.detail;
        if (typeof errorObject.message === "string") return errorObject.message;
        const serialized = JSON.stringify(error);
        if (serialized && serialized !== "{}") return serialized;
    }
    return fallback;
}

function requireActionSuccess(result: ScrapeActionResult, fallback: string): void {
    if (result.error || !result.data) {
        throw new Error(getActionError(result.error, fallback));
    }
}

export async function runManualScrapeActions(actions: ManualScrapeActions): Promise<void> {
    const selected = await actions.selectFiles();
    requireActionSuccess(selected, "Failed to select files");

    if (actions.updateAttributes) {
        const updated = await actions.updateAttributes();
        requireActionSuccess(updated, "Failed to attach selected files to the media item");
    }

    const completed = await actions.complete();
    requireActionSuccess(completed, "Failed to complete the manual scrape session");
}
