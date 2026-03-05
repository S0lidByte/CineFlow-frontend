import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler, type FormHandlerOptions } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";
import type { UiSchemaRoot } from "@sjsf/form";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-profiles-page-server");

/** Top-level AppModel key — library_profiles lives inside filesystem */
const PATHS = "filesystem";

async function getSchemaForFilesystem(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/schema/keys", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { query: { keys: PATHS, title: "Library Profiles" } }
    });
    if (res.error) throw new Error("Failed to load filesystem schema");
    return res.data as Record<string, unknown>;
}

async function getFilesystemValues(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to load filesystem settings");
    // Returns { filesystem: { mount_path, library_profiles, ... } }
    return res.data as Record<string, unknown>;
}

/**
 * Build a narrowed UI schema that hides all FilesystemModel fields
 * except library_profiles, so the SJSF form only renders that section.
 *
 * The top-level key must remain "filesystem" because that is what the API
 * GET returns and what the POST set/{paths} endpoint expects.
 */
function buildLibraryProfilesUiSchema(
    filesystemProperties: Record<string, unknown>
): UiSchemaRoot {
    // Show only library_profiles; hide everything else by setting ui:widget hidden
    const hiddenFields: Record<string, unknown> = {};
    for (const key of Object.keys(filesystemProperties)) {
        if (key !== "library_profiles") {
            hiddenFields[key] = { "ui:widget": "hidden" };
        }
    }
    return {
        filesystem: {
            "ui:order": ["library_profiles"],
            ...hiddenFields
        }
    } as UiSchemaRoot;
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
    if (locals.user?.role !== "admin") {
        error(403, "Forbidden");
    }

    logger.info("Library profiles page load started");

    let schema: Record<string, unknown>;
    let initialValue: Record<string, unknown>;

    try {
        [schema, initialValue] = await Promise.all([
            getSchemaForFilesystem(locals.backendUrl, locals.apiKey, fetch),
            getFilesystemValues(locals.backendUrl, locals.apiKey, fetch)
        ]);
    } catch (e) {
        logger.error("Library profiles page load failed", {
            error: e instanceof Error ? e.message : String(e)
        });
        error(503, "Failed to load library profiles from backend.");
    }

    // schema.properties.filesystem = FilesystemModel JSON schema
    const filesystemProperties = (
        (schema.properties as Record<string, unknown>)?.["filesystem"] as
        | Record<string, unknown>
        | undefined
    )?.["properties"] as Record<string, unknown> | undefined ?? {};

    const uiSchema = buildLibraryProfilesUiSchema(filesystemProperties);

    logger.info("Library profiles page load completed");

    // initialValue = { filesystem: { mount_path, library_profiles, ... } }
    // Pass the full filesystem value so hidden fields are preserved by SJSF
    return {
        form: {
            schema,
            initialValue,
            uiSchema
        } satisfies InitialFormData
    };
};

export const actions = {
    default: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") {
            error(403, "Forbidden");
        }

        logger.info("Library profiles save started");

        let schema: Record<string, unknown>;
        try {
            schema = await getSchemaForFilesystem(locals.backendUrl, locals.apiKey, fetch);
        } catch (e) {
            logger.error("Failed to fetch schema for save", {
                error: e instanceof Error ? e.message : String(e)
            });
            error(503, "Failed to load schema from backend.");
        }

        const filesystemProperties = (
            (schema.properties as Record<string, unknown>)?.["filesystem"] as
            | Record<string, unknown>
            | undefined
        )?.["properties"] as Record<string, unknown> | undefined ?? {};

        const uiSchema = buildLibraryProfilesUiSchema(filesystemProperties);

        const requestFormData = await request.formData();

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
            logger.warn("Library profiles form validation failed");
            return fail(400, { form });
        }

        // form.data = { filesystem: { ...full FilesystemModel... } }
        // POST to set/filesystem — the backend replaces the entire filesystem key
        const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
            body: form.data as Record<string, unknown>,
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            params: { path: { paths: PATHS } }
        });

        if (res.error) {
            logger.error("Library profiles save failed");
            return fail(500, { form });
        }

        logger.info("Library profiles saved successfully");
        return { form };
    }
} satisfies Actions;
