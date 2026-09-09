/** Security regression tests for the Settings connection-test BFF route. */
import assert from "node:assert/strict";

import { POST } from "../../src/routes/(protected)/api/settings/test-connection/[service]/+server";
import { signActorPayload } from "$lib/server/permissions";

const originalFetch = globalThis.fetch;
let forwardedUrl = "";
let forwardedInit: RequestInit | undefined;

globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    forwardedUrl = input.toString();
    forwardedInit = init;
    return new Response(
        JSON.stringify({ ok: true, latency_ms: 12, message: "Connected to Zilean" }),
        { status: 200, headers: { "content-type": "application/json" } }
    );
}) as typeof fetch;

try {
    process.env.ACTOR_CONTEXT_SECRET = "test-attestation-secret-999";
    const response = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST",
            headers: {
                "x-api-key": "attacker-service-key",
                "x-actor-id": "attacker-admin",
                "x-actor-roles": "platform:admin",
                "x-actor-client": "attacker-client",
                "x-actor-timestamp": "1000000000",
                "x-actor-signature": "attacker-forged-sig"
            }
        })
    } as Parameters<typeof POST>[0]);

    const headers = new Headers(forwardedInit?.headers);
    assert.equal(response.status, 200);
    assert.equal(
        forwardedUrl,
        "https://backend.example.test/api/v1/settings/test-connection/zilean"
    );
    assert.equal(headers.get("x-api-key"), "server-only-service-key");
    assert.equal(headers.get("x-actor-id"), "trusted-admin");
    assert.equal(
        headers.get("x-actor-roles"),
        "platform:admin,settings:write,playback:operator,library:read,media:request"
    );
    assert.notEqual(headers.get("x-api-key"), "attacker-service-key");
    assert.notEqual(headers.get("x-actor-id"), "attacker-admin");
    assert.notEqual(headers.get("x-actor-roles"), "platform:admin");
    assert.notEqual(headers.get("x-actor-client"), "attacker-client");
    assert.notEqual(headers.get("x-actor-timestamp"), "1000000000");
    assert.notEqual(headers.get("x-actor-signature"), "attacker-forged-sig");
    assert.equal(
        headers.get("x-actor-signature"),
        signActorPayload(
            {
                actor_id: "trusted-admin",
                actor_roles:
                    "platform:admin,settings:write,playback:operator,library:read,media:request",
                actor_client: "cineflow-web-bff",
                actor_timestamp: headers.get("x-actor-timestamp")!
            },
            "test-attestation-secret-999"
        )
    );

    await assert.rejects(
        async () =>
            await POST({
                locals: {
                    backendUrl: "https://backend.example.test",
                    apiKey: "server-only-service-key",
                    user: { id: "manager", role: "manager" }
                },
                params: { service: "zilean" }
            } as Parameters<typeof POST>[0]),
        (reason: { status?: number }) => reason.status === 403
    );

    // --- Trailing-slash URL normalization ---
    forwardedUrl = "";
    await POST({
        locals: {
            backendUrl: "https://backend.example.test/",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    assert.equal(
        forwardedUrl,
        "https://backend.example.test/api/v1/settings/test-connection/zilean",
        "Trailing slash in backendUrl must not produce double-slash"
    );

    // --- Unsupported service returns 404 ---
    await assert.rejects(
        async () =>
            await POST({
                locals: {
                    backendUrl: "https://backend.example.test",
                    apiKey: "server-only-service-key",
                    user: { id: "trusted-admin", role: "admin" }
                },
                params: { service: "unknown_service" }
            } as Parameters<typeof POST>[0]),
        (reason: { status?: number }) => reason.status === 404
    );

    // --- Backend fetch failure returns soft-failure shape ---
    const savedFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
        throw new Error("network down");
    }) as typeof fetch;
    const unreachableRes = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    const unreachableBody = await unreachableRes.json();
    assert.equal(unreachableRes.status, 200);
    assert.equal(unreachableBody.ok, false);
    assert.equal(unreachableBody.message, "Backend unreachable");
    globalThis.fetch = savedFetch;

    // --- Abort budget cancels an unresponsive backend fetch ---
    const originalSetTimeout = globalThis.setTimeout;
    let abortDelay: number | undefined;
    let receivedSignal: AbortSignal | undefined;
    globalThis.setTimeout = ((
        callback: (...args: unknown[]) => void,
        delay?: number,
        ...args: unknown[]
    ) => {
        abortDelay = delay;
        callback(...args);
        return 0;
    }) as unknown as typeof setTimeout;
    globalThis.fetch = (async (_input, init?: RequestInit) => {
        receivedSignal = init?.signal as AbortSignal | undefined;
        assert.equal(receivedSignal?.aborted, true, "Abort budget should cancel the request");
        throw new DOMException("aborted", "AbortError");
    }) as typeof fetch;
    try {
        const abortedRes = await POST({
            locals: {
                backendUrl: "https://backend.example.test",
                apiKey: "server-only-service-key",
                user: { id: "trusted-admin", role: "admin" }
            },
            params: { service: "zilean" }
        } as Parameters<typeof POST>[0]);
        const abortedBody = await abortedRes.json();
        assert.equal(abortDelay, 7_000);
        assert.equal(abortedBody.ok, false);
        assert.equal(abortedBody.message, "Backend unreachable");
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.fetch = savedFetch;
    }

    // --- Backend 401/403 masked as "Unauthorized" ---
    globalThis.fetch = (async () => new Response("", { status: 403 })) as typeof fetch;
    const forbiddenRes = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    const forbiddenBody = await forbiddenRes.json();
    assert.equal(forbiddenBody.ok, false);
    assert.equal(forbiddenBody.message, "Unauthorized");
    globalThis.fetch = savedFetch;

    // --- Malformed JSON from backend ---
    globalThis.fetch = (async () =>
        new Response("not json", {
            status: 200,
            headers: { "content-type": "application/json" }
        })) as typeof fetch;
    const malformedRes = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    const malformedBody = await malformedRes.json();
    assert.equal(malformedBody.ok, false);
    assert.equal(malformedBody.message, "Connection failed");
    globalThis.fetch = savedFetch;

    // --- Secret-bearing message is scrubbed ---
    globalThis.fetch = (async () =>
        new Response(
            JSON.stringify({ ok: true, latency_ms: 5, message: "api_key=leaked_secret" }),
            { status: 200, headers: { "content-type": "application/json" } }
        )) as typeof fetch;
    const secretRes = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    const secretBody = await secretRes.json();
    assert.ok(
        !secretBody.message.includes("leaked_secret"),
        "Secret-bearing message must be scrubbed"
    );
    globalThis.fetch = savedFetch;

    // --- Non-finite latency is normalized to the API contract's finite number ---
    globalThis.fetch = (async () =>
        new Response(
            JSON.stringify({
                ok: true,
                latency_ms: "Infinity",
                message: "Connected"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
        )) as typeof fetch;
    const nonFiniteLatencyRes = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "trusted-admin", role: "admin" }
        },
        params: { service: "zilean" },
        request: new Request("https://frontend.example.test/api/settings/test-connection/zilean", {
            method: "POST"
        })
    } as Parameters<typeof POST>[0]);
    const nonFiniteLatencyBody = await nonFiniteLatencyRes.json();
    assert.equal(nonFiniteLatencyBody.latency_ms, 0);
    globalThis.fetch = savedFetch;
} finally {
    globalThis.fetch = originalFetch;
}
