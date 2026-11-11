import { json, type RequestHandler } from "@sveltejs/kit";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("client-diag");

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const body = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }
        const { tag, message, data, userAgent } = body as {
            tag?: unknown;
            message?: unknown;
            data?: unknown;
            userAgent?: unknown;
        };
        const safeTag = typeof tag === "string" && tag.trim() ? tag.trim().slice(0, 64) : "CLIENT";
        const safeMessage = typeof message === "string" ? message.slice(0, 2000) : "";
        const safeData =
            data && typeof data === "object" && !Array.isArray(data)
                ? (data as Record<string, unknown>)
                : {};

        logger.info(`[${safeTag}] ${safeMessage}`, {
            ...safeData,
            userId: locals.user?.id,
            userName: locals.user?.name,
            userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : undefined
        });

        return json({ ok: true });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        return json({ ok: false, error: "Failed to log" }, { status: 400 });
    }
};
