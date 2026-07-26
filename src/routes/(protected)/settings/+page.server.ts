import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler, type FormHandlerOptions } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";
import type { UiSchemaRoot } from "@sjsf/form";
import {
    DEFAULT_TAB_ID,
    getPathsForTab,
    getTabById,
    LIBRARY_PROFILES_TAB_ID,
    RANKING_TAB_ID,
    SETTINGS_TABS
} from "$lib/components/settings/sections";
import {
    buildFieldIndexFromSchema,
    buildLibraryProfilesShortcutEntries,
    buildRankingShortcutEntries,
    buildSectionSearchEntries,
    mergeSearchEntries,
    type SettingsSearchEntry
} from "$lib/components/settings/settings-field-index";
import { perfCount, startPerfMark, endPerfMark } from "$lib/perf";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("settings-page-server");
const SETTINGS_WRITE_HEADERS = {
    "x-actor-roles": "platform:admin,settings:write,playback:operator"
} as const;

const FULL_SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;
let fullSchemaCache: {
    schema: Record<string, unknown>;
    expiresAt: number;
    backendUrl: string;
} | null = null;

async function getFullSettingsSchema(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown> | null> {
    if (
        fullSchemaCache &&
        fullSchemaCache.backendUrl === baseUrl &&
        fullSchemaCache.expiresAt > Date.now()
    ) {
        return fullSchemaCache.schema;
    }

    const res = await providers.riven.GET("/api/v1/settings/schema", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn
    });
    if (res.error || !res.data) {
        logger.warn("Failed to load full settings schema for search index", {
            error: res.error
        });
        return null;
    }

    const schema = res.data as Record<string, unknown>;
    fullSchemaCache = {
        schema,
        backendUrl: baseUrl,
        expiresAt: Date.now() + FULL_SCHEMA_CACHE_TTL_MS
    };
    return schema;
}

function buildSearchIndex(fullSchema: Record<string, unknown> | null): SettingsSearchEntry[] {
    return mergeSearchEntries(
        buildSectionSearchEntries(),
        buildRankingShortcutEntries(),
        buildLibraryProfilesShortcutEntries(),
        buildFieldIndexFromSchema(fullSchema)
    );
}

const PATHS = "filesystem";
async function fetchFilesystem(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey, ...SETTINGS_WRITE_HEADERS },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to load filesystem settings");
    const data = (res.data ?? {}) as Record<string, unknown>;
    return ((data["filesystem"] as Record<string, unknown> | undefined) ?? data) as Record<
        string,
        unknown
    >;
}

const SETTINGS_SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;

interface SettingsSchemaCacheEntry {
    schema: Record<string, unknown>;
    expiresAt: number;
}

const settingsSchemaCache = new Map<string, SettingsSchemaCacheEntry>();

function getSettingsSchemaCacheKey(backendUrl: string, tabId: string, paths: string): string {
    return `${backendUrl}::${tabId}::${paths}`;
}

function getCachedSettingsSchema(cacheKey: string): Record<string, unknown> | null {
    const cached = settingsSchemaCache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        settingsSchemaCache.delete(cacheKey);
        return null;
    }

    return cached.schema;
}

function setCachedSettingsSchema(cacheKey: string, schema: Record<string, unknown>): void {
    settingsSchemaCache.set(cacheKey, {
        schema,
        expiresAt: Date.now() + SETTINGS_SCHEMA_CACHE_TTL_MS
    });
}

/** Remove library_profiles from filesystem schema defs so the dedicated tab owns that field. */
function pruneLibraryProfilesFromSchema(schema: Record<string, unknown>): void {
    if (!schema.$defs) return;
    const defs = schema.$defs as Record<string, unknown>;
    const fsModel = defs.FilesystemModel as Record<string, unknown> | undefined;
    const fsProps = fsModel?.properties as Record<string, unknown> | undefined;
    if (fsProps && fsProps.library_profiles !== undefined) {
        delete fsProps.library_profiles;
    }
}

function pruneLibraryProfilesFromValue(initialValue: Record<string, unknown>): void {
    const fsVal = initialValue.filesystem as Record<string, unknown> | undefined;
    if (fsVal && fsVal.library_profiles !== undefined) {
        delete fsVal.library_profiles;
    }
}

/** Pydantic/OpenAPI model class names that should not appear as UI headings. */
function isNoiseSchemaTitle(title: string): boolean {
    return (
        title === "Settings" ||
        /Model$/i.test(title) ||
        /Config$/i.test(title) ||
        /Dict$/i.test(title) ||
        /Parameters$/i.test(title) ||
        /ParametersDict$/i.test(title)
    );
}

