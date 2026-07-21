import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-profiles-page-server");
const PATHS = "filesystem";

async function fetchFilesystem(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to load filesystem settings");
    // Returns { filesystem: { mount_path, library_profiles, ... } }
    return (res.data as Record<string, unknown>)["filesystem"] as Record<string, unknown>;
}

async function saveFilesystem(
    baseUrl: string,
    apiKey: string,
    filesystemData: Record<string, unknown>,
    fetchFn: typeof globalThis.fetch
): Promise<void> {
    const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
        body: { filesystem: filesystemData },
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to save filesystem settings");
}

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user?.role !== "admin") error(403, "Forbidden");

    // The dedicated page is now embedded within Settings. Redirect any direct
    // visits to the new location.
    redirect(301, "/settings?tab=library-profiles");
};

export const actions = {
    save: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const profilesJson = formData.get("profiles");
        if (!profilesJson || typeof profilesJson !== "string") {
            return fail(400, { error: "Missing profiles data" });
        }

        let profiles: Record<string, unknown>;
        try {
            profiles = JSON.parse(profilesJson);
        } catch {
            return fail(400, { error: "Invalid profiles JSON" });
        }

        try {
            // Fetch current filesystem to preserve all other fields (mount_path, cache, templates, etc.)
            const filesystem = await fetchFilesystem(locals.backendUrl, locals.apiKey, fetch);
            const merged = { ...filesystem, library_profiles: profiles };
            await saveFilesystem(locals.backendUrl, locals.apiKey, merged, fetch);
            // Re-read so the client can baseline against the canonical stored payload.
            const refreshed = await fetchFilesystem(locals.backendUrl, locals.apiKey, fetch);
            const savedProfiles = (refreshed.library_profiles ?? profiles) as Record<
                string,
                unknown
            >;
            logger.info("Library profiles saved", { count: Object.keys(savedProfiles).length });
            return { success: true, profiles: savedProfiles };
        } catch (e) {
            logger.error("Library profiles save failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Failed to save library profiles" });
        }
    }
} satisfies Actions;
