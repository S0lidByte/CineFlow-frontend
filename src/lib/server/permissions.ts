import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { createHmac } from "node:crypto";

/*
By default, there are two resources with up to six permissions.

user: create list set-role ban impersonate delete set-password
session: list revoke delete
*/

const statement = {
    ...defaultStatements,
    item: ["request", "delete", "reset", "pause", "retry", "scrape"]
} as const;

export const ac = createAccessControl(statement);

export const admin = ac.newRole({
    item: ["request", "delete", "reset", "pause", "retry", "scrape"],
    ...adminAc.statements
});

export const user = ac.newRole({
    item: ["request"]
});

export const manager = ac.newRole({
    item: ["request", "delete", "reset", "pause", "retry", "scrape"]
});

export type AppRole = "admin" | "manager" | "user";

/**
 * Maps a frontend Better Auth user to backend capability role scopes.
 *
 * Scopes:
 * - admin: platform:admin,settings:write,playback:operator,library:read,media:request
 * - manager: settings:write,playback:operator,library:read,media:request
 * - user: library:read,media:request
 */
export function getActorRolesForUser(user?: { role?: string | null } | null): string {
    const role = user?.role ?? "user";
    switch (role) {
        case "admin":
            return "platform:admin,settings:write,playback:operator,library:read,media:request";
        case "manager":
            return "settings:write,playback:operator,library:read,media:request";
        case "user":
            return "library:read,media:request";
        default:
            return "library:read,media:request";
    }
}

/**
 * Generates an HMAC-SHA256 signature for actor identity claims.
 */
export function signActorPayload(
    payloadObj: {
        actor_id: string;
        actor_roles: string;
        actor_client: string;
        actor_timestamp: string;
    },
    secret: string
): string {
    const payload = JSON.stringify(payloadObj);
    return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Constructs sanitized, trusted actor headers with cryptographic attestation for the FastAPI backend.
 */
export function getActorHeadersForUser(
    user?: { id?: string | null; role?: string | null } | null,
    clientId: string = "cineflow-web-bff",
    overrideTimestamp?: string,
    overrideSecret?: string
): Record<string, string> {
    if (!user) {
        return {};
    }
    const actorId = user.id || "anonymous";
    const actorRoles = getActorRolesForUser(user);
    const timestamp = overrideTimestamp ?? Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
        "x-actor-id": actorId,
        "x-actor-roles": actorRoles,
        "x-actor-client": clientId,
        "x-actor-timestamp": timestamp
    };

    const secret =
        overrideSecret ??
        (typeof process !== "undefined" ? process.env?.ACTOR_CONTEXT_SECRET || "" : "");
    if (secret) {
        headers["x-actor-signature"] = signActorPayload(
            {
                actor_id: actorId,
                actor_roles: actorRoles,
                actor_client: clientId,
                actor_timestamp: timestamp
            },
            secret
        );
    }
    return headers;
}
