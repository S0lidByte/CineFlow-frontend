import { createScopedLogger } from "$lib/logger";
import { getRateLimiterForUrl, withRateLimit } from "$lib/rate-limiter";

const logger = createScopedLogger("fetch");

type FetchFn = typeof fetch;

interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    retryOnStatus: number[];
}

interface DomainConfig extends Partial<RetryConfig> {
    pattern: string | RegExp;
}

interface CustomFetchOptions {
    defaultRetry?: Partial<RetryConfig>;
    domains?: DomainConfig[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    retryOnStatus: [408, 429, 500, 502, 503, 504]
};

const DEFAULT_DOMAIN_CONFIGS: DomainConfig[] = [
    {
        pattern: "api.themoviedb.org",
        maxAttempts: 3,
        baseDelay: 1000,
        retryOnStatus: [429, 500, 502, 503, 504]
    },
    {
        pattern: "api.trakt.tv",
        maxAttempts: 3,
        baseDelay: 1000,
        retryOnStatus: [429, 500, 502, 503, 504]
    },
    {
        pattern: "api4.thetvdb.com",
        maxAttempts: 3,
        baseDelay: 1000,
        retryOnStatus: [429, 500, 502, 503, 504]
    },
    {
        pattern: "graphql.anilist.co",
        maxAttempts: 3,
        baseDelay: 1000,
        retryOnStatus: [429, 500, 502, 503, 504]
    },
    {
        pattern: "api.ani.zip",
        maxAttempts: 3,
        baseDelay: 1000,
        retryOnStatus: [429, 500, 502, 503, 504]
    }
];

function matchesDomain(url: string, pattern: string | RegExp): boolean {
    try {
        const hostname = new URL(url).hostname;
        if (typeof pattern === "string") {
            return hostname === pattern || hostname.endsWith("." + pattern);
        }
        return pattern.test(hostname);
    } catch {
        return false;
    }
}

function getRetryConfigForUrl(url: string, options: CustomFetchOptions): RetryConfig | null {
    const domains = options.domains ?? DEFAULT_DOMAIN_CONFIGS;

    for (const domain of domains) {
        if (matchesDomain(url, domain.pattern)) {
            return {
                maxAttempts:
                    domain.maxAttempts ??
                    options.defaultRetry?.maxAttempts ??
                    DEFAULT_RETRY_CONFIG.maxAttempts,
                baseDelay:
                    domain.baseDelay ??
                    options.defaultRetry?.baseDelay ??
                    DEFAULT_RETRY_CONFIG.baseDelay,
                retryOnStatus:
                    domain.retryOnStatus ??
                    options.defaultRetry?.retryOnStatus ??
                    DEFAULT_RETRY_CONFIG.retryOnStatus
            };
        }
    }

    if (options.defaultRetry) {
        return {
            ...DEFAULT_RETRY_CONFIG,
            ...options.defaultRetry
        };
    }

    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Jitter prevents thundering herd when multiple clients retry simultaneously
function calculateDelayWithJitter(baseDelay: number, attempt: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    return exponentialDelay * (0.5 + Math.random() * 0.5);
}

export function createCustomFetch(
    fetchFn: FetchFn = fetch,
    options: CustomFetchOptions = {}
): FetchFn {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url =
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const retryConfig = getRetryConfigForUrl(url, options);

        // Wrap the actual fetch execution with rate limiting.
        // FIX-15: timeoutSignal is created INSIDE the withRateLimit callback so the 30-second
        // countdown only starts when the request is actually dispatched (not while waiting in the
        // rate limiter queue — a backed-up queue could abort requests before they even start).
        const executeWithRateLimit = async (): Promise<Response> => {
            if (!retryConfig) {
                // No retry config: single attempt inside rate limiter
                return withRateLimit(url, async () => {
                    const timeoutSignal = AbortSignal.timeout(30000);
                    const combinedSignal = init?.signal
                        ? AbortSignal.any([init.signal, timeoutSignal])
                        : timeoutSignal;
                    return fetchFn(input, { ...init, signal: combinedSignal });
                });
            }

            // FIX-14: Retry loop is OUTSIDE withRateLimit so sleep() does not hold the
            // concurrency slot during the delay period. A slot is re-acquired for each attempt.
            // Previously, sleeping inside withRateLimit caused all slots to deadlock when multiple
            // requests hit 429 simultaneously.
            let lastError: Error | null = null;
            let lastResponse: Response | null = null;

            for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
                let slotDelay: number | null = null;

                try {
                    const response = await withRateLimit(url, async () => {
                        const timeoutSignal = AbortSignal.timeout(30000); // FIX-15
                        const combinedSignal = init?.signal
                            ? AbortSignal.any([init.signal, timeoutSignal])
                            : timeoutSignal;
                        return fetchFn(input, { ...init, signal: combinedSignal });
                    });

                    if (response.ok || !retryConfig.retryOnStatus.includes(response.status)) {
                        return response;
                    }

                    lastResponse = response;

                    const retryAfter = response.headers.get("Retry-After");
                    let delay = calculateDelayWithJitter(retryConfig.baseDelay, attempt - 1);

                    if (retryAfter) {
                        // Retry-After can be seconds or HTTP date per RFC 7231
                        const retryAfterSeconds = parseInt(retryAfter, 10);
                        if (!isNaN(retryAfterSeconds)) {
                            delay = retryAfterSeconds * 1000 * (0.9 + Math.random() * 0.2);
                        } else {
                            const retryDate = new Date(retryAfter);
                            if (!isNaN(retryDate.getTime())) {
                                const rawDelay = Math.max(0, retryDate.getTime() - Date.now());
                                delay = rawDelay * (0.9 + Math.random() * 0.2);
                            }
                        }
                    }

                    if (attempt < retryConfig.maxAttempts) {
                        logger.warn(
                            `Request to ${url} failed with status ${response.status}. ` +
                                `Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retryConfig.maxAttempts})`
                        );
                        if (response.status === 429) {
                            const limiter = getRateLimiterForUrl(url);
                            if (limiter) {
                                // Pause GLOBAL execution for this domain
                                limiter.pauseUntil(Date.now() + delay);
                            }
                        }
                        slotDelay = delay;
                    }
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));

                    // AbortError signals remain aborted — retrying is pointless and causes
                    // a tight failure loop. Rethrow immediately to break the retry cycle.
                    if (lastError.name === "AbortError") {
                        throw lastError;
                    }

                    if (attempt < retryConfig.maxAttempts) {
                        const delay = calculateDelayWithJitter(retryConfig.baseDelay, attempt - 1);
                        logger.warn(
                            `Request to ${url} failed with error: ${lastError.message}. ` +
                                `Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retryConfig.maxAttempts})`
                        );
                        slotDelay = delay;
                    }
                }

                // FIX-14: Sleep OUTSIDE the rate-limit slot so we don't block other requests
                // for the entire retry delay duration.
                if (slotDelay !== null) {
                    await sleep(slotDelay);
                }
            }

            if (lastResponse) {
                logger.error(
                    `Request to ${url} failed after ${retryConfig.maxAttempts} attempts ` +
                        `with status ${lastResponse.status}`
                );
                return lastResponse;
            }

            if (lastError) {
                logger.error(
                    `Request to ${url} failed after ${retryConfig.maxAttempts} attempts ` +
                        `with error: ${lastError.message}`
                );
                throw lastError;
            }

            // TypeScript requires this unreachable throw
            throw new Error(
                `[custom-fetch] Request to ${url} failed after ${retryConfig.maxAttempts} attempts for unknown reasons`
            );
        };

        return executeWithRateLimit();
    };
}

export const customFetch = createCustomFetch();

export type CustomFetch = ReturnType<typeof createCustomFetch>;
