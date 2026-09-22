import type { UiSchemaRoot } from "@sjsf/form";

export type SjsfUiSchema = UiSchemaRoot;
export type SjsfUiSchemaRecord = Record<string, unknown>;

export const WIDGET_OVERRIDES: Record<string, Record<string, unknown>> = {
    api_key: { "ui:components": { textWidget: "apiKeyWidget" } }
};

const NOISE_TITLE_PATTERNS = [
    /^Settings$/i,
    /(?:Settings|Model|Config|Dict|Parameters|ParametersDict)$/i,
    /^RootModel\[.+\]$/i
];

/**
 * Determines whether a title generated from backend Pydantic models represents an internal class name
 * rather than a user-friendly display title.
 */
export function isNoiseSchemaTitle(title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return true;
    return NOISE_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Humanizes a snake_case, camelCase, or kebab-case schema property key into Title Case words,
 * with domain-specific capitalization for common acronyms.
 */
export function humanizeSchemaKey(key: string): string {
    const ACRONYM_MAP: Record<string, string> = {
        api: "API",
        url: "URL",
        uri: "URI",
        id: "ID",
        ip: "IP",
        db: "DB",
        ssl: "SSL",
        tls: "TLS",
        http: "HTTP",
        https: "HTTPS",
        rtn: "RTN",
        vfs: "VFS",
        rd: "RD",
        ad: "AD",
        pm: "PM",
        tb: "TB",
        oc: "OC",
        ed: "ED",
        torbox: "TorBox",
        realdebrid: "Real-Debrid",
        alldebrid: "AllDebrid",
        premiumize: "Premiumize",
        offcloud: "Offcloud",
        easydebrid: "EasyDebrid",
        debridlink: "Debrid-Link",
        prowlarr: "Prowlarr",
        jackett: "Jackett",
        zilean: "Zilean",
        torrentio: "Torrentio",
        stremthru: "StremThru",
        comet: "Comet",
        mediafusion: "MediaFusion"
    };

    const words = key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .split(/\s+/);

    return words
        .map((word) => {
            const lower = word.toLowerCase();
            if (ACRONYM_MAP[lower]) {
                return ACRONYM_MAP[lower];
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

/**
 * Deeply sanitizes JSON schema title fields across objects, nested properties, and definitions.
 * Strips noise class titles like "ScrapersSettings" while preserving human-authored titles or humanizing property keys.
 */
export function sanitizeSettingsSchemaTitles(
    schema: Record<string, unknown>
): Record<string, unknown> {
    const isSchemaRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    const replaceOwnProperty = (target: Record<string, unknown>, key: string, value: unknown) => {
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            value,
            writable: true
        });
    };

    const sanitizeSchemaMap = (
        value: unknown,
        propertyTitles: boolean
    ): Record<string, unknown> | undefined => {
        if (!isSchemaRecord(value)) return undefined;

        const result = structuredClone(value);
        for (const [key, child] of Object.entries(value)) {
            replaceOwnProperty(result, key, sanitizeNode(child, propertyTitles ? key : undefined));
        }
        return result;
    };

    const sanitizeSchemaArray = (value: unknown): unknown => {
        if (!Array.isArray(value)) return value;
        return value.map((child) => sanitizeNode(child));
    };

    const sanitizeNode = (value: unknown, propertyKey?: string): unknown => {
        if (!isSchemaRecord(value)) return value;

        const result = structuredClone(value);
        if (typeof result.title === "string" && isNoiseSchemaTitle(result.title)) {
            delete result.title;
        }

        const propertyMap = sanitizeSchemaMap(value.properties, true);
        if (propertyMap) replaceOwnProperty(result, "properties", propertyMap);

        for (const definitionKey of ["$defs", "definitions", "patternProperties"] as const) {
            const definitions = sanitizeSchemaMap(value[definitionKey], false);
            if (definitions) replaceOwnProperty(result, definitionKey, definitions);
        }

        for (const schemaKey of [
            "additionalProperties",
            "unevaluatedProperties",
            "propertyNames",
            "items",
            "contains",
            "not",
            "if",
            "then",
            "else"
        ] as const) {
            if (value[schemaKey] !== undefined) {
                replaceOwnProperty(result, schemaKey, sanitizeNode(value[schemaKey]));
            }
        }

        for (const combinationKey of ["allOf", "anyOf", "oneOf", "prefixItems"] as const) {
            if (value[combinationKey] !== undefined) {
                replaceOwnProperty(
                    result,
                    combinationKey,
                    sanitizeSchemaArray(value[combinationKey])
                );
            }
        }

        const dependentSchemas = sanitizeSchemaMap(value.dependentSchemas, false);
        if (dependentSchemas) replaceOwnProperty(result, "dependentSchemas", dependentSchemas);

        if (propertyKey && typeof result.title !== "string") {
            result.title = humanizeSchemaKey(propertyKey);
        }
        return result;
    };

    return sanitizeNode(schema) as Record<string, unknown>;
}

/**
 * Removes `library_profiles` from top-level schema properties and required list,
 * as library profiles are managed in a separate dedicated UI view.
 */
export function pruneLibraryProfilesFromSchema(
    schema: Record<string, unknown>
): Record<string, unknown> {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        return schema;
    }

    const cloned = { ...schema };

    if (
        cloned.properties &&
        typeof cloned.properties === "object" &&
        !Array.isArray(cloned.properties)
    ) {
        const props = { ...(cloned.properties as Record<string, unknown>) };
        delete props.library_profiles;

        const filesystem = props.filesystem;
        if (filesystem && typeof filesystem === "object" && !Array.isArray(filesystem)) {
            props.filesystem = pruneLibraryProfilesFromSchema(
                filesystem as Record<string, unknown>
            );
        }

        cloned.properties = props;
    }

    if (Array.isArray(cloned.required)) {
        cloned.required = (cloned.required as string[]).filter((key) => key !== "library_profiles");
    }

    if (cloned.$defs && typeof cloned.$defs === "object" && !Array.isArray(cloned.$defs)) {
        const definitions = { ...(cloned.$defs as Record<string, unknown>) };
        const filesystem = definitions.FilesystemModel;
        if (filesystem && typeof filesystem === "object" && !Array.isArray(filesystem)) {
            definitions.FilesystemModel = pruneLibraryProfilesFromSchema(
                filesystem as Record<string, unknown>
            );
            cloned.$defs = definitions;
        }
    }

    return cloned;
}

/**
 * Removes `library_profiles` from the initial values record.
 */
export function pruneLibraryProfilesFromValue(
    initialValue: Record<string, unknown>
): Record<string, unknown> {
    if (!initialValue || typeof initialValue !== "object" || Array.isArray(initialValue)) {
        return initialValue;
    }
    const cloned = { ...initialValue };
    delete cloned.library_profiles;

    if (
        cloned.filesystem &&
        typeof cloned.filesystem === "object" &&
        !Array.isArray(cloned.filesystem)
    ) {
        const filesystem = { ...(cloned.filesystem as Record<string, unknown>) };
        delete filesystem.library_profiles;
        cloned.filesystem = filesystem;
    }

    return cloned;
}

/**
 * Constructs an ordered, typed SJSF UI schema from properties, setting layout orders,
 * applying widget overrides (such as custom apiKeyWidget), and hiding root model labels.
 */
export function buildSettingsUiSchema(
    properties: Record<string, unknown> | undefined,
    keys: string[],
    widgetOverrides: Record<string, Record<string, unknown>> = WIDGET_OVERRIDES
): UiSchemaRoot {
    const validProps = properties ?? {};
    const order = keys.filter((k) => validProps[k] !== undefined);
    const ui: Record<string, unknown> = {
        "ui:order": order.length > 0 ? order : undefined,
        // Page shell already shows the section title — hide root schema model name.
        "ui:options": { title: false, description: false }
    };

    // Merge any widget overrides whose key is present in the current tab's schema.
    for (const [key, override] of Object.entries(widgetOverrides)) {
        if (validProps[key] !== undefined) {
            ui[key] = override;
        }
    }

    return ui as UiSchemaRoot;
}
