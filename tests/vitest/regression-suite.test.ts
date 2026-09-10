import { test } from "vitest";

test("legacy frontend regression suites pass", async () => {
    await import("../../scripts/run_tests");
});
