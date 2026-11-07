type RecordValue = Record<string, unknown>;

const SECRET_MARKER = "********-settings";
const SECRET_PATHS = [
    "downloaders.real_debrid.api_key",
    "downloaders.debrid_link.api_key",
    "downloaders.all_debrid.api_key",
    "updaters.plex.token",
    "updaters.jellyfin.api_key",
    "updaters.emby.api_key",
    "content.listrr.api_key",
    "content.mdblist.api_key",
    "content.overseerr.api_key",
    "content.overseerr.webhook_secret",
    "content.plex_webhook.webhook_secret",
    "content.trakt.oauth.oauth_client_secret",
    "content.trakt.oauth.access_token",
    "content.trakt.oauth.refresh_token",
    "scraping.orionoid.api_key",
    "scraping.jackett.api_key",
    "scraping.prowlarr.api_key",
    "scraping.aiostreams.uuid",
    "scraping.aiostreams.password",
    "subtitle.providers.opensubtitles.password",
    "subtitle.providers.subdl.api_key"
] as const;

function record(value: unknown): RecordValue | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as RecordValue)
        : undefined;
}

function readPath(root: RecordValue, path: string): unknown {
    let value: unknown = root;
    for (const part of path.split(".")) {
        value = record(value)?.[part];
        if (value === undefined) return undefined;
    }
    return value;
}

function writePath(root: RecordValue, path: string, nextValue: unknown): void {
    const parts = path.split(".");
    let parent = root;
    for (const part of parts.slice(0, -1)) {
        const child = record(parent[part]);
        if (!child) return;
        parent = child;
    }
    const leaf = parts.at(-1);
    if (leaf) parent[leaf] = nextValue;
}

/** Remove every stored integration secret before returning load data to the browser. */
export function projectSensitiveSettingsValue(value: RecordValue): RecordValue {
    const result = structuredClone(value);
    for (const path of SECRET_PATHS) {
        if (readPath(result, path)) writePath(result, path, SECRET_MARKER);
    }
    return result;
}

/** Restore only unchanged masked fields from a fresh server-side settings response. */
export function preserveSensitiveSettingsSubmission(
    payload: RecordValue,
    current: RecordValue
): RecordValue {
    const result = structuredClone(payload);
    for (const path of SECRET_PATHS) {
        if (readPath(result, path) === SECRET_MARKER) {
            const saved = readPath(current, path);
            if (saved === undefined) throw new Error(`Missing current secret setting: ${path}`);
            writePath(result, path, saved);
        }
    }
    return result;
}
