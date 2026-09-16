import type { RequestHandler } from "./$types";
import { createSseProxy } from "$lib/server/sse-proxy";

/** Proxies the backend operations timeline SSE stream to the client. */
export const POST: RequestHandler = async ({ locals }) => {
    return createSseProxy({
        locals,
        path: "/api/v1/operations/timeline/stream",
        eventName: "operation",
        logScope: "operations-timeline-api"
    });
};
