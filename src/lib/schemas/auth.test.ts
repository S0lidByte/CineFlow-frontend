import assert from "node:assert/strict";
import {
    loginSchema,
    registerSchema,
    passwordChangeSchema,
    emailChangeSchema,
    setPasswordSchema
} from "./auth";

console.log("Running Authentication Schemas & Sanitization Tests...");

// --- 1. loginSchema Tests ---
{
    // Valid credentials
    const valid = loginSchema.safeParse({
        username: "cineflow_user",
        password: "securePassword123"
    });
    assert.equal(valid.success, true, "Valid login credentials should pass");
    if (valid.success) {
        assert.equal(valid.data.username, "cineflow_user");
    }

    // Trimming username
    const trimmed = loginSchema.safeParse({
        username: "  spaced_user  ",
        password: "password123"
    });
    assert.equal(trimmed.success, true, "Username should be trimmed");
    if (trimmed.success) {
        assert.equal(trimmed.data.username, "spaced_user");
    }

    // Non-breaking: 1-character password passes loginSchema to allow legacy credential check
    const shortLegacy = loginSchema.safeParse({
        username: "legacy_user",
        password: "p"
    });
    assert.equal(
        shortLegacy.success,
        true,
        "Login schema allows min 1 char to avoid locking out existing users"
    );

    // Rejects empty username / password
    const emptyUsername = loginSchema.safeParse({
        username: "   ",
        password: "password123"
    });
    assert.equal(emptyUsername.success, false, "Empty username after trim should fail");

    const emptyPassword = loginSchema.safeParse({
        username: "user",
        password: ""
    });
    assert.equal(emptyPassword.success, false, "Empty password should fail");
}

// --- 2. registerSchema Tests ---
{
    // Valid registration
    const valid = registerSchema.safeParse({
        username: "new_admin",
        email: "admin@cineflow.local",
        password: "strongPassword123",
        confirmPassword: "strongPassword123",
        image: "https://example.com/avatar.png"
    });
    assert.equal(valid.success, true, "Valid registration should pass");
    if (valid.success) {
        assert.equal(valid.data.username, "new_admin");
        assert.equal(valid.data.email, "admin@cineflow.local");
    }

    // Trimming username
    const trimmed = registerSchema.safeParse({
        username: "  clean_user  ",
        email: "user@cineflow.local",
        password: "strongPassword123",
        confirmPassword: "strongPassword123"
    });
    assert.equal(trimmed.success, true, "Register username should be trimmed");
    if (trimmed.success) {
        assert.equal(trimmed.data.username, "clean_user");
    }

    // Enforce >= 8 chars for new registrations
    const shortPassword = registerSchema.safeParse({
        username: "user",
        email: "user@cineflow.local",
        password: "1234567", // 7 chars
        confirmPassword: "1234567"
    });
    assert.equal(shortPassword.success, false, "Passwords under 8 chars must be rejected");

    // Invalid email
    const invalidEmail = registerSchema.safeParse({
        username: "user",
        email: "not-an-email",
        password: "strongPassword123",
        confirmPassword: "strongPassword123"
    });
    assert.equal(invalidEmail.success, false, "Invalid email format must be rejected");
}

// --- 3. passwordChangeSchema Tests ---
{
    // Valid password change
    const valid = passwordChangeSchema.safeParse({
        oldPassword: "oldPassword123",
        newPassword: "newStrongPassword123",
        confirmNewPassword: "newStrongPassword123",
        revokeSessions: true
    });
    assert.equal(valid.success, true, "Valid password change should pass");

    // Mismatched confirmation
    const mismatch = passwordChangeSchema.safeParse({
        oldPassword: "oldPassword123",
        newPassword: "newStrongPassword123",
        confirmNewPassword: "differentPassword123",
        revokeSessions: false
    });
    assert.equal(mismatch.success, false, "Mismatched new password must be rejected");

    // New password under 8 chars
    const shortNew = passwordChangeSchema.safeParse({
        oldPassword: "oldPassword123",
        newPassword: "short",
        confirmNewPassword: "short",
        revokeSessions: false
    });
    assert.equal(shortNew.success, false, "New password under 8 chars must be rejected");
}

// --- 4. setPasswordSchema Tests ---
{
    // Valid set password
    const valid = setPasswordSchema.safeParse({
        newPassword: "initialPassword123",
        confirmNewPassword: "initialPassword123"
    });
    assert.equal(valid.success, true, "Valid set password should pass");

    // Mismatch
    const mismatch = setPasswordSchema.safeParse({
        newPassword: "initialPassword123",
        confirmNewPassword: "mismatchedPassword"
    });
    assert.equal(mismatch.success, false, "Mismatched set password must be rejected");

    // Under 8 chars
    const short = setPasswordSchema.safeParse({
        newPassword: "short",
        confirmNewPassword: "short"
    });
    assert.equal(short.success, false, "Set password under 8 chars must be rejected");
}

// --- 5. emailChangeSchema Tests ---
{
    // Valid email
    const valid = emailChangeSchema.safeParse({
        newEmail: "newemail@cineflow.app"
    });
    assert.equal(valid.success, true, "Valid email should pass");

    // Invalid email
    const invalidEmail = emailChangeSchema.safeParse({
        newEmail: "bademail"
    });
    assert.equal(invalidEmail.success, false, "Invalid email in change email must be rejected");
}

console.log("All Authentication Schema & Sanitization Tests Passed Successfully!");
