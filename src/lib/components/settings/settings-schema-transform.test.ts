import {
    isNoiseSchemaTitle,
    humanizeSchemaKey,
    sanitizeSettingsSchemaTitles,
    pruneLibraryProfilesFromSchema,
    pruneLibraryProfilesFromValue,
    buildSettingsUiSchema
} from "./settings-schema-transform";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

for (const title of [
    "ScrapersSettings",
    "DownloadersSettings",
    "ProxySettings",
    "SymlinkSettings",
    "RcloneSettings",
    "AppModel",
    "BaseModel",
    "FilesystemModel",
    "DownloaderConfig",
    "IndexerDict",
    "SearchParameters",
    "SearchParametersDict",
    "RootModel[str]",
    "",
    "   "
]) {
    assert(
        isNoiseSchemaTitle(title),
        `${title || "<empty>"} should be classified as a noise title`
    );
}

for (const title of [
    "Enable Scraper",
    "API Key",
    "Download Speed Limit",
    "General Configuration"
]) {
    assert(!isNoiseSchemaTitle(title), `${title} should be preserved as a human-authored title`);
}

const humanizedKeys: Array<[string, string]> = [
    ["download_speed_limit", "Download Speed Limit"],
    ["enable_proxy", "Enable Proxy"],
    ["api_key", "API Key"],
    ["backend_url", "Backend URL"],
    ["ssl_verify", "SSL Verify"],
    ["http_proxy", "HTTP Proxy"],
    ["rtn_ranking", "RTN Ranking"],
    ["vfs_cache", "VFS Cache"],
    ["realdebrid_api", "Real-Debrid API"],
    ["alldebrid_key", "AllDebrid Key"],
    ["prowlarr_url", "Prowlarr URL"],
    ["torbox_token", "TorBox Token"],
    ["stremthru_url", "StremThru URL"],
    ["apiKey", "API Key"],
    ["downloadSpeedLimit", "Download Speed Limit"],
    ["custom-api-header", "Custom API Header"]
];

for (const [key, expected] of humanizedKeys) {
    assert(humanizeSchemaKey(key) === expected, `${key} should humanize to ${expected}`);
}

const rawSchema = {
    title: "ScrapersSettings",
    type: "object",
    properties: {
        api_key: {
            type: "string",
            title: "AppModel",
            description: "Your secret API key",
            minLength: 32,
            pattern: "^[A-Za-z0-9]+$"
        },
        custom_url: {
            type: "string",
            description: "Custom endpoint URL",
            format: "multi-host-uri"
        },
        scrape_interval: {
            type: "integer",
            title: "Time Between Scrapes (Minutes)",
            description: "Interval in minutes",
            default: 30,
            minimum: 1
        },
        proxy_servers: {
            type: "array",
            title: "ProxyConfig",
            items: {
                title: "ProxyModel",
                type: "object",
                properties: {
                    proxy_url: { type: "string", format: "uri" }
                }
            }
        },
        media_path: {
            anyOf: [{ title: "RootModel[path]", type: "string", format: "path" }, { type: "null" }]
        },
        backend_choice: {
            oneOf: [
                { title: "PrimaryConfig", type: "string", enum: ["primary"] },
                { title: "FallbackConfig", type: "string", enum: ["fallback"] }
            ]
        },
        inherited_settings: {
            allOf: [
                {
                    title: "BaseModel",
                    type: "object",
                    properties: { enable_tls: { type: "boolean", default: true } }
                }
            ]
        }
    },
    $defs: {
        ProxySettings: {
            title: "ProxySettings",
            type: "object",
            properties: {
                proxy_url: { type: "string" }
            }
        }
    },
    definitions: {
        LegacyModel: {
            title: "LegacyModel",
            type: "object",
            properties: {
                cache_path: { type: "string", format: "path" }
            }
        }
    }
};

const sanitized = sanitizeSettingsSchemaTitles(rawSchema);
const sanitizedProps = sanitized.properties as Record<string, Record<string, unknown>>;
const sanitizedDefs = sanitized.$defs as Record<
    string,
    { title?: string; properties: { proxy_url: { title?: string } } }
>;
const sanitizedDefinitions = sanitized.definitions as Record<
    string,
    { title?: string; properties: { cache_path: { title?: string } } }
