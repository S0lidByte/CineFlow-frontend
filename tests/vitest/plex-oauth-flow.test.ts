import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGeneratePlexPin = vi.fn();
const mockCheckPlexPin = vi.fn();
const mockBuildPlexAuthUrl = vi.fn();
const mockGetDefaultPlexOptions = vi.fn();

vi.mock("$env/dynamic/private", () => ({
    env: {
        ORIGIN: "https://cineflow.example.com",
        PLEX_CLIENT_ID: "test-client"
    }
}));

vi.mock("$app/environment", () => ({
    dev: false
}));

vi.mock("$lib/server/plex-oauth", () => ({
    generatePlexPin: (...args: unknown[]) => mockGeneratePlexPin(...args),
    checkPlexPin: (...args: unknown[]) => mockCheckPlexPin(...args),
    buildPlexAuthUrl: (...args: unknown[]) => mockBuildPlexAuthUrl(...args),
    getDefaultPlexOptions: (...args: unknown[]) => mockGetDefaultPlexOptions(...args)
}));

import { GET as authorizeGet } from "../../src/routes/api/plex/authorize/+server";
import { GET as callbackGet } from "../../src/routes/api/plex/callback/+server";

describe("Plex OAuth Authorize & Callback endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDefaultPlexOptions.mockReturnValue({
            clientId: "test-client",
            product: "CineFlow",
            version: "1.0",
            platform: "Web",
            device: "Browser"
        });
        mockBuildPlexAuthUrl.mockImplementation(
            (_opts: unknown, pinCode: string, callbackUrl: string) =>
                new URL(
                    `https://app.plex.tv/auth#code=${pinCode}&forwardUrl=${encodeURIComponent(callbackUrl)}`
                )
        );
    });

    it("authorize rejects missing state parameter with redirect", async () => {
        const url = new URL("https://cineflow.example.com/api/plex/authorize");
        const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

        await expect(authorizeGet({ url, cookies } as never)).rejects.toMatchObject({
            status: 302,
            location: "/auth/login?error=missing_state"
        });
    });

    it("authorize creates PIN, writes state cookie, and redirects to Plex", async () => {
        const url = new URL(
            "https://cineflow.example.com/api/plex/authorize?state=test-state-123&redirect_uri=https%3A%2F%2Fcineflow.example.com%2Fapi%2Fplex%2Fcallback"
        );
        const cookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
        mockGeneratePlexPin.mockResolvedValueOnce({
            id: 42,
            code: "ABCD",
            expiresAt: new Date(Date.now() + 600000).toISOString()
        });

        await expect(authorizeGet({ url, cookies } as never)).rejects.toMatchObject({
            status: 302,
            location: expect.stringContaining("https://app.plex.tv/auth#code=ABCD")
        });

        expect(cookies.set).toHaveBeenCalledWith(
            "plex_auth_state",
            expect.stringContaining('"pinId":42'),
            expect.objectContaining({ httpOnly: true, path: "/" })
        );
    });

    it("callback rejects missing cookie", async () => {
        const url = new URL("https://cineflow.example.com/api/plex/callback");
        const cookies = { get: vi.fn().mockReturnValue(undefined), delete: vi.fn() };

        await expect(callbackGet({ url, cookies } as never)).rejects.toMatchObject({
            status: 302,
            location: "/auth/login?error=state_not_found"
        });
    });

    it("callback rejects expired PIN before making external calls", async () => {
        const url = new URL("https://cineflow.example.com/api/plex/callback");
        const expiredTime = new Date(Date.now() - 5000).toISOString();
        const cookies = {
            get: vi.fn().mockReturnValue(
                JSON.stringify({
                    state: "state-abc",
                    pinId: 42,
                    pinCode: "ABCD",
                    expiresAt: expiredTime
                })
            ),
            delete: vi.fn()
        };

        await expect(callbackGet({ url, cookies } as never)).rejects.toMatchObject({
            status: 302,
            location: "/auth/login?error=pin_expired"
        });
        expect(mockCheckPlexPin).not.toHaveBeenCalled();
        expect(cookies.delete).toHaveBeenCalledWith("plex_auth_state", { path: "/" });
    });

    it("callback forwards authorized PIN to Better Auth oauth2 callback", async () => {
        const url = new URL("https://cineflow.example.com/api/plex/callback");
        const validExpiry = new Date(Date.now() + 60000).toISOString();
        const cookies = {
            get: vi.fn().mockReturnValue(
                JSON.stringify({
                    state: "state-valid",
                    pinId: 99,
                    pinCode: "WXYZ",
                    expiresAt: validExpiry
                })
            ),
            delete: vi.fn()
        };
        mockCheckPlexPin.mockResolvedValueOnce({
            id: 99,
            authToken: "plex-auth-token-xyz"
        });

        await expect(callbackGet({ url, cookies } as never)).rejects.toMatchObject({
            status: 302,
            location:
                "https://cineflow.example.com/api/auth/oauth2/callback/plex?code=99%3AWXYZ&state=state-valid"
        });
        expect(mockCheckPlexPin).toHaveBeenCalledWith(expect.anything(), "99", "WXYZ");
        expect(cookies.delete).toHaveBeenCalledWith("plex_auth_state", { path: "/" });
    });
});
