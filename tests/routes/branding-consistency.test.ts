import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "../../");

console.log("Running Frontend Branding & Consistency Suite (REBRAND-002)...");

// 1. Verify site.webmanifest
const manifestPath = resolve(frontendRoot, "static/site.webmanifest");
assert.equal(existsSync(manifestPath), true, "site.webmanifest must exist");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
assert.equal(manifest.name, "CineFlow", "manifest.name should be CineFlow");
assert.equal(manifest.short_name, "CineFlow", "manifest.short_name should be CineFlow");
assert.equal(Array.isArray(manifest.icons), true, "manifest.icons should be an array");

for (const icon of manifest.icons) {
    const iconPath = resolve(frontendRoot, "static", icon.src.replace(/^\//, ""));
    assert.equal(existsSync(iconPath), true, `Manifest icon ${icon.src} must exist at ${iconPath}`);
}

// 2. Verify app.html
const appHtmlPath = resolve(frontendRoot, "src/app.html");
assert.equal(existsSync(appHtmlPath), true, "src/app.html must exist");
const appHtml = readFileSync(appHtmlPath, "utf-8");
assert.equal(appHtml.includes('<link rel="manifest" href="/site.webmanifest" />'), true);
assert.equal(appHtml.includes('<meta name="application-name" content="CineFlow" />'), true);
assert.equal(
    appHtml.includes('<meta name="apple-mobile-web-app-title" content="CineFlow" />'),
    true
);

// 3. Verify Layout & Route Titles
const publicLayout = readFileSync(
    resolve(frontendRoot, "src/routes/(public)/+layout.svelte"),
    "utf-8"
);
const protectedLayout = readFileSync(
    resolve(frontendRoot, "src/routes/(protected)/+layout.svelte"),
    "utf-8"
);
const libraryPage = readFileSync(
    resolve(frontendRoot, "src/routes/(protected)/library/+page.svelte"),
    "utf-8"
);

assert.equal(
    publicLayout.includes("<title>CineFlow</title>"),
    true,
    "Public layout title must be CineFlow"
);
assert.equal(
    protectedLayout.includes("<title>CineFlow</title>"),
    true,
    "Protected layout title must be CineFlow"
);
assert.equal(
    libraryPage.includes("<title>Library - CineFlow</title>"),
    true,
    "Library page title must be Library - CineFlow"
);

// 4. Verify Media Action Dialogs
const actionComponents = [
    "src/lib/components/media/riven/item-delete.svelte",
    "src/lib/components/media/riven/item-pause.svelte",
    "src/lib/components/media/riven/item-request.svelte",
    "src/lib/components/media/riven/item-reset.svelte",
    "src/lib/components/media/riven/item-retry.svelte"
];

for (const relPath of actionComponents) {
    const fullPath = resolve(frontendRoot, relPath);
    assert.equal(existsSync(fullPath), true, `${relPath} must exist`);
    const source = readFileSync(fullPath, "utf-8");

    assert.equal(source.includes("CineFlow"), true, `${relPath} must contain CineFlow`);
    assert.equal(
        source.includes("request to Riven to"),
        false,
        `${relPath} must not contain legacy Riven modal text`
    );
}

console.log("All Frontend Branding & Consistency Tests Passed Successfully!");
