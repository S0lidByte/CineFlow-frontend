import { test, expect } from "@playwright/test";

test.describe("Authentication and Login Flow", () => {
    // Run without pre-authenticated storage state
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login page renders branding and auth form properly", async ({ page }) => {
        await page.goto("/auth/login");
        await expect(page).toHaveTitle(/CineFlow/);
        await expect(page.getByText("CINEFLOW").first()).toBeVisible();
        await expect(page.getByText("Media Streaming Engine").first()).toBeVisible();

        // Either login or register tab must be present
        await expect(page.locator("form").first()).toBeVisible();
    });

    test("invalid login shows validation error or fails safely", async ({ page }) => {
        await page.goto("/auth/login");

        const loginTab = page.getByRole("tab", { name: "Sign In" });
        if (await loginTab.isVisible()) {
            await loginTab.click();
        }

        const usernameInput = page.locator('input[name="username"]').first();
        const passwordInput = page.locator('input[name="password"]').first();

        await expect(usernameInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await usernameInput.fill("nonexistent_user");
        await passwordInput.fill("wrong_password_123");

        const responsePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/auth/login" &&
                response.request().method() === "POST"
        );
        await page.locator('button[type="submit"]').first().click();
        const response = await responsePromise;
        const body = await response.json();
        expect(["failure", "success"]).toContain(body.type);
        expect(body.status).toBeGreaterThanOrEqual(400);
        expect(body.status).toBeLessThan(500);
        await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});
