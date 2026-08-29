import { error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getActorHeadersForUser } from "$lib/server/permissions";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FORWARDED_REQUEST_HEADERS = [
    "accept",
    "range",
    "if-none-match",
    "if-modified-since"
] as const;
const FORWARDED_RESPONSE_HEADERS = [
    "accept-ranges",
    "cache-control",
    "content-disposition",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
    "location"
] as const;

const proxyRequest = async (method: string, locals: App.Locals, url: URL, request?: Request) => {
    // Tighten scope: only proxy to backend /api/v1/* paths.
    // Incoming protected route is /(protected)/api/[...backendProxy] -> /api/{...backendProxy}
    // so enforce the path starts with /api/v1/ before forwarding.
    const proxyPath = url.pathname;
    if (!proxyPath.startsWith("/api/v1/")) {
        throw error(400, "Invalid proxy path");
    }

    if (!locals.backendUrl || !locals.apiKey) {
        throw error(500, "Backend proxy is not configured");
    }

    const targetUrl = new URL(proxyPath, locals.backendUrl);
    targetUrl.search = url.search;

    try {
        const actorHeaders = getActorHeadersForUser(locals.user);
        const headers = new Headers({
            "x-api-key": locals.apiKey,
            ...actorHeaders
        });

        if (request) {
            for (const header of FORWARDED_REQUEST_HEADERS) {
                const value = request.headers.get(header);
                if (value) headers.set(header, value);
            }

            const contentType = request.headers.get("content-type");
            if (contentType && BODY_METHODS.has(method)) {
                headers.set("content-type", contentType);
            }
        }

        // Explicitly guarantee client cannot spoof or override backend security headers
        headers.set("x-api-key", locals.apiKey);
        for (const [k, v] of Object.entries(actorHeaders)) {
            headers.set(k, v);
        }

        const response = await fetch(targetUrl.toString(), {
            method,
            headers,
            body: request && BODY_METHODS.has(method) ? request.body : undefined,
            duplex: request && BODY_METHODS.has(method) ? "half" : undefined
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const responseHeaders = new Headers();
        for (const header of FORWARDED_RESPONSE_HEADERS) {
            const value = response.headers.get(header);
            if (value) responseHeaders.set(header, value);
        }

        if (!responseHeaders.has("content-type")) {
            responseHeaders.set("content-type", "application/octet-stream");
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.error(`[proxy] Error fetching ${targetUrl}:`, e);
        throw error(500, "Failed to fetch data from backend");
    }
};

export const GET: RequestHandler = ({ locals, url }) => proxyRequest("GET", locals, url);
export const POST: RequestHandler = ({ locals, url, request }) =>
    proxyRequest("POST", locals, url, request);
export const PUT: RequestHandler = ({ locals, url, request }) =>
    proxyRequest("PUT", locals, url, request);
export const PATCH: RequestHandler = ({ locals, url, request }) =>
    proxyRequest("PATCH", locals, url, request);
export const DELETE: RequestHandler = ({ locals, url, request }) =>
    proxyRequest("DELETE", locals, url, request);
