import type { RequestHandler } from "./$types";
import { createSseProxy } from "$lib/server/sse-proxy";

/** Proxies the backend playback telemetry 1Hz live SSE stream to the client. */
export const POST: RequestHandler = async ({ locals }) => {
    return createSseProxy({
        locals,
        path: "/api/v1/telemetry/playback/live",
        eventName: "telemetry",
        logScope: "playback-telemetry-api"
    });
};
