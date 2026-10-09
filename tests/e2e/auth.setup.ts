import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authFile = path.resolve("tests/e2e/.auth/user.json");

setup("authenticate as initial admin or existing user", async ({ page }) => {
    fs.mkdirSync(path.dirname(authFile), { recursive: true });

    await page.goto("/auth/login");
    await expect(page).toHaveTitle(/CineFlow/);

    // Check if initial admin setup form or standard sign in is active
    const isFirstTime = await page.getByText("First-Time System Initialization").isVisible();

    if (isFirstTime) {
        // First user setup: register form under register tab content
        const registerTab = page.getByRole("tab", { name: "Admin Setup" });
        if (await registerTab.isVisible()) {
            await registerTab.click();
        }

        const registerContent = page.locator('[role="tabpanel"][data-state="active"]');
        const usernameInput = registerContent.locator('input[name="username"]').first();
        const emailInput = registerContent.locator('input[name="email"]').first();
        const passwordInput = registerContent.locator('input[name="password"]').first();
        const confirmPasswordInput = registerContent
            .locator('input[name="confirmPassword"]')
            .first();

        await usernameInput.fill("admin");
        await emailInput.fill("admin@cineflow.local");
        await passwordInput.fill("AdminPass123!");
        await confirmPasswordInput.fill("AdminPass123!");

        const submitBtn = registerContent.locator('button[type="submit"]').first();
        await submitBtn.click();
    } else {
        // Regular login
        const loginTab = page.getByRole("tab", { name: "Sign In" });
        if (await loginTab.isVisible()) {
            await loginTab.click();
        }

        const loginContent = page.locator('[role="tabpanel"][data-state="active"]');
        const usernameInput = loginContent.locator('input[name="username"]').first();
        const passwordInput = loginContent.locator('input[name="password"]').first();

        await usernameInput.fill("admin");
        await passwordInput.fill("AdminPass123!");

        const submitBtn = loginContent.locator('button[type="submit"]').first();
        await submitBtn.click();
    }

    // After sign-in/registration, wait for redirection out of /auth/login
    // First-time registration involves PBKDF2/scrypt key derivation, SQLite writes, and SSR redirects,
    // which can take 10-25 seconds under heavy load or first-boot initialization.
    await page.waitForURL((url) => url.pathname === "/", {
        timeout: 45000
    });
    const response = await page.goto("/settings");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible();

    await page.context().storageState({ path: authFile });
});
