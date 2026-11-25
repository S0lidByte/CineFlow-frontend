import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getActorHeadersForUser } from "$lib/server/permissions";

const ITEM_ID_PATTERN = /^\d+$/;

export const GET: RequestHandler = async ({ params, locals, request, fetch, url }) => {
    const itemId = params.itemId?.trim();

    if (!itemId || !ITEM_ID_PATTERN.test(itemId)) {
        error(400, "Invalid item ID");
    }

    const streamUrl = `${locals.backendUrl}/api/v1/stream/file/${itemId}${url.search}`;

    const actorHeaders = getActorHeadersForUser(locals.user);

    // Forward range header if present for seeking support
    const headers: Record<string, string> = {
        "x-api-key": locals.apiKey,
        "accept-encoding": "identity",
        ...actorHeaders
    };

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
        headers["Range"] = rangeHeader;
    }

    try {
        const response = await fetch(streamUrl, {
            headers
        });

        if (!response.ok) {
            error(response.status, `Failed to fetch stream: ${response.statusText}`);
        }

        // Forward relevant headers from backend
        const responseHeaders = new Headers();

        const headersToForward = [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "content-disposition"
        ];

        headersToForward.forEach((header) => {
            const value = response.headers.get(header);
            if (value) {
                responseHeaders.set(header, value);
            }
        });

        // Prevent reverse proxies (e.g. nginx) from buffering streamed chunks
        responseHeaders.set("x-accel-buffering", "no");
        responseHeaders.set("cache-control", "no-transform");

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders
        });
    } catch (e) {
        console.error("Stream proxy error:", e);
        error(502, "Failed to proxy stream");
    }
};
