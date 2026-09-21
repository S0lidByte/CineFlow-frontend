/**
 * Unit/regression tests for media details server loader parameter validation.
 * Run: pnpm exec tsx src/routes/(protected)/details/media/[id]/[mediaType]/page-server-validation.test.ts
 */

import assert from "node:assert/strict";
import { ALLOWED_INDEXERS, parsePositiveIntegerId } from "./+page.server";

console.log("Running Media Details Server Loader Validation Tests...");

// 1. ALLOWED_INDEXERS tests
{
    assert.equal(ALLOWED_INDEXERS.has("tvdb"), true, "Should allow tvdb");
    assert.equal(ALLOWED_INDEXERS.has("tmdb"), true, "Should allow tmdb");
    assert.equal(ALLOWED_INDEXERS.has("imdb"), false, "Should reject imdb");
    assert.equal(ALLOWED_INDEXERS.has("mal"), false, "Should reject mal");
    assert.equal(ALLOWED_INDEXERS.has("anilist"), false, "Should reject anilist");
    assert.equal(ALLOWED_INDEXERS.has(""), false, "Should reject empty string");
}

// 2. parsePositiveIntegerId tests
{
    assert.equal(parsePositiveIntegerId("1"), 1, "Parses 1");
    assert.equal(parsePositiveIntegerId("12345"), 12345, "Parses 12345");
    assert.equal(parsePositiveIntegerId(" 9876 "), 9876, "Trims and parses 9876");

    assert.equal(parsePositiveIntegerId("0"), null, "Rejects 0");
    assert.equal(parsePositiveIntegerId("-5"), null, "Rejects -5");
    assert.equal(parsePositiveIntegerId("12.34"), null, "Rejects floats");
    assert.equal(parsePositiveIntegerId("abc"), null, "Rejects letters");
    assert.equal(parsePositiveIntegerId("123abc"), null, "Rejects alphanumeric");
    assert.equal(parsePositiveIntegerId(""), null, "Rejects empty string");
    assert.equal(parsePositiveIntegerId(null), null, "Rejects null");
    assert.equal(parsePositiveIntegerId(undefined), null, "Rejects undefined");
}

console.log("All Media Details Server Loader Validation Tests passed successfully!");
