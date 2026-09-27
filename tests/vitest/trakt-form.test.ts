import { expect, it } from "vitest";
import { SJSF_ID_PREFIX } from "@sjsf/form";
import { createFormHandler } from "@sjsf/sveltekit/server";
import * as defaults from "../../src/lib/components/settings/form-defaults";
import {
    projectTraktSchema,
    projectTraktValue,
    mergeTraktSubmission
} from "../../src/lib/components/settings/trakt-settings";
import { buildSettingsUiSchema } from "../../src/lib/components/settings/settings-schema-transform";

it("round trips projected content through the installed SJSF validator and server merge", async () => {
    const rawSchema = {
        type: "object",
        properties: {
            content: {
                type: "object",
                properties: {
                    trakt: {
                        type: "object",
                        properties: {
                            api_key: { type: "string", default: "" },
                            oauth: { type: "object" },
                            enabled: { type: "boolean" }
                        }
                    }
                }
            }
        }
    };
    const current = {
        content: {
            trakt: {
                api_key: "public-id",
                enabled: true,
                oauth: {
                    oauth_client_id: "legacy-id",
                    oauth_client_secret: "existing-secret",
                    access_token: "latest-access",
                    refresh_token: "latest-refresh"
                }
            }
        }
    };
    const schema = projectTraktSchema(rawSchema);
    const uiSchema = buildSettingsUiSchema(schema.properties as Record<string, unknown>, [
        "content"
    ]);
    expect(uiSchema).toHaveProperty(
        "content.trakt.client_secret.ui:components.textWidget",
        "apiKeyWidget"
    );
    const handler = createFormHandler({ ...defaults, schema, uiSchema, sendData: true });
    const data = new FormData();
    data.set(SJSF_ID_PREFIX, "settings");
    data.set("__sjsf_sveltekit_json_chunks", JSON.stringify(projectTraktValue(current)));
    const [form] = await handler(new AbortController().signal, data);
    expect(form.isValid).toBe(true);
    const merged = mergeTraktSubmission(
        form.data as Record<string, unknown>,
        current,
        "https://cineflow.example"
    );
    expect(merged).toHaveProperty("content.trakt.oauth.access_token", "latest-access");
    expect(merged).toHaveProperty("content.trakt.oauth.oauth_client_id", "legacy-id");
    expect(form.data).not.toHaveProperty("content.trakt.oauth");
    expect(form.data).toHaveProperty("content.trakt.client_secret", "");
});
