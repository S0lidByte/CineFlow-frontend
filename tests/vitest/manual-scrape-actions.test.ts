import { expect, test, vi } from "vitest";
import { runManualScrapeActions } from "../../src/lib/components/media/riven/manual-scrape-actions";

test("successful cached manual download runs select, update, then complete", async () => {
    const calls: string[] = [];
    await runManualScrapeActions({
        selectFiles: async () => {
            calls.push("select");
            return { data: { message: "selected" } };
        },
        updateAttributes: async () => {
            calls.push("update");
            return { data: { message: "updated" } };
        },
        complete: async () => {
            calls.push("complete");
            return { data: { message: "completed" } };
        }
    });
    expect(calls).toEqual(["select", "update", "complete"]);
});

test("a returned select_files error stops before update and complete", async () => {
    const update = vi.fn(async () => ({ data: { message: "updated" } }));
    const complete = vi.fn(async () => ({ data: { message: "completed" } }));
    await expect(
        runManualScrapeActions({
            selectFiles: async () => ({ error: { detail: "provider rejected selected files" } }),
            updateAttributes: update,
            complete
        })
    ).rejects.toThrow("provider rejected selected files");
    expect(update).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
});

test("an empty select_files result stops before subsequent actions", async () => {
    const update = vi.fn(async () => ({ data: { message: "updated" } }));
    const complete = vi.fn(async () => ({ data: { message: "completed" } }));
    await expect(
        runManualScrapeActions({
            selectFiles: async () => ({}),
            updateAttributes: update,
            complete
        })
    ).rejects.toThrow("Failed to select files");
    expect(update).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
});

test("an update_attributes error stops before complete", async () => {
    const complete = vi.fn(async () => ({ data: { message: "completed" } }));
    await expect(
        runManualScrapeActions({
            selectFiles: async () => ({ data: { message: "selected" } }),
            updateAttributes: async () => ({ error: { message: "media mapping failed" } }),
            complete
        })
    ).rejects.toThrow("media mapping failed");
    expect(complete).not.toHaveBeenCalled();
});

test("an uncached workflow can omit update_attributes and complete after selection", async () => {
    const calls: string[] = [];
    await runManualScrapeActions({
        selectFiles: async () => {
            calls.push("select");
            return { data: { message: "selected" } };
        },
        complete: async () => {
            calls.push("complete");
            return { data: { message: "completed" } };
        }
    });
    expect(calls).toEqual(["select", "complete"]);
});
