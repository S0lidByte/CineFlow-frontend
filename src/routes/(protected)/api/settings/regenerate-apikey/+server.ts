import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import providers from "$lib/providers";

/** POST: Regenerate root API key via backend; returns new key or error */
export const POST: RequestHandler = async ({ locals, fetch: fetchFn }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden" }, { status: 403 });
    }
    const res = await providers.riven.POST("/api/v1/generateapikey", {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        fetch: fetchFn
    });
    if (res.error) {
        return json({ error: "Failed to regenerate API key" }, { status: 500 });
    }
    const payload = res.data as { key?: string; warning?: string; message?: string };
    const newKey = payload.key ?? payload.message;
    if (!newKey) {
        return json({ error: "Invalid response" }, { status: 500 });
    }
    return json({ apiKey: newKey, warning: payload.warning });
};
