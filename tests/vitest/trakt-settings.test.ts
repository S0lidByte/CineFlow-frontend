import { describe, expect, it } from "vitest";
import {
    projectTraktSchema,
    projectTraktValue,
    mergeTraktSubmission,
    traktCallback
} from "../../src/lib/components/settings/trakt-settings";

const saved = (legacy = "legacy") => ({
    content: {
        trakt: {
            api_key: "api",
            enabled: true,
            proxy_url: "",
            oauth: {
                oauth_client_id: legacy,
                oauth_client_secret: "saved-secret",
                access_token: "access",
                refresh_token: "refresh",
                oauth_redirect_uri: "old"
            }
        }
    }
});

describe("Trakt settings projection and save boundary", () => {
    it.each(["legacy", ""])(
        "preserves effective and stored credentials on unchanged save (%s)",
        (legacy) => {
            const current = saved(legacy);
            const value = projectTraktValue(current);
            expect(value).not.toHaveProperty("content.trakt.oauth");
            expect(value).toHaveProperty("content.trakt.api_key", legacy || "api");
            expect(value).toHaveProperty("content.trakt.client_secret", "");
            const result = mergeTraktSubmission(value, current, "https://cineflow.example");
            expect(result).toHaveProperty("content.trakt.api_key", "api");
            expect(result).toHaveProperty("content.trakt.oauth.oauth_client_id", legacy);
            expect(result).toHaveProperty("content.trakt.oauth.access_token", "access");
            expect(result).toHaveProperty("content.trakt.oauth.refresh_token", "refresh");
            expect(result).toHaveProperty(
                "content.trakt.oauth.oauth_client_secret",
                "saved-secret"
            );
            expect(result).toHaveProperty(
                "content.trakt.oauth.oauth_redirect_uri",
                "https://cineflow.example/api/trakt/oauth/callback"
            );
            expect(current.content.trakt.oauth.oauth_redirect_uri).toBe("old");
        }
    );
    it("explicit ID edits update both aliases and ignore browser-supplied internal tokens", () => {
        const payload = {
            content: {
                trakt: {
                    api_key: "new",
                    client_secret: "new-secret",
                    oauth: { access_token: "injected" }
                }
            }
        };
        const result = mergeTraktSubmission(payload, saved(), "http://localhost:3000");
        expect(result).toHaveProperty("content.trakt.api_key", "new");
        expect(result).toHaveProperty("content.trakt.oauth.oauth_client_id", "new");
        expect(result).toHaveProperty("content.trakt.oauth.oauth_client_secret", "new-secret");
        expect(result).toHaveProperty("content.trakt.oauth.access_token", "access");
        expect(result).not.toHaveProperty("content.trakt.client_secret");
    });
    it("fails closed without current credentials and leaves unrelated tabs alone", () => {
        expect(() =>
            mergeTraktSubmission(projectTraktValue(saved()), {}, "https://example.com")
        ).toThrow();
        expect(mergeTraktSubmission({ filesystem: {} }, {}, "https://example.com")).toEqual({
            filesystem: {}
        });
        expect(traktCallback("https://example.com:8443/path")).toBe(
            "https://example.com:8443/api/trakt/oauth/callback"
        );
    });
    it.each([false, true])(
        "prunes inline and referenced schemas, without mutating input (%s)",
        (refs) => {
            const trakt = {
                type: "object",
                required: ["oauth", "api_key"],
                properties: {
                    api_key: { type: "string" },
                    oauth: { type: "object" },
                    proxy_url: { type: "string" }
                }
            };
            const content = {
                properties: { trakt: refs ? { $ref: "#/$defs/TraktModel" } : trakt }
            };
            const schema = {
                properties: { content: refs ? { $ref: "#/$defs/ContentModel" } : content },
                $defs: { TraktModel: trakt, ContentModel: content }
            };
            const result = projectTraktSchema(schema);
            const projected = refs
                ? (result.$defs as typeof schema.$defs).TraktModel
                : ((result.properties as typeof schema.properties).content as typeof content)
                      .properties.trakt;
            expect(projected).not.toHaveProperty("properties.oauth");
            expect(projected).toHaveProperty("properties.api_key.title", "Client ID");
            expect(projected).toHaveProperty("properties.client_secret.title", "Client Secret");
            expect(projected).toHaveProperty("required", ["api_key"]);
            expect(trakt.properties).toHaveProperty("oauth");
        }
    );
});
