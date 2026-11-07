import { describe, expect, it } from "vitest";

import {
    preserveSensitiveSettingsSubmission,
    projectSensitiveSettingsValue
} from "$lib/components/settings/sensitive-settings";

interface SampleSettings {
    updaters?: { plex?: { token?: string; url?: string } };
    content?: {
        plex_webhook?: { webhook_secret?: string };
        trakt?: { api_key?: string };
    };
}

describe("sensitive settings projection", () => {
    it("removes stored integration credentials from browser page data", () => {
        const source = {
            updaters: { plex: { token: "plex-token", url: "http://plex:32400" } },
            content: {
                plex_webhook: { webhook_secret: "webhook-secret" },
                trakt: {
                    api_key: "public-client-id",
                    oauth: {
                        oauth_client_secret: "trakt-secret",
                        access_token: "access-token",
                        refresh_token: "refresh-token"
                    }
                }
            }
        };

        const projected = projectSensitiveSettingsValue(source) as SampleSettings;

        expect(JSON.stringify(projected)).not.toContain("plex-token");
        expect(JSON.stringify(projected)).not.toContain("webhook-secret");
        expect(JSON.stringify(projected)).not.toContain("trakt-secret");
        expect(JSON.stringify(projected)).not.toContain("access-token");
        expect(projected.updaters?.plex?.token).toBe("********-settings");
        expect(projected.updaters?.plex?.url).toBe("http://plex:32400");
        expect(projected.content?.trakt?.api_key).toBe("public-client-id");
        expect(source.updaters.plex.token).toBe("plex-token");
    });

    it("restores unchanged credentials from the fresh server response", () => {
        const payload = {
            updaters: { plex: { token: "********-settings", url: "http://plex:32400" } },
            content: { plex_webhook: { webhook_secret: "********-settings" } }
        };
        const current = {
            updaters: { plex: { token: "saved-plex-token", url: "http://plex:32400" } },
            content: { plex_webhook: { webhook_secret: "saved-webhook-secret" } }
        };

        const restored = preserveSensitiveSettingsSubmission(payload, current) as SampleSettings;

        expect(restored.updaters?.plex?.token).toBe("saved-plex-token");
        expect(restored.content?.plex_webhook?.webhook_secret).toBe("saved-webhook-secret");
        expect(payload.updaters.plex.token).toBe("********-settings");
    });

    it("keeps explicit credential replacements", () => {
        const payload = {
            updaters: { plex: { token: "replacement-token" } },
            content: { plex_webhook: { webhook_secret: "replacement-secret" } }
        };

        const restored = preserveSensitiveSettingsSubmission(payload, {
            updaters: { plex: { token: "old-token" } },
            content: { plex_webhook: { webhook_secret: "old-secret" } }
        }) as SampleSettings;

        expect(restored.updaters?.plex?.token).toBe("replacement-token");
        expect(restored.content?.plex_webhook?.webhook_secret).toBe("replacement-secret");
    });
});
