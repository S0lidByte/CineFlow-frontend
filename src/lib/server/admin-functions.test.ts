/**
 * Unit & security regression test for admin user mutations and public registration checks.
 *
 * This module requires a SvelteKit-aware runtime because `functions.ts` imports
 * SvelteKit environment modules. It is kept type-checked with the application.
 */
import assert from "node:assert/strict";
import {
    validateAdminMutation,
    isPublicRegistrationAllowed,
    setPublicRegistrationAllowed,
    getAdminCount,
    getUsersCount
} from "./functions";

async function runTests() {
    console.log("Starting Admin User Management & Registration Security Tests...");

    // Test 1: Non-admin actor rejection
    const nonAdminAttempt = await validateAdminMutation({
        actorId: "user-1",
        actorRole: "user",
        targetUserId: "user-2"
    });
    assert.equal(nonAdminAttempt.allowed, false, "Non-admin actor should be rejected");
    assert.match(nonAdminAttempt.reason || "", /administrator privileges/i);

    const managerAttempt = await validateAdminMutation({
        actorId: "manager-1",
        actorRole: "manager",
        targetUserId: "user-2"
    });
    assert.equal(
        managerAttempt.allowed,
        false,
        "Manager actor should be rejected from user admin mutations"
    );

    // Test 2: Self-suspension, self-demotion, and self-deletion prevention
    const selfBanAttempt = await validateAdminMutation({
        actorId: "admin-1",
        actorRole: "admin",
        targetUserId: "admin-1",
        isBan: true
    });
    assert.equal(selfBanAttempt.allowed, false, "Admins cannot suspend their own account");
    assert.match(selfBanAttempt.reason || "", /cannot ban their own account/i);

    const selfDemotionAttempt = await validateAdminMutation({
        actorId: "admin-1",
        actorRole: "admin",
        targetUserId: "admin-1",
        targetNewRole: "user"
    });
    assert.equal(selfDemotionAttempt.allowed, false, "Admins cannot demote their own account");
    assert.match(selfDemotionAttempt.reason || "", /cannot demote their own account/i);

    const selfDeleteAttempt = await validateAdminMutation({
        actorId: "admin-1",
        actorRole: "admin",
        targetUserId: "admin-1",
        isDelete: true
    });
    assert.equal(selfDeleteAttempt.allowed, false, "Admins cannot delete their own account");
    assert.match(selfDeleteAttempt.reason || "", /cannot delete their own account/i);

    // Test 3: Public registration settings toggle
    // Set to false
    await setPublicRegistrationAllowed(false);
    const isAllowedFalse = await isPublicRegistrationAllowed();
    assert.equal(isAllowedFalse, false, "Public registration should be false after disabling");

    // Set to true
    await setPublicRegistrationAllowed(true);
    const isAllowedTrue = await isPublicRegistrationAllowed();
    assert.equal(isAllowedTrue, true, "Public registration should be true after enabling");

    // Restore to false for secure default
    await setPublicRegistrationAllowed(false);
    const isAllowedRestored = await isPublicRegistrationAllowed();
    assert.equal(isAllowedRestored, false, "Public registration should be restored to false");

    // Test 4: Verify counts
    const adminCount = await getAdminCount();
    const userCount = await getUsersCount();
    assert.ok(adminCount >= 1, "Should have at least 1 admin in current DB");
    assert.ok(userCount >= adminCount, "Total users should be >= admin count");

    console.log("All Admin User Management & Registration Security Tests passed successfully!");
}

runTests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
