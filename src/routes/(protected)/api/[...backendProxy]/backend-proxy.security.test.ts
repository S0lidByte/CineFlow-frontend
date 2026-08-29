/** Regression test: browser-supplied backend credentials and actor claims are never trusted. */
import assert from "node:assert/strict";

import { POST } from "./+server";
import { signActorPayload } from "$lib/server/permissions";

const originalFetch = globalThis.fetch;
let forwardedUrl = "";
let forwardedInit: RequestInit | undefined;

globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    forwardedUrl = input.toString();
    forwardedInit = init;
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
    });
}) as typeof fetch;

try {
    process.env.ACTOR_CONTEXT_SECRET = "test-attestation-secret-999";

    const response = await POST({
        locals: {
            backendUrl: "https://backend.example.test",
            apiKey: "server-only-service-key",
            user: { id: "authenticated-manager", role: "manager" }
        },
        url: new URL("https://frontend.example.test/api/v1/items/add"),
        request: new Request("https://frontend.example.test/api/v1/items/add", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "x-api-key": "attacker-service-key",
                "x-actor-id": "attacker-admin",
                "x-actor-roles": "platform:admin",
                "x-actor-client": "attacker-client",
                "x-actor-timestamp": "1000000000",
                "x-actor-signature": "attacker-forged-sig"
            },
            body: JSON.stringify({ media_type: "movie", tmdb_ids: ["123"] })
        })
    } as Parameters<typeof POST>[0]);

    const headers = new Headers(forwardedInit?.headers);

    assert.equal(forwardedUrl, "https://backend.example.test/api/v1/items/add");
    assert.equal(response.status, 200);
    assert.equal(headers.get("x-api-key"), "server-only-service-key");
    assert.equal(headers.get("x-actor-id"), "authenticated-manager");
    assert.equal(
        headers.get("x-actor-roles"),
        "settings:write,playback:operator,library:read,media:request"
    );
    assert.equal(headers.get("x-actor-client"), "cineflow-web-bff");
    assert.notEqual(headers.get("x-api-key"), "attacker-service-key");
    assert.notEqual(headers.get("x-actor-id"), "attacker-admin");
    assert.notEqual(headers.get("x-actor-roles"), "platform:admin");
    assert.notEqual(headers.get("x-actor-client"), "attacker-client");
    assert.notEqual(headers.get("x-actor-timestamp"), "1000000000");
    assert.notEqual(headers.get("x-actor-signature"), "attacker-forged-sig");
    assert.ok(headers.get("x-actor-timestamp"));
    assert.ok(headers.get("x-actor-signature"));

    const expectedSig = signActorPayload(
        {
            actor_id: "authenticated-manager",
            actor_roles: "settings:write,playback:operator,library:read,media:request",
            actor_client: "cineflow-web-bff",
            actor_timestamp: headers.get("x-actor-timestamp")!
        },
        "test-attestation-secret-999"
    );
    assert.equal(headers.get("x-actor-signature"), expectedSig);
    assert.equal(headers.get("accept"), "application/json");
} finally {
    globalThis.fetch = originalFetch;
}

console.log("backend-proxy.security.test.ts: ok");
