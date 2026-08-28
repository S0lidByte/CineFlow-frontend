import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export type ConnectionService =
    | "real_debrid"
    | "all_debrid"
    | "debrid_link"
    | "plex"
    | "jackett"
    | "prowlarr"
    | "opensubtitles"
    | "subdl";

export type ConnectionTestResult = {
    ok: boolean;
    latency_ms: number;
    message: string;
};

const SUPPORTED = new Set<ConnectionService>([
    "real_debrid",
    "all_debrid",
    "debrid_link",
    "plex",
    "jackett",
    "prowlarr",
    "opensubtitles",
    "subdl"
]);

const SECRET_MARKERS = [
    "api_key",
    "apikey",
    "api-key",
    "token=",
    "password",
    "authorization",
    "bearer ",
    "x-api-key",
    "x-plex-token"
];

function safeMessage(raw: unknown, fallback: string): string {
    if (typeof raw !== "string") return fallback;
    const text = raw.trim();
    if (!text) return fallback;
    const lowered = text.toLowerCase();
    if (SECRET_MARKERS.some((m) => lowered.includes(m))) return fallback;
    if (text.includes("?") || text.includes("://") || text.length > 160) return fallback;
    return text;
}

/** POST: Probe a third-party integration via backend (BFF → never expose API key). */
export const POST: RequestHandler = async ({ locals, params }) => {
    if (locals.user?.role !== "admin") {
        throw error(403, "Forbidden");
    }
    if (!locals.backendUrl || !locals.apiKey) {
        throw error(500, "Backend not configured");
    }

    const service = params.service as ConnectionService;
    if (!SUPPORTED.has(service)) {
        throw error(404, "Unknown service");
    }

    let res: Response;
    try {
        res = await fetch(`${locals.backendUrl}/api/v1/settings/test-connection/${service}`, {
            method: "POST",
            headers: {
                "x-api-key": locals.apiKey,
                accept: "application/json"
            }
        });
    } catch {
        return json(
            {
                ok: false,
                latency_ms: 0,
                message: "Backend unreachable"
            } satisfies ConnectionTestResult,
            { status: 200 }
        );
    }

    if (!res.ok) {
        // Soft-fail shape for the Settings UI (same as dashboard /services).
        return json(
            {
                ok: false,
                latency_ms: 0,
                message: res.status === 401 || res.status === 403 ? "Unauthorized" : "Probe failed"
            } satisfies ConnectionTestResult,
            { status: 200 }
        );
    }

    const data = (await res.json().catch(() => null)) as ConnectionTestResult | null;
    return json({
        ok: Boolean(data?.ok),
        latency_ms: Math.max(0, Number(data?.latency_ms) || 0),
        message: safeMessage(data?.message, data?.ok ? "OK" : "Connection failed")
    } satisfies ConnectionTestResult);
};
