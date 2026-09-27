type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as RecordValue)
        : undefined;
}

function traktValue(value: RecordValue): RecordValue | undefined {
    return record(record(value.content)?.trakt);
}

export function traktCallback(origin: string): string {
    return new URL("/api/trakt/oauth/callback", origin).href;
}

/** UI-only projection. Never change the backend's legacy credential precedence. */
export function projectTraktValue(value: RecordValue): RecordValue {
    const result = structuredClone(value);
    const trakt = traktValue(result);
    if (!trakt) return result;
    const oauth = record(trakt.oauth) ?? {};
    trakt.api_key = oauth.oauth_client_id || trakt.api_key || "";
    // The stored secret and tokens remain server-side. Empty means keep the saved secret.
    trakt.client_secret = "";
    delete trakt.oauth;
    return result;
}

/** Handles filtered inline schemas and the full schema's local references. */
export function projectTraktSchema(schema: RecordValue): RecordValue {
    const result = structuredClone(schema);
    function resolve(value: unknown): RecordValue | undefined {
        const node = record(value);
        if (typeof node?.$ref === "string" && node.$ref.startsWith("#/")) {
            return node.$ref
                .slice(2)
                .split("/")
                .reduce<RecordValue | undefined>(
                    (parent, key) => record(parent?.[key.replace(/~1/g, "/").replace(/~0/g, "~")]),
                    result
                );
        }
        return node;
    }
    const content = resolve(record(result.properties)?.content);
    const trakt = resolve(record(content?.properties)?.trakt);
    const props = record(trakt?.properties);
    if (!trakt || !props) return result;
    props.api_key = {
        ...record(props.api_key),
        title: "Client ID",
        description: "Trakt application Client ID (also used as the API key)."
    };
    props.client_secret = {
        type: "string",
        default: "",
        title: "Client Secret",
        description: "Leave blank to keep the saved secret. Save changes before connecting."
    };
    delete props.oauth;
    if (Array.isArray(trakt.required)) {
        trakt.required = trakt.required.filter((key) => key !== "oauth");
    }
    return result;
}

/** Reconstitute only on the server using freshly fetched settings, never stale browser tokens. */
export function mergeTraktSubmission(
    payload: RecordValue,
    current: RecordValue,
    origin: string
): RecordValue {
    const result = structuredClone(payload);
    const submitted = traktValue(result);
    if (!submitted) return result;
    const saved = traktValue(current);
    if (!saved) throw new Error("Current Trakt settings unavailable");
    const oauth = record(saved.oauth) ?? {};
    const effectiveId = oauth.oauth_client_id || saved.api_key || "";
    const clientId = submitted.api_key ?? effectiveId;
    const secret = submitted.client_secret;
    delete submitted.client_secret;
    // An unchanged legacy configuration keeps BOTH stored IDs exactly as they were.
    // An explicit edit updates both, so the legacy override cannot mask the user's edit.
    submitted.api_key = clientId === effectiveId ? saved.api_key : clientId;
    submitted.oauth = {
        ...oauth,
        oauth_client_id: clientId === effectiveId ? (oauth.oauth_client_id ?? "") : clientId,
        oauth_client_secret:
            typeof secret === "string" && secret.length > 0
                ? secret
                : (oauth.oauth_client_secret ?? ""),
        oauth_redirect_uri: traktCallback(origin)
    };
    return result;
}
