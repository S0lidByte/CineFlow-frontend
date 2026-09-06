/**
 * Unit/regression tests for parseAddItemsResponse.
 * Run: pnpm exec tsx src/lib/components/media/riven/item-request-parser.test.ts
 */

import assert from "node:assert/strict";
import { parseAddItemsResponse } from "./item-request-parser";

// 1. Pure add response: Added 1, requeued 0 -> success
{
    const result = parseAddItemsResponse("Added 1 new item(s)");
    assert.equal(result.success, true);
    assert.equal(result.addedCount, 1);
    assert.equal(result.requeuedCount, 0);
    assert.equal(result.toastMessage, "Media item requested successfully!");
}

// 2. Requeue response: Added 0, requeued 1 -> success
{
    const result = parseAddItemsResponse("Added 0 new item(s). requeued 1 existing item(s)");
    assert.equal(result.success, true);
    assert.equal(result.addedCount, 0);
    assert.equal(result.requeuedCount, 1);
    assert.equal(result.toastMessage, "Media item requeued!");
}

// 3. Mixed batch response: Added 2, requeued 1 -> success
{
    const result = parseAddItemsResponse("Added 2 new item(s). requeued 1 existing item(s)");
    assert.equal(result.success, true);
    assert.equal(result.addedCount, 2);
    assert.equal(result.requeuedCount, 1);
    assert.equal(result.toastMessage, "Media items processed (2 added, 1 requeued)!");
}

// 4. Skipped terminal state response: Added 0, skipped 1 -> failure/no-op
{
    const result = parseAddItemsResponse(
        "Added 0 new item(s). skipped 1 existing item(s) in terminal/paused states"
    );
    assert.equal(result.success, false);
    assert.equal(result.addedCount, 0);
    assert.equal(result.requeuedCount, 0);
    assert.equal(result.skippedCount, 1);
    assert.equal(
        result.toastMessage,
        "Added 0 new item(s). skipped 1 existing item(s) in terminal/paused states"
    );
}

// 5. TVDB not found response: Added 0, 1 not found -> failure
{
    const result = parseAddItemsResponse("Added 0 new item(s). 1 TVDB ID(s) not found: 999999");
    assert.equal(result.success, false);
    assert.equal(result.addedCount, 0);
    assert.equal(result.requeuedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.toastMessage, "Added 0 new item(s). 1 TVDB ID(s) not found: 999999");
}

// 6. Empty / null / undefined message -> failure
{
    const nullRes = parseAddItemsResponse(null);
    assert.equal(nullRes.success, false);
    assert.equal(nullRes.toastMessage, "Failed to request media item.");

    const emptyRes = parseAddItemsResponse("");
    assert.equal(emptyRes.success, false);
    assert.equal(emptyRes.toastMessage, "Failed to request media item.");
}

console.log("All item-request-parser tests passed!");
