/**
 * Comprehensive Unit and Logic Test Suite for Auth Components
 * Imports and tests REAL production implementations from:
 * - src/lib/utils.ts (getInitials)
 * - src/lib/utils/auth.ts (sanitizeAvatarUrl, parsePasskeyError, parseUserAgent, isOnlyLoginMethod, countActiveLoginMethods, formatAuthTimestamp)
 */
import assert from "node:assert/strict";
import { getInitials } from "../../utils";
import {
    sanitizeAvatarUrl,
    parsePasskeyError,
    parseUserAgent,
    isOnlyLoginMethod,
    countActiveLoginMethods,
    formatAuthTimestamp
} from "../../utils/auth";

console.log("Running Auth Components Logic & Edge Cases Tests against production modules...");

// --- 1. Initials Extractor (Production getInitials) ---
{
    assert.equal(getInitials(""), "?", "Empty name returns fallback '?'");
    assert.equal(getInitials("   "), "?", "Whitespace-only name returns fallback '?'");
    assert.equal(getInitials(null), "?", "null name returns fallback '?'");
    assert.equal(getInitials(undefined), "?", "undefined name returns fallback '?'");
    assert.equal(getInitials("CineFlow"), "C", "Single word returns first letter uppercase");
    assert.equal(getInitials("Cine Flow"), "CF", "Two words return first letter of each");
    assert.equal(getInitials("John Middle Doe"), "JD", "Three words return first and last initial");
    assert.equal(getInitials("a"), "A", "Single char returns uppercase");
}

// --- 2. Avatar Custom URL Validation (Production sanitizeAvatarUrl) ---
{
    assert.equal(sanitizeAvatarUrl(""), "", "Empty string returns empty reset");
    assert.equal(sanitizeAvatarUrl(null), "", "null returns empty string");
    assert.equal(sanitizeAvatarUrl(undefined), "", "undefined returns empty string");
    assert.equal(
        sanitizeAvatarUrl("  https://api.dicebear.com/7.x/identicon/svg?seed=Test  "),
        "https://api.dicebear.com/7.x/identicon/svg?seed=Test",
        "Trimmed valid https URL passes"
    );
    assert.equal(
        sanitizeAvatarUrl("http://localhost:8080/avatar.png"),
        "http://localhost:8080/avatar.png",
        "Valid http URL passes"
    );
    assert.equal(
        sanitizeAvatarUrl("javascript:alert(1)"),
        "",
        "javascript: protocol is stripped/empty"
    );
    assert.equal(
        sanitizeAvatarUrl("data:text/html;base64,..."),
        "",
        "data: protocol is stripped/empty"
    );
    assert.equal(
        sanitizeAvatarUrl("ftp://files.example.com/me.png"),
        "",
        "ftp: protocol is stripped/empty"
    );
}

// --- 3. Account Lockout & Provider Counts (Production Auth Utils) ---
{
    const mockProviders = {
        credential: { enabled: true, name: "Password" },
        github: { enabled: true, name: "GitHub" },
        google: { enabled: false, name: "Google (Disabled)" }
    };

    const singlePasswordAccount = [{ providerId: "credential" }];
    assert.equal(
        countActiveLoginMethods(singlePasswordAccount, mockProviders),
        1,
        "Single password account has 1 active method"
    );
    assert.equal(
        isOnlyLoginMethod(singlePasswordAccount, mockProviders),
        true,
        "Single password account is detected as only login method"
    );

    const dualAccounts = [{ providerId: "credential" }, { providerId: "github" }];
    assert.equal(
        countActiveLoginMethods(dualAccounts, mockProviders),
        2,
        "Dual active accounts count as 2"
    );
    assert.equal(
        isOnlyLoginMethod(dualAccounts, mockProviders),
        false,
        "Dual active accounts allow unlinking"
    );

    const accountsWithDisabledProvider = [
        { providerId: "credential" },
        { providerId: "google" } // google is disabled in config
    ];
    assert.equal(
        countActiveLoginMethods(accountsWithDisabledProvider, mockProviders),
        1,
        "Account with disabled provider is excluded from active count"
    );
    assert.equal(
        isOnlyLoginMethod(accountsWithDisabledProvider, mockProviders),
        true,
        "Lockout protection prevents unlinking when second provider is disabled"
    );

    const unknownProviderAccount = [{ providerId: "custom-sso" }];
    assert.equal(
        countActiveLoginMethods(unknownProviderAccount, mockProviders),
        1,
        "Unknown provider defaults to enabled/active"
    );
}

// --- 4. User-Agent Device & Browser Detection (Production parseUserAgent) ---
{
    // Opera UA on Windows (contains both Chrome and OPR)
    const operaUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
    const parsedOpera = parseUserAgent(operaUA);
    assert.equal(parsedOpera.type, "desktop");
    assert.equal(parsedOpera.name, "Opera on Windows", "Opera correctly prioritized before Chrome");

    // Edge UA on Windows
    const edgeUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    const parsedEdge = parseUserAgent(edgeUA);
    assert.equal(parsedEdge.type, "desktop");
    assert.equal(parsedEdge.name, "Edge on Windows");

    // Safari UA on macOS
    const macSafariUA =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    const parsedMacSafari = parseUserAgent(macSafariUA);
    assert.equal(parsedMacSafari.type, "desktop");
    assert.equal(parsedMacSafari.name, "Safari on macOS");

    // Mobile Safari UA on iPhone
    const iphoneUA =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const parsedIphone = parseUserAgent(iphoneUA);
    assert.equal(parsedIphone.type, "mobile");
    assert.equal(parsedIphone.name, "Safari on iOS");

    // Firefox on Linux
    const linuxFirefoxUA =
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";
    const parsedFirefox = parseUserAgent(linuxFirefoxUA);
    assert.equal(parsedFirefox.type, "desktop");
    assert.equal(parsedFirefox.name, "Firefox on Linux");

    // Null and empty
    assert.deepEqual(parseUserAgent(null), { type: "desktop", name: "Unknown Device / Browser" });
    assert.deepEqual(parseUserAgent(undefined), {
        type: "desktop",
        name: "Unknown Device / Browser"
    });
}

// --- 5. Auth Timestamp Formatter (Production formatAuthTimestamp) ---
{
    assert.equal(formatAuthTimestamp(null), "Unknown");
    assert.equal(formatAuthTimestamp(undefined), "Unknown");
    assert.equal(formatAuthTimestamp(""), "Unknown");
    assert.equal(typeof formatAuthTimestamp("2026-09-10T12:00:00.000Z"), "string");
}

// --- 6. WebAuthn / Passkey Diagnostic Error Resolver (Production parsePasskeyError) ---
{
    assert.equal(
        parsePasskeyError({ name: "NotAllowedError" }),
        "Passkey operation was cancelled or timed out."
    );
    assert.equal(
        parsePasskeyError({ name: "InvalidStateError" }),
        "Passkey is already registered or in an invalid state."
    );
    assert.equal(
        parsePasskeyError({ name: "NotSupportedError" }),
        "Passkeys are not supported on this device or browser."
    );
    assert.equal(
        parsePasskeyError({ message: "Custom hardware timeout" }),
        "Custom hardware timeout"
    );
    assert.equal(parsePasskeyError(null), "Passkey operation failed.");
    assert.equal(parsePasskeyError(undefined), "Passkey operation failed.");
}

console.log("auth-components.test.ts: ok");
