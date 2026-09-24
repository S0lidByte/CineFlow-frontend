// Explicitly inventory every current frontend *.test.ts module. Dynamic imports run
// global fetch/environment mocks sequentially rather than concurrently.
export {};

const testModules = [
    "../src/routes/(protected)/api/[...backendProxy]/backend-proxy.security.test.ts",
    "../src/routes/(protected)/api/operations/timeline/operations-timeline.security.test.ts",
    "../src/lib/stores/operations.test.ts",
    "../tests/routes/settings-test-connection.security.test.ts",
    "../src/lib/schemas/auth.test.ts",
    "../src/lib/providers/anilist.test.ts",
    "../src/lib/components/media/riven/item-request-parser.test.ts",
    "../src/lib/components/media/episode-details-sheet.test.ts",
    "../src/lib/components/media/collection-details.test.ts",
    "../src/routes/(protected)/details/media/[id]/[mediaType]/page-server-validation.test.ts",
    "../src/lib/components/settings/settings-safety.test.ts",
    "../src/lib/components/settings/settings-schema-transform.test.ts",
    "../src/lib/components/settings/ranking-presets.clone.test.ts",
    "../src/lib/components/auth/auth-components.test.ts",
    "../src/lib/services/ratings-matcher.test.ts",
    "../src/lib/server/admin-functions.test.ts",
    "../tests/routes/branding-consistency.test.ts",
    "../src/lib/server/db-resolution.test.ts"
];

for (const testModule of testModules) {
    await import(testModule);
}

console.log(`Executed ${testModules.length} frontend test file(s); all test suites passed.`);
