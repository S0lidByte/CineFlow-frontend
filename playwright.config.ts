import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
if (BASE_URL !== "http://localhost:3000") {
    throw new Error("E2E tests require the disposable cineflow-e2e stack at localhost:3000.");
}

export default defineConfig({
    globalSetup: "./tests/e2e/global-setup.ts",
    outputDir: "test-results",
    testDir: "./tests/e2e",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    timeout: 60000,
    expect: {
        timeout: 15000
    },
    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
        video: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/
        },
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "tests/e2e/.auth/user.json"
            },
            dependencies: ["setup"]
        }
    ]
});
