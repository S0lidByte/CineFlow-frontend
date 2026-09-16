import assert from "node:assert/strict";
import { POST } from "./+server";

console.log("Running operations timeline SSE proxy security tests...");

// Test 1: Unauthenticated request is rejected with 401
{
    const mockLocals = {
        user: null,
        session: null
    } as unknown as App.Locals;

    let errorThrown: unknown = null;
    try {
        await POST({
            locals: mockLocals,
            request: new Request("http://localhost/api/operations/timeline", { method: "POST" })
        } as unknown as Parameters<typeof POST>[0]);
    } catch (e: unknown) {
        errorThrown = e;
    }

    assert.ok(errorThrown, "Expected an error for unauthenticated user");
    assert.strictEqual(
        (errorThrown as { status?: number }).status,
        401,
        "Expected 401 Unauthorized"
    );
}

console.log("Passed operations timeline SSE proxy security tests.");
