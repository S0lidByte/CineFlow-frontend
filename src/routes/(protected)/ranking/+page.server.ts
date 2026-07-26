import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("ranking-page-server");
const SETTINGS_WRITE_HEADERS = {
    "x-actor-roles": "platform:admin,settings:write,playback:operator"
};

/** Settings keys for independent Ranking Studio packs. */
export type RankingPackKey = "ranking" | "ranking_anime";

function isRankingPackKey(value: unknown): value is RankingPackKey {
    return value === "ranking" || value === "ranking_anime";
}

function parsePack(formData: FormData): RankingPackKey {
    const raw = formData.get("pack");
    if (isRankingPackKey(raw)) return raw;
    return "ranking";
}

async function fetchRankingPack(
    baseUrl: string,
    apiKey: string,
    pack: RankingPackKey,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: pack } }
    });
    if (res.error) throw new Error(`Failed to load ${pack} settings`);
    const data = res.data as Record<string, unknown>;
    return (data[pack] as Record<string, unknown>) ?? {};
}

async function saveRankingPack(
    baseUrl: string,
    apiKey: string,
    pack: RankingPackKey,
    ranking: Record<string, unknown>,
    fetchFn: typeof globalThis.fetch
): Promise<void> {
    const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
        body: { [pack]: ranking } as never,
        baseUrl,
        headers: { "x-api-key": apiKey, ...SETTINGS_WRITE_HEADERS },
        fetch: fetchFn,
        params: { path: { paths: pack } }
    });
    if (res.error) throw new Error(`Failed to save ${pack} settings`);
}

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user?.role !== "admin") error(403, "Forbidden");
    redirect(301, "/settings?tab=ranking");
};

export const actions = {
    save: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const pack = parsePack(formData);
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
            const validateRes = await fetch(
                `${locals.backendUrl}/api/v1/ranking/validate-patterns`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "x-api-key": locals.apiKey,
                        ...SETTINGS_WRITE_HEADERS
                    },
                    body: JSON.stringify({
                        require: Array.isArray(ranking.require) ? ranking.require : [],
                        exclude: Array.isArray(ranking.exclude) ? ranking.exclude : [],
                        preferred: Array.isArray(ranking.preferred) ? ranking.preferred : []
                    })
                }
            );
            if (validateRes.ok) {
                const validated = (await validateRes.json()) as {
                    valid?: boolean;
                    errors?: { message?: string }[];
                };
                if (validated.valid === false) {
                    const msg = validated.errors?.[0]?.message ?? "Invalid ranking regex patterns";
                    return fail(400, { error: msg });
                }
            } else {
                const text = await validateRes.text();
                logger.error("Ranking pattern pre-validate returned non-OK status", {
                    status: validateRes.status,
                    text
                });
                return fail(502, {
                    error: "Could not validate ranking patterns before save. Try again."
                });
            }
        } catch (e) {
            logger.error("Ranking pattern pre-validate failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(502, {
                error: "Could not validate ranking patterns before save. Try again."
            });
        }

        try {
            await saveRankingPack(locals.backendUrl, locals.apiKey, pack, ranking, fetch);
            const saved = await fetchRankingPack(locals.backendUrl, locals.apiKey, pack, fetch);
            logger.info("Ranking settings saved", { pack });
            return { success: true, pack, ranking: saved };
        } catch (e) {
            logger.error("Ranking save failed", {
                pack,
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, {
                error:
                    pack === "ranking_anime"
                        ? "Failed to save anime ranking. Ensure the backend supports ranking_anime."
                        : "Failed to save ranking settings"
            });
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
                    scraping_hint: (data.scraping_hint as string | null) ?? null,
                    title_similarity_threshold:
                        data.title_similarity_threshold != null
                            ? Number(data.title_similarity_threshold)
                            : null,
                    message: (data.message as string) ?? ""
                }
            };
        } catch (e) {
            logger.error("Ranking test failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Ranking test failed" });
        }
    },

    validatePatterns: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();

        const parseList = (key: string): string[] => {
            const raw = formData.get(key);
            if (!raw || typeof raw !== "string") return [];
            try {
                const parsed = JSON.parse(raw) as unknown;
                return Array.isArray(parsed) ? parsed.map(String) : [];
            } catch {
                return [];
            }
        };

        const previewTitle = formData.get("preview_title");

        try {
            const res = await fetch(`${locals.backendUrl}/api/v1/ranking/validate-patterns`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": locals.apiKey,
                    ...SETTINGS_WRITE_HEADERS
                },
                body: JSON.stringify({
                    require: parseList("require"),
                    exclude: parseList("exclude"),
                    preferred: parseList("preferred"),
                    preview_title:
                        typeof previewTitle === "string" && previewTitle.trim()
                            ? previewTitle.trim()
                            : null
                })
            });

            if (!res.ok) {
                const text = await res.text();
                logger.error("Pattern validate HTTP error", { status: res.status, text });
                return fail(res.status, { error: `Pattern validation failed (${res.status})` });
            }

            const data = (await res.json()) as Record<string, unknown>;
            return {
                success: true,
                valid: Boolean(data.valid),
                errors: Array.isArray(data.errors) ? data.errors : [],
                preview: (data.preview as Record<string, unknown> | null) ?? null
            };
        } catch (e) {
            logger.error("Pattern validate failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Pattern validation failed" });
        }
    },

    funnel: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const itemIdRaw = formData.get("item_id");
        const itemId = typeof itemIdRaw === "string" ? Number(itemIdRaw.trim()) : NaN;
        if (!Number.isInteger(itemId) || itemId <= 0) {
            return fail(400, { error: "Valid media item id is required" });
        }

        try {
            const res = await fetch(`${locals.backendUrl}/api/v1/ranking/funnel/${itemId}`, {
                headers: {
                    "x-api-key": locals.apiKey,
                    ...SETTINGS_WRITE_HEADERS
                },
                signal: AbortSignal.timeout(20_000)
            });

            if (!res.ok) {
                const text = await res.text();
                logger.error("Funnel summary HTTP error", { status: res.status, text });
                return fail(res.status, { error: `Funnel lookup failed (${res.status})` });
            }

            const data = (await res.json()) as Record<string, unknown>;
            return {
                success: true,
                found: Boolean(data.found),
                item_id: data.item_id ?? itemId,
                item_log: (data.item_log as string | null) ?? null,
                found_count: Number(data.found_count ?? 0),
                ranked: Number(data.ranked ?? 0),
                new: Number(data.new ?? 0),
                already_known: Number(data.already_known ?? 0),
                blacklisted: Number(data.blacklisted ?? 0),
                rtn_rejected: Number(data.rtn_rejected ?? 0),
                content_filtered: Number(data.content_filtered ?? 0),
                rtn_top: Array.isArray(data.rtn_top) ? data.rtn_top : [],
                message: (data.message as string) ?? ""
            };
        } catch (e) {
            logger.error("Funnel lookup failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Funnel lookup failed" });
        }
    }
} satisfies Actions;
