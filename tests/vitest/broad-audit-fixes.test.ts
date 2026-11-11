import { describe, expect, test, vi } from "vitest";
import { POST as regenerateApiKey } from "../../src/routes/(protected)/api/settings/regenerate-apikey/+server";
import { GET as proxyStreamFile } from "../../src/routes/(protected)/api/stream/[itemId]/+server";
import { GET as proxyHlsFile } from "../../src/routes/(protected)/api/stream/[itemId]/hls/[...file]/+server";
import { POST as postClientLog } from "../../src/routes/(protected)/api/logs/client/+server";
import { RealDebridTransfersStore } from "../../src/lib/stores/realdebrid-transfers.svelte";
import providers from "../../src/lib/providers";

describe("broad audit fixes", () => {
    test("regenerate-apikey rejects message-only payload instead of treating message as key", async () => {
        const mockFetch = vi.fn(
            async () =>
                new Response(JSON.stringify({ message: "API key regenerated successfully." }), {
                    status: 200,
                    headers: { "content-type": "application/json" }
                })
        );

        const res = await regenerateApiKey({
            locals: {
                user: { id: "u1", role: "admin" } as never,
                backendUrl: "http://backend.local",
                apiKey: "bff-key"
            } as never,
            fetch: mockFetch as never
        } as never);

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.apiKey).toBeUndefined();
    });

    test("regenerate-apikey returns key when backend provides key", async () => {
        const mockFetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        message: "API key regenerated successfully.",
                        key: "0123456789abcdef0123456789abcdef"
                    }),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" }
                    }
                )
        );

        const res = await regenerateApiKey({
            locals: {
                user: { id: "u1", role: "admin" } as never,
                backendUrl: "http://backend.local",
                apiKey: "bff-key"
            } as never,
            fetch: mockFetch as never
        } as never);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.apiKey).toBe("0123456789abcdef0123456789abcdef");
    });

    test("stream proxy rejects path traversal and non-numeric itemId", async () => {
        const mockFetch = vi.fn();
        await expect(
            proxyStreamFile({
                params: { itemId: "../../settings/get/all" },
                locals: {
                    user: { id: "u1", role: "user" } as never,
                    backendUrl: "http://backend.local",
                    apiKey: "bff-key"
                } as never,
                request: new Request("http://localhost/api/stream/bad"),
                fetch: mockFetch as never,
                url: new URL("http://localhost/api/stream/bad")
            } as never)
        ).rejects.toMatchObject({ status: 400 });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test("HLS stream proxy rejects traversal in file param and allows valid paths", async () => {
        const mockFetch = vi.fn(
            async () =>
                new Response("#EXTM3U", {
                    status: 200,
                    headers: { "content-type": "application/vnd.apple.mpegurl" }
                })
        );

        await expect(
            proxyHlsFile({
                params: { itemId: "42", file: "../../../settings/get/all" },
                locals: {
                    user: { id: "u1", role: "user" } as never,
                    backendUrl: "http://backend.local",
                    apiKey: "bff-key"
                } as never,
                fetch: mockFetch as never,
                url: new URL("http://localhost/api/stream/42/hls/bad")
            } as never)
        ).rejects.toMatchObject({ status: 400 });
        expect(mockFetch).not.toHaveBeenCalled();

        const okRes = await proxyHlsFile({
            params: { itemId: "42", file: "segment/0.ts" },
            locals: {
                user: { id: "u1", role: "user" } as never,
                backendUrl: "http://backend.local",
                apiKey: "bff-key"
            } as never,
            fetch: mockFetch as never,
            url: new URL("http://localhost/api/stream/42/hls/segment/0.ts")
        } as never);
        expect(okRes.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("client log endpoint rejects non-object payloads", async () => {
        const res = await postClientLog({
            request: new Request("http://localhost/api/logs/client", {
                method: "POST",
                body: JSON.stringify(["not", "an", "object"]),
                headers: { "content-type": "application/json" }
            }),
            locals: { user: { id: "u1", name: "RealUser" } } as never
        } as never);
        expect(res.status).toBe(400);
    });

    test("RealDebridTransfersStore invalidates detailsMap on forceRefresh", async () => {
        const store = new RealDebridTransfersStore();
        const getSpy = vi.spyOn(providers.riven, "GET");

        getSpy.mockResolvedValueOnce({
            data: {
                id: "t1",
                filename: "Movie.mkv",
                hash: "abc",
                bytes: 1,
                progress: 100,
                status: "downloaded",
                added: "",
                files: []
            }
        } as never);
        await store.fetchDetail("t1");
        expect(store.detailsMap["t1"]).toBeDefined();

        getSpy.mockResolvedValueOnce({
            data: {
                transfers: [],
                stats: {
                    total: 0,
                    active: 0,
                    queued: 0,
                    downloaded: 0,
                    failed: 0,
                    active_slots_used: 0,
                    active_slots_limit: 20
                },
                rd_enabled: true
            }
        } as never);
        await store.fetchTransfers(true);
        expect(store.detailsMap["t1"]).toBeUndefined();

        getSpy.mockRestore();
    });
});
