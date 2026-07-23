import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("ranking-page-server");
const PATHS = "ranking";
const SETTINGS_WRITE_HEADERS = {
    "x-actor-roles": "platform:admin,settings:write,playback:operator"
};

async function fetchRanking(
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
    if (res.error) throw new Error("Failed to load ranking settings");
    return (res.data as Record<string, unknown>)["ranking"] as Record<string, unknown>;
}

async function saveRanking(
    baseUrl: string,
    apiKey: string,
    ranking: Record<string, unknown>,
    fetchFn: typeof globalThis.fetch
): Promise<void> {
    const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
        body: { ranking },
        baseUrl,
        headers: { "x-api-key": apiKey, ...SETTINGS_WRITE_HEADERS },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to save ranking settings");
}

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user?.role !== "admin") error(403, "Forbidden");
    redirect(301, "/settings?tab=ranking");
};

export const actions = {
    save: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const rankingJson = formData.get("ranking");
        if (!rankingJson || typeof rankingJson !== "string") {
            return fail(400, { error: "Missing ranking data" });
        }

        let ranking: Record<string, unknown>;
        try {
            ranking = JSON.parse(rankingJson);
        } catch {
            return fail(400, { error: "Invalid ranking JSON" });
        }

        try {
            await saveRanking(locals.backendUrl, locals.apiKey, ranking, fetch);
            const saved = await fetchRanking(locals.backendUrl, locals.apiKey, fetch);
            logger.info("Ranking settings saved");
            return { success: true, ranking: saved };
        } catch (e) {
            logger.error("Ranking save failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Failed to save ranking settings" });
        }
    },

    test: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const rawTitle = formData.get("raw_title");
        const correctTitle = formData.get("correct_title");
        const rankingJson = formData.get("ranking");

        if (!rawTitle || typeof rawTitle !== "string" || !rawTitle.trim()) {
            return fail(400, { error: "Release title is required" });
        }

        let ranking: Record<string, unknown> | undefined;
        if (rankingJson && typeof rankingJson === "string") {
            try {
                ranking = JSON.parse(rankingJson);
            } catch {
                return fail(400, { error: "Invalid ranking JSON" });
            }
        }

        try {
            const res = await fetch(`${locals.backendUrl}/api/v1/ranking/test`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": locals.apiKey,
                    ...SETTINGS_WRITE_HEADERS
                },
                body: JSON.stringify({
                    raw_title: rawTitle.trim(),
                    correct_title:
                        typeof correctTitle === "string" && correctTitle.trim()
                            ? correctTitle.trim()
                            : null,
                    ranking: ranking ?? null,
                    remove_trash: true
                })
            });

            if (!res.ok) {
                const text = await res.text();
                logger.error("Ranking test HTTP error", { status: res.status, text });
                return fail(res.status, { error: `Ranking test failed (${res.status})` });
            }

            const data = (await res.json()) as Record<string, unknown>;
            return {
                success: true,
                result: {
                    accepted: Boolean(data.accepted),
                    rank: Number(data.rank ?? 0),
                    lev_ratio: Number(data.lev_ratio ?? 0),
                    fetch: Boolean(data.fetch),
                    deny_reason: (data.deny_reason as string | null) ?? null,
                    deny_help: (data.deny_help as string | null) ?? null,
                    message: (data.message as string) ?? ""
                }
            };
        } catch (e) {
            logger.error("Ranking test failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Ranking test failed" });
        }
    }
} satisfies Actions;
