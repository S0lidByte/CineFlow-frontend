/**
 * Shared authentication, session, and device utilities for CineFlow.
 */
import * as dateUtils from "./date";

export interface ParsedDevice {
    type: "mobile" | "desktop";
    name: string;
}

/**
 * Parses user agent string to identify client device type and browser/OS combination.
 */
export function parseUserAgent(userAgent?: string | null): ParsedDevice {
    if (!userAgent) {
        return { type: "desktop", name: "Unknown Device / Browser" };
    }
    const ua = userAgent.toLowerCase();

    let os = "Unknown OS";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios") || ua.includes("ipod"))
        os = "iOS";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("macintosh") || (ua.includes("mac os") && !ua.includes("like mac os x")))
        os = "macOS";
    else if (ua.includes("linux")) os = "Linux";

    let browser = "Browser";
    if (ua.includes("edg/")) browser = "Edge";
    else if (ua.includes("opr") || ua.includes("opera")) browser = "Opera";
    else if (ua.includes("chrome") && !ua.includes("edg/")) browser = "Chrome";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("firefox")) browser = "Firefox";

    const isMobile =
        ua.includes("mobile") ||
        ua.includes("android") ||
        ua.includes("iphone") ||
        ua.includes("ipad");

    return {
        type: isMobile ? "mobile" : "desktop",
        name: `${browser} on ${os}`
    };
}

/**
 * Format auth timestamps consistently with "Unknown" fallback.
 */
export function formatAuthTimestamp(value: Date | string | number | null | undefined): string {
    if (!value) return "Unknown";
    try {
        if (value instanceof Date) {
            return dateUtils.formatDate(value.toISOString()) ?? "Unknown";
        }
        if (typeof value === "number") {
            return dateUtils.formatDate(new Date(value).toISOString()) ?? "Unknown";
        }
        return dateUtils.formatDate(String(value)) ?? "Unknown";
    } catch {
        return "Unknown";
    }
}

/**
 * Sanitize and validate avatar URL. Returns trimmed HTTP(S) URL or empty string.
 */
export function sanitizeAvatarUrl(url: string | null | undefined): string {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }
    return "";
}

/**
 * Parses passkey and WebAuthn errors into clear user-facing messages.
 */
export function parsePasskeyError(err: { name?: string; message?: string } | unknown): string {
    if (!err || typeof err !== "object") {
        return "Passkey operation failed.";
    }
    const errorObj = err as { name?: string; message?: string };
    switch (errorObj.name) {
        case "NotAllowedError":
            return "Passkey operation was cancelled or timed out.";
        case "InvalidStateError":
            return "Passkey is already registered or in an invalid state.";
        case "NotSupportedError":
            return "Passkeys are not supported on this device or browser.";
        default:
            return errorObj.message || "Passkey operation failed.";
    }
}

/**
 * Counts the number of active, enabled authentication methods for the user.
 */
export function countActiveLoginMethods(
    accounts: Array<{ providerId: string }> | undefined | null,
    providers: Record<string, { enabled?: boolean }> | undefined | null
): number {
    if (!accounts || !Array.isArray(accounts)) return 0;
    if (!providers) return accounts.length;
    return accounts.filter((a) => {
        const config = providers[a.providerId];
        return config ? config.enabled !== false : true;
    }).length;
}

/**
 * Checks if the user only has a single active login method remaining (to prevent lockout).
 */
export function isOnlyLoginMethod(
    accounts: Array<{ providerId: string }> | undefined | null,
    providers: Record<string, { enabled?: boolean }> | undefined | null
): boolean {
    return countActiveLoginMethods(accounts, providers) <= 1;
}
