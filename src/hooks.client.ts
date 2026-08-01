import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("hooks-client");

/**
 * Global client-side error handler.
 *
 * Prevents unhandled errors (e.g. from SSE streams, JSON parsing, or
 * third-party libraries) from crashing the SvelteKit client-side router.
 * Without this, a single uncaught exception during a navigation transition
 * can permanently freeze the app (URL updates but the DOM never swaps).
 */
if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
        logger.error("[client] Unhandled promise rejection:", event.reason);
    });

    window.addEventListener("error", (event) => {
        logger.error("[client] Uncaught window error:", event.error || event.message);
    });
}

export function handleError({
    error,
    status,
    message
}: {
    error: unknown;
    status: number;
    message: string;
}) {
    logger.error(`[client] Unhandled router error (${status}):`, message, error);

    return {
        message: "An unexpected error occurred",
        status
    };
}

