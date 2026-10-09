import { test, expect } from "@playwright/test";

test.describe("Protected Routes Navigation & Smoke Verification", () => {
    for (const route of ["/", "/activity", "/library", "/calendar"]) {
        test(`${route} renders without redirecting to login`, async ({ page }) => {
            const response = await page.goto(route);
            expect(response?.status()).toBe(200);
            await expect(page).toHaveURL((url) => url.pathname === route);
            await expect(page).toHaveTitle(/CineFlow/);
            await expect(page.locator("main").first()).toBeVisible();
        });
    }
});
