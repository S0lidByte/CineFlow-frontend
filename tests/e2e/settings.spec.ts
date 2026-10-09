import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const COMPOSE_PROJECT = "cineflow-e2e";
const COMPOSE_FILE = fileURLToPath(
    new URL("../../../Triven_backend/docker-compose.e2e.yml", import.meta.url)
);

function setFixtureAllDebridMode(mode: "premium" | "free" | "error"): void {
    const pyScript = [
        "import urllib.request, json",
        `req = urllib.request.Request('http://127.0.0.1:8765/control/alldebrid', data=json.dumps({'mode': '${mode}'}).encode('utf-8'), headers={'Content-Type': 'application/json'})`,
        "resp = urllib.request.urlopen(req, timeout=5)",
        "assert resp.status == 200, f'Fixture control status {resp.status}'"
    ].join("; ");

    execFileSync(
        "docker",
        [
            "compose",
            "-p",
            COMPOSE_PROJECT,
            "-f",
            COMPOSE_FILE,
            "exec",
            "-T",
            "fixture",
            "python",
            "-c",
            pyScript
        ],
        { stdio: "pipe", timeout: 15000 }
    );
}

test.describe("Settings Page and Connection Probes", () => {
    test.beforeEach(() => {
        setFixtureAllDebridMode("premium");
    });

    test.afterEach(() => {
        setFixtureAllDebridMode("premium");
    });

    test("SSR probes remain disabled without JavaScript", async ({ browser, storageState }) => {
        const context = await browser.newContext({
            storageState,
            javaScriptEnabled: false
        });
        try {
            const page = await context.newPage();
            await page.goto("http://localhost:3000/settings?tab=downloaders");
            const row = page.locator("li").filter({ hasText: "AllDebrid" });
            await expect(row.getByRole("button", { name: "Test", exact: true })).toBeDisabled();
            await expect(row.locator('[data-slot="badge"]')).toHaveText("Not tested");
        } finally {
            await context.close();
        }
    });

    test("mounted probes disable while loading and recover after malformed responses", async ({
        page
    }) => {
        await page.goto("/settings?tab=downloaders");
        const row = page
            .locator("li")
            .filter({ hasText: "AllDebrid" })
            .filter({
                has: page.locator('[data-slot="badge"]')
            });
        const button = row.getByRole("button", { name: /^Test(?:ing)?$/ });
        await expect(button).toBeEnabled();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route("**/api/settings/test-connection/all_debrid", async (route) => {
            expect(route.request().method()).toBe("POST");
            expect(route.request().postData()).toBeNull();
            await gate;
            await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        });
        try {
            await button.click();
            await expect(button).toBeDisabled();
            await expect(row.locator('[data-slot="badge"]')).toHaveText("Testing…");
        } finally {
            release();
        }
        await expect(row.locator('[data-slot="badge"]')).toHaveText("Failed");
        await expect(button).toBeEnabled();
        await page.unroute("**/api/settings/test-connection/all_debrid");
        await button.click();
        await expect(row.locator('[data-slot="badge"]')).toHaveText(/OK/);
        await expect(button).toBeEnabled();
    });

    test("settings navigation loads and renders sections", async ({ page }) => {
        await page.goto("/settings");
        await expect(page).toHaveTitle(/CineFlow/);

        // Verify settings header or tab navigation
        await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible();
    });

    test("connection test panel triggers probe and displays response badge", async ({ page }) => {
        // Navigate to downloaders tab where AllDebrid / Real-Debrid probes live
        await page.goto("/settings?tab=downloaders");

        // Wait for Connection tests section to be visible
        await expect(page.getByRole("heading", { name: "Connection tests" })).toBeVisible({
            timeout: 10000
        });

        // Locate AllDebrid test button within the connection tests list
        const allDebridItem = page.locator("li").filter({ hasText: "AllDebrid" });
        await expect(allDebridItem).toBeVisible();

        const testBtn = allDebridItem.getByRole("button", { name: "Test" });
        await expect(testBtn).toBeEnabled();
        const responsePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/settings/test-connection/all_debrid" &&
                response.request().method() === "POST"
        );
        await testBtn.click();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ ok: true });

        // Expect status badge to update to OK (e.g. "OK · 14ms" or contains "OK")
        await expect(
            allDebridItem.locator('[data-slot="badge"]').filter({ hasText: /OK/ })
        ).toBeVisible({ timeout: 15000 });
    });

    test("negative connection test: free mode returns ok false failure badge then restores premium badge", async ({
        page
    }) => {
        setFixtureAllDebridMode("free");
        try {
            await page.goto("/settings?tab=downloaders");
            await expect(page.getByRole("heading", { name: "Connection tests" })).toBeVisible({
                timeout: 10000
            });

            const allDebridItem = page.locator("li").filter({ hasText: "AllDebrid" });
            await expect(allDebridItem).toBeVisible();

            const testBtn = allDebridItem.getByRole("button", { name: "Test" });
            await expect(testBtn).toBeEnabled();

            // 1. Trigger probe while fixture is in free mode
            const failResponsePromise = page.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname ===
                        "/api/settings/test-connection/all_debrid" &&
                    response.request().method() === "POST"
            );
            await testBtn.click();
            const failResponse = await failResponsePromise;
            expect(failResponse.status()).toBe(200);
            const failBody = await failResponse.json();
            expect(failBody).toMatchObject({ ok: false });

            // Expect failure badge to show "Failed"
            await expect(
                allDebridItem.locator('[data-slot="badge"]').filter({ hasText: /Failed/ })
            ).toBeVisible({ timeout: 15000 });

            // 2. Restore fixture to premium mode
            setFixtureAllDebridMode("premium");

            // Re-trigger probe
            await expect(testBtn).toBeEnabled();
            const okResponsePromise = page.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname ===
                        "/api/settings/test-connection/all_debrid" &&
                    response.request().method() === "POST"
            );
            await testBtn.click();
            const okResponse = await okResponsePromise;
            expect(okResponse.status()).toBe(200);
            const okBody = await okResponse.json();
            expect(okBody).toMatchObject({ ok: true });

            // Expect badge to return to OK
            await expect(
                allDebridItem.locator('[data-slot="badge"]').filter({ hasText: /OK/ })
            ).toBeVisible({ timeout: 15000 });
        } finally {
            setFixtureAllDebridMode("premium");
        }
    });
});
