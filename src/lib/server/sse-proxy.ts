import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { produce } from "sveltekit-sse";
import { createScopedLogger } from "$lib/logger";

/** Options for creating an SSE proxy to the backend. */
interface SseProxyOptions {
    /** SvelteKit request locals (must contain `user` and `session` for auth). */
    locals: App.Locals;
    /** Backend stream path, e.g. `"/api/v1/stream/logging"`. */
    path: string;
    /** SSE event name emitted to the client, e.g. `"log"` or `"notification"`. */
    eventName: string;
    /** Logger scope identifier, e.g. `"logs-api"`. */
    logScope: string;
}

/**
 * Creates an SSE proxy response that connects to a backend stream endpoint
 * and forwards events to the client.
 *
 * Handles authentication, backend connectivity, stream reading with buffered
 * line parsing, and clean abort/error handling.
 *
 * @example
 * ```ts
 * export const POST: RequestHandler = async ({ locals }) => {
 *     return createSseProxy({
 *         locals,
 *         path: "/api/v1/stream/logging",
 *         eventName: "log",
 *         logScope: "logs-api",
 *     });
 * };
 * ```
 */
export function createSseProxy({ locals, path, eventName, logScope }: SseProxyOptions) {
    if (!locals.user || !locals.session) {
        error(401, "Unauthorized");
    }

    const logger = createScopedLogger(logScope);

    const backendUrl = env.BACKEND_URL;
    if (!backendUrl) {
        logger.error(`${logScope} proxy: BACKEND_URL is not configured`);
        error(500, "Backend URL is not configured");
    }

    return produce(async function start({ emit, lock }) {
        const abortController = new AbortController();

        try {
            const response = await fetch(`${backendUrl}${path}`, {
                method: "GET",
                headers: {
                    "x-api-key": env.BACKEND_API_KEY || "",
                    Accept: "text/event-stream",
                    "Cache-Control": "no-cache"
                },
                signal: abortController.signal
            });

            if (!response.ok) {
                logger.error(`${logScope} proxy: Backend error ${response.status}`);
                lock.set(false);
                return function stop() {
                    abortController.abort();
                };
            }

            const reader = response.body?.getReader();
            if (!reader) {
                logger.error(`${logScope} proxy: No response body`);
                lock.set(false);
                return function stop() {
                    abortController.abort();
                };
            }

            const decoder = new TextDecoder();
            let buffer = "";
            // Accumulate `data:` lines for multi-line SSE messages.
            // Per the SSE spec, multiple `data:` lines are concatenated
            // with newlines until an empty line marks the message boundary.
            let dataLines: string[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Flush any remaining buffered data lines on stream end
                    if (dataLines.length > 0) {
                        const payload = dataLines.join("\n").trim();
                        dataLines = [];
                        if (payload) {
                            emit(eventName, payload);
                        }
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        dataLines.push(line.slice(6));
                    } else if (line.startsWith("data:")) {
                        // Handle `data:` with no space (also valid per SSE spec)
                        dataLines.push(line.slice(5));
                    } else if (line.trim() === "") {
                        // Empty line = message boundary → emit accumulated data
                        if (dataLines.length > 0) {
                            const payload = dataLines.join("\n").trim();
                            dataLines = [];
                            if (!payload) continue;
                            const { error: emitError } = emit(eventName, payload);
                            if (emitError) {
                                reader.cancel();
                                return function stop() {
                                    abortController.abort();
                                };
                            }
                        }
                    }
                    // Other SSE fields (event:, id:, retry:) are ignored
                }
            }
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = e as any;
            if (err?.name === "AbortError") {
                // Expected abort, ignore
            } else if (
                (err?.cause?.code && ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(err.cause.code)) ||
                err?.cause?.message === "other side closed" ||
                err?.message === "other side closed" ||
                err?.message === "terminated"
            ) {
                // Suppress stack trace spam for expected offline errors when backend restarts
            } else {
                logger.error(`${logScope} proxy: Connection error:`, e);
            }
        } finally {
            lock.set(false);
        }

        return function stop() {
            abortController.abort();
        };
    });
}