function humanizeSchemaKey(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bConfig\b/gi, "")
        .replace(/\bModel\b/gi, "")
        .replace(/\bDict\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Strip noisy schema titles (ScraperModel, TorrentioConfig, …) and replace
 * with humanized key labels. Mutates in place.
 */
function sanitizeSettingsSchemaTitles(schema: Record<string, unknown>): void {
    const visit = (node: unknown, propertyKey?: string): void => {
        if (!node || typeof node !== "object" || Array.isArray(node)) return;
        const obj = node as Record<string, unknown>;

        if (typeof obj.title === "string" && isNoiseSchemaTitle(obj.title)) {
            if (propertyKey) {
                obj.title = humanizeSchemaKey(propertyKey);
            } else {
                // Def title without a property key — strip suffix to readable form
                obj.title = humanizeSchemaKey(
                    obj.title.replace(/(Config|Model|Dict|ParametersDict|Parameters)$/i, "")
                );
            }
        } else if (typeof obj.title === "string" && /(Config|Model|Dict)$/i.test(obj.title)) {
            // Soft-clean titles that embed Config/Model even when not fully matched above
            obj.title = humanizeSchemaKey(
                obj.title.replace(/(Config|Model|Dict|ParametersDict)$/i, "")
            );
        }

        if (obj.properties && typeof obj.properties === "object") {
            for (const [key, value] of Object.entries(obj.properties as Record<string, unknown>)) {
                visit(value, key);
            }
        }

        if (obj.$defs && typeof obj.$defs === "object") {
            for (const value of Object.values(obj.$defs as Record<string, unknown>)) {
                visit(value);
            }
        }

        if (obj.definitions && typeof obj.definitions === "object") {
            for (const value of Object.values(obj.definitions as Record<string, unknown>)) {
                visit(value);
            }
        }

        if (obj.items) visit(obj.items);
        if (Array.isArray(obj.anyOf)) obj.anyOf.forEach((v) => visit(v));
        if (Array.isArray(obj.oneOf)) obj.oneOf.forEach((v) => visit(v));
        if (Array.isArray(obj.allOf)) obj.allOf.forEach((v) => visit(v));
    };

    visit(schema);
    if (typeof schema.title === "string" && isNoiseSchemaTitle(schema.title)) {
        delete schema.title;
    }
}

/**
 * Declarative map of schema key → SJSF UI component override.
 * Adding a new custom widget only requires a new entry here — no changes
 * to buildSettingsUiSchema itself.
 */
const WIDGET_OVERRIDES: Record<string, Record<string, unknown>> = {
    api_key: { "ui:components": { textWidget: "apiKeyWidget" } }
};

function buildSettingsUiSchema(properties: Record<string, unknown>, keys: string[]): UiSchemaRoot {
    const order = keys.filter((k) => properties[k] !== undefined);
    const ui: Record<string, unknown> = {
        "ui:order": order.length > 0 ? order : undefined,
        // Page shell already shows the section title — hide root schema model name.
        "ui:options": { title: false, description: false }
    };

    // Merge any widget overrides whose key is present in the current tab's schema.
    for (const [key, override] of Object.entries(WIDGET_OVERRIDES)) {
        if (properties[key] !== undefined) {
            ui[key] = override;
        }
    }

    // Removed `ui:widget: "hidden"` for `library_profiles` because the property is now fully
    // pruned from the schema payload itself inside the `load` and `actions` functions.
    return ui as UiSchemaRoot;
}

async function getSchemaForKeys(
    baseUrl: string,
    apiKey: string,
    keys: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/schema/keys", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { query: { keys, title: "Settings" } }
    });
    if (res.error) {
        throw new Error("Failed to load settings schema");
    }
    return res.data as Record<string, unknown>;
}

async function getSettingsForPaths(
    baseUrl: string,
    apiKey: string,
    paths: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths } }
    });
    if (res.error) {
        throw new Error("Failed to load settings");
    }
    return res.data as Record<string, unknown>;
}

const SETTINGS_FETCH_TIMEOUT_MS = 20_000;
const SETTINGS_FETCH_RETRY_TIMEOUT_MS = 60_000;
const SETTINGS_FETCH_MAX_ATTEMPTS = 2;

class SettingsFetchTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Settings fetch timed out after ${timeoutMs}ms`);
        this.name = "SettingsFetchTimeoutError";
    }
}

function mergeAbortSignals(
    primary: AbortSignal,
    secondary: AbortSignal | null | undefined
): AbortSignal {
    if (!secondary) return primary;

    const controller = new AbortController();
    const abortFrom = (signal: AbortSignal) => {
        try {
            const signalWithReason = signal as AbortSignal & { reason?: unknown };
            controller.abort(signalWithReason.reason);
        } catch {
            controller.abort();
        }
    };

    if (primary.aborted) {
        abortFrom(primary);
        return controller.signal;
    }

    if (secondary.aborted) {
        abortFrom(secondary);
        return controller.signal;
    }

    primary.addEventListener("abort", () => abortFrom(primary), { once: true });
    secondary.addEventListener("abort", () => abortFrom(secondary), { once: true });
    return controller.signal;
}

function createFetchWithTimeout(
    fetchFn: typeof fetch,
    timeoutMs: number = SETTINGS_FETCH_TIMEOUT_MS
): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        const timeoutController = new AbortController();
        let didTimeout = false;
        const id = setTimeout(() => {
            didTimeout = true;
            timeoutController.abort();
        }, timeoutMs);

        try {
            const signal = mergeAbortSignals(timeoutController.signal, init?.signal);
            return await fetchFn(input, { ...init, signal });
        } catch (e) {
            if (didTimeout) {
                throw new SettingsFetchTimeoutError(timeoutMs);
            }
            throw e;
        } finally {
            clearTimeout(id);
        }
    };
}

function isTimeoutError(e: unknown): boolean {
    if (e instanceof SettingsFetchTimeoutError) return true;
    const message = e instanceof Error ? e.message : String(e);
    const normalized = message.toLowerCase();
    return normalized.includes("timeout") || normalized.includes("timed out");
}

async function loadSettingsDataWithRetry(
    fetchFn: typeof fetch,
    backendUrl: string,
    apiKey: string,
    keys: string,
    paths: string
): Promise<[Record<string, unknown>, Record<string, unknown>]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= SETTINGS_FETCH_MAX_ATTEMPTS; attempt++) {
        const timeoutMs =
            attempt === 1 ? SETTINGS_FETCH_TIMEOUT_MS : SETTINGS_FETCH_RETRY_TIMEOUT_MS;
        const fetchWithTimeout = createFetchWithTimeout(fetchFn, timeoutMs);
        const attemptStartedAt = Date.now();

        logger.info("Loading settings data attempt started", {
            attempt,
            maxAttempts: SETTINGS_FETCH_MAX_ATTEMPTS,
            timeoutMs,
            keyCount: keys.split(",").filter(Boolean).length,
            pathCount: paths.split(",").filter(Boolean).length
        });

        try {
            const result = (await Promise.all([
                getSchemaForKeys(backendUrl, apiKey, keys, fetchWithTimeout),
                getSettingsForPaths(backendUrl, apiKey, paths, fetchWithTimeout)
            ])) as [Record<string, unknown>, Record<string, unknown>];

            logger.info("Loading settings data attempt succeeded", {
                attempt,
                durationMs: Date.now() - attemptStartedAt,
                timeoutMs
            });

            return result;
        } catch (e) {
            lastError = e;

            logger.warn("Loading settings data attempt failed", {
                attempt,
                timeoutMs,
                durationMs: Date.now() - attemptStartedAt,
                timeoutError: isTimeoutError(e),
                error: e instanceof Error ? e.message : String(e)
            });

            if (!isTimeoutError(e) || attempt === SETTINGS_FETCH_MAX_ATTEMPTS) {
                break;
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const load: PageServerLoad = async ({
    fetch,
    locals,
    url,
    request
}: {
    fetch: typeof globalThis.fetch;
    locals: App.Locals;
    url: URL;
    request: Request;
}) => {
    const mark = startPerfMark("settings.load", {
        tab: url.searchParams.get("tab") ?? DEFAULT_TAB_ID
    });

    if (locals.user?.role !== "admin") {
        error(403, "Forbidden");
    }

    const tabId = url.searchParams.get("tab") ?? DEFAULT_TAB_ID;
    const tab = getTabById(tabId) ?? getTabById(DEFAULT_TAB_ID)!;
    const paths = getPathsForTab(tab);
    const keys = paths;
    const schemaCacheKey = getSettingsSchemaCacheKey(locals.backendUrl, tab.id, paths);

    // Custom tabs rely on external/custom layout components, skip the SJSF loader
    if (tab.custom) {
        if (tab.id === LIBRARY_PROFILES_TAB_ID) {
            try {
                const [filesystem, fullSchema] = await Promise.all([
                    fetchFilesystem(locals.backendUrl, locals.apiKey, fetch),
                    getFullSettingsSchema(locals.backendUrl, locals.apiKey, fetch)
                ]);
                const profiles = (filesystem["library_profiles"] ?? {}) as Record<string, unknown>;
                return {
                    tabs: SETTINGS_TABS,
                    activeTabId: tab.id,
                    paths,
                    searchIndex: buildSearchIndex(fullSchema),
                    focusPath: url.searchParams.get("focus") ?? null,
                    customData: {
                        profiles
                    }
                };
            } catch (e) {
                logger.error("Failed to load library profiles for settings tab", { error: e });
                error(503, "Failed to load library profiles.");
            }
        }

        if (tab.id === RANKING_TAB_ID) {
            try {
                const [rankingRes, metaRes, fullSchema] = await Promise.all([
                    providers.riven.GET("/api/v1/settings/get/{paths}", {
                        baseUrl: locals.backendUrl,
                        headers: { "x-api-key": locals.apiKey },
                        fetch,
                        params: { path: { paths: "ranking,ranking_anime" } }
                    }),
                    fetch(`${locals.backendUrl}/api/v1/ranking/meta`, {
                        headers: { "x-api-key": locals.apiKey }
                    }),
                    getFullSettingsSchema(locals.backendUrl, locals.apiKey, fetch)
                ]);

                let rankingPayload = rankingRes.data as Record<string, unknown> | undefined;
                if (rankingRes.error || !rankingPayload) {
                    // Older backends without ranking_anime: fall back to movies pack only.
                    const fallback = await providers.riven.GET("/api/v1/settings/get/{paths}", {
                        baseUrl: locals.backendUrl,
                        headers: { "x-api-key": locals.apiKey },
                        fetch,
                        params: { path: { paths: "ranking" } }
                    });
                    if (fallback.error || !fallback.data) {
                        throw new Error("Failed to load ranking settings");
                    }
                    rankingPayload = fallback.data as Record<string, unknown>;
                }

                let meta: {
                    deny_keys: Record<string, string>;
                    attribute_titles: Record<string, string>;
                    categories: Record<string, string>;
                    soft_opt_in_links?: Record<string, { scraping_path: string; label: string }>;
                    pattern_limits?: {
                        max_patterns_per_list?: number;
                        max_pattern_length?: number;
                    };
                    title_matching_modes?: Array<{
                        id: string;
                        label: string;
                        title_similarity: number;
                        enable_aliases: boolean;
                        description: string;
                        diagnose_only: boolean;
                        scrape_applied?: boolean;
                    }>;
                } = {
                    deny_keys: {},
                    attribute_titles: {},
                    categories: {}
                };
                if (metaRes.ok) {
                    const body = (await metaRes.json()) as {
                        deny_keys?: Record<string, string>;
                        attribute_titles?: Record<string, string>;
                        categories?: Record<string, string>;
                        soft_opt_in_links?: Record<
                            string,
                            { scraping_path: string; label: string }
                        >;
                        pattern_limits?: {
                            max_patterns_per_list?: number;
                            max_pattern_length?: number;
                        };
                        title_matching_modes?: Array<{
                            id: string;
                            label: string;
                            title_similarity: number;
                            enable_aliases: boolean;
                            description: string;
                            diagnose_only: boolean;
                            scrape_applied?: boolean;
                        }>;
                    };
                    meta = {
                        deny_keys: body.deny_keys ?? {},
                        attribute_titles: body.attribute_titles ?? {},
                        categories: body.categories ?? {},
                        soft_opt_in_links: body.soft_opt_in_links,
                        pattern_limits: body.pattern_limits,
                        title_matching_modes: body.title_matching_modes
                    };
                }

                const ranking = (rankingPayload["ranking"] as Record<string, unknown>) ?? {};
                const rankingAnime =
                    (rankingPayload["ranking_anime"] as Record<string, unknown>) ?? {};

                return {
                    tabs: SETTINGS_TABS,
                    activeTabId: tab.id,
                    paths: "ranking,ranking_anime",
                    searchIndex: buildSearchIndex(fullSchema),
                    focusPath: url.searchParams.get("focus") ?? null,
                    customData: {
                        ranking,
                        rankingAnime,
                        rankingMeta: meta
                    }
                };
            } catch (e) {
                logger.error("Failed to load ranking settings tab", { error: e });
                error(503, "Failed to load ranking settings.");
            }
        }

        error(404, "Custom tab not found");
    }

    logger.info("Settings page load started", {
        tab: tab.id,
        keyCount: keys.split(",").filter(Boolean).length,
        pathCount: paths.split(",").filter(Boolean).length,
        referer: request.headers.get("referer"),
        // Note: 'purpose' or 'sec-purpose' is used for preloads/prefetches
        // but is not 100% consistent across all browsers/SvelteKit versions.
        purpose: request.headers.get("purpose") ?? request.headers.get("sec-purpose"),
        secFetchMode: request.headers.get("sec-fetch-mode"),
        secFetchDest: request.headers.get("sec-fetch-dest")
    });

    let schema: Record<string, unknown>;
    let initialValue: Record<string, unknown>;
    let fullSchema: Record<string, unknown> | null = null;

    try {
        [[schema, initialValue], fullSchema] = await Promise.all([
            loadSettingsDataWithRetry(fetch, locals.backendUrl, locals.apiKey, keys, paths),
            getFullSettingsSchema(locals.backendUrl, locals.apiKey, fetch)
        ]);
    } catch (e) {
        logger.error("Settings page load failed", {
            tab: tab.id,
            timeoutError: isTimeoutError(e),
            error: e instanceof Error ? e.message : String(e)
        });

        if (isTimeoutError(e)) {
            error(
                504,
                "Settings request timed out after retry. Backend may be slow or temporarily unreachable."
            );
        }

        // Fail visibly on all backend-related load failures to prevent
        // accidental saves of empty/default state.
        error(503, {
            message: "Failed to load settings from backend. Please check connectivity."
        });
    }

    // Deep-clone schema before mutation so the cached reference is never altered.
    // pruneLibraryProfilesFromSchema mutates its argument in-place; without cloning,
    // a cache hit would return an already-pruned object and prune again (idempotent
    // now, but fragile as logic evolves).
    const workingSchema = structuredClone(schema);
    pruneLibraryProfilesFromSchema(workingSchema);
    pruneLibraryProfilesFromValue(initialValue);
    sanitizeSettingsSchemaTitles(workingSchema);

    const props = (workingSchema.properties ?? {}) as Record<string, unknown>;
    const uiSchema = buildSettingsUiSchema(props, tab.keys) as unknown as UiSchemaRoot;
    setCachedSettingsSchema(schemaCacheKey, workingSchema);
    perfCount("settings.schema.cache.set", 1, {
        tab: tab.id,
        pathCount: paths.split(",").filter(Boolean).length
    });

    endPerfMark(mark, {
        tab: tab.id,
        propertyCount: Object.keys(props).length
    });

    logger.info("Settings page load completed", {
        tab: tab.id,
        propertyCount: Object.keys(props).length
    });

    return {
        tabs: SETTINGS_TABS,
        activeTabId: tab.id,
        paths,
        searchIndex: buildSearchIndex(fullSchema),
        focusPath: url.searchParams.get("focus") ?? null,
        form: {
            schema: workingSchema,
            initialValue,
            uiSchema
        } satisfies InitialFormData
    };
};

export const actions = {
    default: async ({
        request,
        fetch,
        locals,
        url
    }: {
        request: Request;
        fetch: typeof globalThis.fetch;
        locals: App.Locals;
        url: URL;
    }) => {
        const mark = startPerfMark("settings.submit", {
            tab: url.searchParams.get("tab") ?? DEFAULT_TAB_ID
        });

        if (locals.user?.role !== "admin") {
            error(403, "Forbidden");
        }

        const tabId = url.searchParams.get("tab") ?? DEFAULT_TAB_ID;
        const tab = getTabById(tabId) ?? getTabById(DEFAULT_TAB_ID)!;
        const paths = getPathsForTab(tab);
        const schemaCacheKey = getSettingsSchemaCacheKey(locals.backendUrl, tab.id, paths);

        const requestFormData = await request.formData();
        const schemaFromCache = getCachedSettingsSchema(schemaCacheKey);

        let schema: Record<string, unknown>;

        if (schemaFromCache) {
            schema = schemaFromCache;
            perfCount("settings.schema.cache.hit", 1, { tab: tab.id });
        } else {
            perfCount("settings.schema.cache.miss", 1, { tab: tab.id });
            const rawSchema = await getSchemaForKeys(
                locals.backendUrl,
                locals.apiKey,
                paths,
                fetch
            );
            // Clone before mutation so the cached object stays pristine.
            schema = structuredClone(rawSchema);
            pruneLibraryProfilesFromSchema(schema);
            sanitizeSettingsSchemaTitles(schema);
            setCachedSettingsSchema(schemaCacheKey, schema);
            perfCount("settings.schema.cache.set", 1, { tab: tab.id });
        }

        const uiSchema = buildSettingsUiSchema(
            (schema.properties ?? {}) as Record<string, unknown>,
            tab.keys
        );

        // The @sjsf form handler requires `any` because JSON schema types are inherently dynamic
        // and cannot be typed more narrowly without re-implementing the entire package's generics.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleForm = createFormHandler<any, true>({
            ...defaults,
            schema,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            uiSchema: uiSchema as any,
            sendData: true
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as FormHandlerOptions<any, true>);

        const [form] = await handleForm(request.signal, requestFormData);
        if (!form.isValid) {
            console.error(
                "[SETTINGS_SUBMIT_FAIL] Form invalid for tab:",
                tab.id,
                "errors:",
                JSON.stringify(form.errors)
            );
            logger.warn("Form validation failed during settings submit", {
                tab: tab.id,
                errors: form.errors
            });
            endPerfMark(mark, {
                tab: tab.id,
                valid: false
            });
            return fail(400, { form });
        }

        const payload = form.data as Record<string, unknown>;

        // Ensure all requested keys in `paths` exist in `payload` by populating missing keys
        // from backend current settings (e.g. read-only fields like `version` or un-edited fields).
        try {
            const currentSettings = await getSettingsForPaths(
                locals.backendUrl,
                locals.apiKey,
                paths,
                fetch
            );
            for (const key of paths.split(",")) {
                const k = key.trim();
                if (k && payload[k] === undefined && currentSettings[k] !== undefined) {
                    payload[k] = currentSettings[k];
                }
            }
        } catch (e) {
            logger.warn("Failed to fetch current settings fallback during payload completion", {
                error: e
            });
        }

        // If saving the filesystem tab, we must salvage the existing library_profiles
        // from the backend so the POST payload doesn't accidentally wipe them out.
        if (paths.includes("filesystem") && payload.filesystem) {
            try {
                const currentRes = await providers.riven.GET("/api/v1/settings/get/{paths}", {
                    baseUrl: locals.backendUrl,
                    headers: { "x-api-key": locals.apiKey, ...SETTINGS_WRITE_HEADERS },
                    fetch,
                    params: { path: { paths: "filesystem" } }
                });

                const isRecord = (value: unknown): value is Record<string, unknown> =>
                    typeof value === "object" && value !== null && !Array.isArray(value);

                if (
                    currentRes.error ||
                    !isRecord(currentRes.data) ||
                    !isRecord(currentRes.data.filesystem)
                ) {
                    console.error(
                        "[SETTINGS_SUBMIT_FAIL] Salvage library_profiles error:",
                        currentRes.error
                    );
                    logger.error("Failed to salvage library_profiles during filesystem save", {
                        error: currentRes.error ?? "missing filesystem payload"
                    });
                    endPerfMark(mark, {
                        tab: tab.id,
                        valid: true,
                        success: false
                    });
                    return fail(500, { form });
                }

                const currentFs = currentRes.data.filesystem;
                if (currentFs.library_profiles !== undefined) {
                    (payload.filesystem as Record<string, unknown>).library_profiles =
                        currentFs.library_profiles;
                }
            } catch (e) {
                console.error("[SETTINGS_SUBMIT_FAIL] Salvage library_profiles exception:", e);
                logger.error("Failed to salvage library_profiles during filesystem save", {
                    error: e
                });
                endPerfMark(mark, {
                    tab: tab.id,
                    valid: true,
                    success: false
                });
                return fail(500, { form });
            }
        }

        const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
            body: payload,
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey, ...SETTINGS_WRITE_HEADERS },
            fetch,
            params: { path: { paths } }
        });

        if (res.error) {
            console.error(
                "[SETTINGS_SUBMIT_FAIL] Backend POST error for tab:",
                tab.id,
                "paths:",
                paths,
                "error:",
                JSON.stringify(res.error)
            );
            endPerfMark(mark, {
                tab: tab.id,
                valid: true,
                success: false
            });
            return fail(500, { form });
        }

        endPerfMark(mark, {
            tab: tab.id,
            valid: true,
            success: true
        });

        return { form };
    }
} satisfies Actions;