>;
assert(sanitized.title === undefined, "top-level noise class title should be removed");
assert(sanitizedProps.api_key.title === "API Key", "noise property title should be humanized");
assert(
    sanitizedProps.api_key.description === "Your secret API key",
    "property descriptions must be preserved"
);
assert(sanitizedProps.api_key.minLength === 32, "validation constraints must be preserved");
assert(sanitizedProps.api_key.pattern === "^[A-Za-z0-9]+$", "patterns must be preserved");
assert(sanitizedProps.custom_url.title === "Custom URL", "untitled property should be humanized");
assert(
    sanitizedProps.custom_url.format === "multi-host-uri",
    "custom schema formats must be preserved"
);
assert(
    sanitizedProps.scrape_interval.title === "Time Between Scrapes (Minutes)",
    "human-authored titles must be retained"
);
assert(sanitizedProps.scrape_interval.default === 30, "defaults must be preserved");
assert(sanitizedProps.scrape_interval.minimum === 1, "numeric limits must be preserved");
assert(
    (sanitizedProps.proxy_servers.items as Record<string, unknown>).title === undefined,
    "array item schemas must be traversed"
);
assert(
    (
        (sanitizedProps.proxy_servers.items as Record<string, unknown>).properties as Record<
            string,
            Record<string, unknown>
        >
    ).proxy_url.title === "Proxy URL",
    "array item properties must be humanized"
);
assert(
    (sanitizedProps.media_path.anyOf as Array<Record<string, unknown>>)[0].title === undefined,
    "anyOf schemas must be traversed"
);
assert(
    (sanitizedProps.media_path.anyOf as Array<Record<string, unknown>>)[0].format === "path",
    "nullable path formats must be preserved"
);
assert(
    (sanitizedProps.backend_choice.oneOf as Array<Record<string, unknown>>).every(
        (option) => option.title === undefined
    ),
    "oneOf schemas must be traversed"
);
assert(
    (sanitizedProps.inherited_settings.allOf as Array<Record<string, unknown>>)[0].title ===
        undefined,
    "allOf schemas must be traversed"
);
assert(
    sanitizedDefs.ProxySettings.title === undefined,
    "nested definition noise title should be removed"
);
assert(
    sanitizedDefs.ProxySettings.properties.proxy_url.title === "Proxy URL",
    "nested definition properties should be humanized"
);
assert(
    sanitizedDefinitions.LegacyModel.title === undefined,
    "legacy definitions must be traversed"
);
assert(
    sanitizedDefinitions.LegacyModel.properties.cache_path.title === "Cache Path",
    "legacy definition properties should be humanized"
);
assert(
    rawSchema.title === "ScrapersSettings",
    "schema transformations must not mutate backend data"
);
assert(
    rawSchema.properties.api_key.title === "AppModel",
    "nested source schema metadata must remain pristine"
);

const schemaWithProfiles = {
    type: "object",
    properties: {
        filesystem: { $ref: "#/$defs/FilesystemModel" }
    },
    $defs: {
        FilesystemModel: {
            type: "object",
            properties: {
                mount_path: { type: "string", format: "path" },
                cache_dir: { type: "string", format: "path" },
                library_profiles: { type: "object" }
            },
            required: ["mount_path", "library_profiles"]
        }
    }
};
const prunedSchema = pruneLibraryProfilesFromSchema(schemaWithProfiles);
const prunedFilesystem = (
    prunedSchema.$defs as Record<
        string,
        { properties: Record<string, unknown>; required: string[] }
    >
).FilesystemModel;
assert(
    prunedFilesystem.properties.library_profiles === undefined,
    "filesystem library_profiles must be removed from the nested definition schema"
);
assert(
    prunedFilesystem.properties.mount_path !== undefined &&
        prunedFilesystem.properties.cache_dir !== undefined,
    "unrelated filesystem definition schema properties must remain"
);
assert(
    JSON.stringify(prunedFilesystem.required) === JSON.stringify(["mount_path"]),
    "filesystem library_profiles must be removed from required schema fields"
);
assert(
    schemaWithProfiles.$defs.FilesystemModel.properties.library_profiles !== undefined,
    "definition pruning must not mutate the source schema"
);

const inlineFilesystemSchema = {
    type: "object",
    properties: {
        filesystem: {
            type: "object",
            properties: {
                mount_path: { type: "string", format: "path" },
                library_profiles: { type: "object" }
            },
            required: ["mount_path", "library_profiles"]
        }
    }
};
const prunedInlineSchema = pruneLibraryProfilesFromSchema(inlineFilesystemSchema);
const prunedInlineFilesystem = (
    prunedInlineSchema.properties as Record<
        string,
        { properties: Record<string, unknown>; required: string[] }
    >
).filesystem;
assert(
    prunedInlineFilesystem.properties.library_profiles === undefined,
    "filesystem library_profiles must be removed from inline live schemas"
);
assert(
    JSON.stringify(prunedInlineFilesystem.required) === JSON.stringify(["mount_path"]),
    "inline filesystem required list must remove library_profiles"
);
assert(
    inlineFilesystemSchema.properties.filesystem.properties.library_profiles !== undefined,
    "inline pruning must not mutate the source schema"
);

const initialValueWithProfiles = {
    filesystem: {
        mount_path: "/mnt/riven",
        cache_dir: "/cache",
        library_profiles: { default: { anime: false } }
    },
    general: { log_level: "INFO" }
};
const prunedValue = pruneLibraryProfilesFromValue(initialValueWithProfiles);
const prunedFilesystemValue = prunedValue.filesystem as Record<string, unknown>;
assert(
    prunedFilesystemValue.library_profiles === undefined,
    "filesystem library_profiles must be removed from initial values"
);
assert(
    prunedFilesystemValue.mount_path === "/mnt/riven" &&
        prunedFilesystemValue.cache_dir === "/cache",
    "unrelated filesystem values must remain"
);
assert(prunedValue.general === initialValueWithProfiles.general, "unrelated values must remain");
assert(
    initialValueWithProfiles.filesystem.library_profiles !== undefined,
    "value pruning must not mutate the source settings payload"
);

const uiProperties = {
    backend_url: { type: "string" },
    api_key: { type: "string" }
};
const uiSchema = buildSettingsUiSchema(uiProperties, ["api_key", "backend_url"]) as Record<
    string,
    unknown
>;
assert(
    JSON.stringify(uiSchema["ui:order"]) === JSON.stringify(["api_key", "backend_url"]),
    "UI schema must preserve selected settings order"
);
assert(
    JSON.stringify(uiSchema.api_key) ===
        JSON.stringify({ "ui:components": { textWidget: "apiKeyWidget" } }),
    "API key must use the secure custom apiKeyWidget override"
);
assert(
    uiSchema.backend_url === undefined,
    "fields without overrides should not receive unnecessary UI schema"
);

console.log("settings-schema-transform.test.ts: ok");
